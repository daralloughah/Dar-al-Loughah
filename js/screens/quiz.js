/* =========================================================
   DAR AL LOUGHAH — SCREEN: QUIZ QCM (v2 avec support lettres)
   - 10 questions à 4 choix
   - Détection automatique du contexte (mots OU lettres)
   - Pour les lettres : lettre↔translit, mélange avec mots palier
   - Feedback rouge/vert
   - XP + tracking stats
   ========================================================= */

const QuizScreen = (function() {

  let questions = [];
  let currentIdx = 0;
  let selectedAnswer = -1;
  let answered = false;
  let correctCount = 0;
  let inSession = false;

  const QUIZ_LENGTH = 10;

  // Mots palier : composés UNIQUEMENT de lettres apprises (pour mode letters)
  const MILESTONE_WORDS = [
    { ar: "بحث", translit: "BAḤTH", fr: "Recherche", letters: ["ba","ha","tha"] },
    { ar: "بحر", translit: "BAḤR",  fr: "Mer",       letters: ["ba","ha","ra"] },
    { ar: "شمس", translit: "SHAMS", fr: "Soleil",    letters: ["shin","mim","sin"] },
    { ar: "قلم", translit: "QALAM", fr: "Stylo",     letters: ["qaf","lam","mim"] },
    { ar: "كتاب", translit: "KITĀB", fr: "Livre",    letters: ["kaf","ta","alif","ba"] },
    { ar: "باب", translit: "BĀB",   fr: "Porte",     letters: ["ba","alif","ba"] },
    { ar: "نور", translit: "NŪR",   fr: "Lumière",   letters: ["nun","waw","ra"] },
    { ar: "ماء", translit: "MĀʾ",   fr: "Eau",       letters: ["mim","alif"] },
    { ar: "يوم", translit: "YAWM",  fr: "Jour",      letters: ["ya","waw","mim"] },
    { ar: "ليل", translit: "LAYL",  fr: "Nuit",      letters: ["lam","ya","lam"] }
  ];

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    if (!window.Api) return;

    questions = await buildQuestions();

    if (!questions || questions.length === 0) {
      renderEmpty();
      return;
    }

    currentIdx = 0;
    selectedAnswer = -1;
    answered = false;
    correctCount = 0;
    inSession = true;

    renderQuestion();
  }

  /* =========================================================
     CONSTRUIRE LES QUESTIONS — selon contexte
     ========================================================= */
  async function buildQuestions() {
    const ctx = (window.State && window.State.get("learningContext")) || {};

    // === MODE LETTRES ===
    if (ctx.source === "letters") {
      return await buildLetterQuestions(ctx);
    }

    // === MODE MOTS (existant) ===
    return await buildWordQuestions(ctx);
  }

  /* =========================================================
     QUESTIONS POUR LES LETTRES
     ========================================================= */
  async function buildLetterQuestions(ctx) {
    const allLetters = await window.Api.getLetters();
    if (!allLetters || allLetters.length < 4) return [];

    const learnedIds = ctx.letterIds || [];
    const learnedLetters = allLetters.filter(function(l) { return learnedIds.includes(l.id); });

    if (learnedLetters.length < 4) return [];

    // Préparer pool de mots palier disponibles (toutes lettres connues)
    const learnedSet = new Set(learnedIds);
    const availableMilestones = MILESTONE_WORDS.filter(function(m) {
      return m.letters.every(function(letterId) { return learnedSet.has(letterId); });
    });

    // Si on a 5+ lettres apprises ET au moins 1 mot palier, on mélange
    const includeWords = learnedLetters.length >= 5 && availableMilestones.length > 0;

    const allChoicesPool = allLetters.map(function(l) {
      return {
        type: "letter",
        ar: l.ar,
        translit: (l.name || "") + (l.sound ? " (" + l.sound + ")" : ""),
        fr: l.name || "",
        id: l.id
      };
    });

    if (includeWords) {
      availableMilestones.forEach(function(m) {
        allChoicesPool.push({
          type: "word",
          ar: m.ar,
          translit: m.translit,
          fr: m.fr,
          id: "word:" + m.ar
        });
      });
    }

    // Items à utiliser pour les questions = lettres apprises + mots disponibles
    const learnedItemsPool = [];
    learnedLetters.forEach(function(l) {
      learnedItemsPool.push({
        type: "letter",
        ar: l.ar,
        translit: (l.name || "") + (l.sound ? " (" + l.sound + ")" : ""),
        fr: l.name || "",
        id: l.id
      });
    });
    if (includeWords) {
      availableMilestones.forEach(function(m) {
        learnedItemsPool.push({
          type: "word",
          ar: m.ar,
          translit: m.translit,
          fr: m.fr,
          id: "word:" + m.ar
        });
      });
    }

    // Construire QUIZ_LENGTH questions
    const shuffled = shuffleArray(learnedItemsPool);
    const selected = shuffled.slice(0, Math.min(QUIZ_LENGTH, shuffled.length));

    return selected.map(function(item) {
      // Choisir random : afficher AR, demander la translit (50%) OU afficher translit, demander AR (50%)
      const askMode = Math.random() < 0.5 ? "ar-to-translit" : "translit-to-ar";

      // 3 distracteurs du même type que l'item correct
      const sameType = allChoicesPool.filter(function(c) { return c.type === item.type && c.id !== item.id; });
      const wrongs = shuffleArray(sameType).slice(0, 3);
      const allChoices = shuffleArray(wrongs.concat([item]));
      const correctIndex = allChoices.findIndex(function(c) { return c.id === item.id; });

      let questionAr, questionFr, choices;

      if (askMode === "ar-to-translit") {
        questionAr = item.ar;
        questionFr = item.type === "letter" ? "Quel est le nom de cette lettre ?" : "Quelle est la translittération ?";
        choices = allChoices.map(function(c) { return c.translit; });
      } else {
        questionAr = item.translit;
        questionFr = item.type === "letter" ? "Quelle est la lettre arabe ?" : "Quel est le mot en arabe ?";
        choices = allChoices.map(function(c) { return c.ar; });
      }

      return {
        questionAr: questionAr,
        questionFr: questionFr,
        questionStyle: askMode === "translit-to-ar" ? "translit" : "arabic",
        choicesStyle: askMode === "ar-to-translit" ? "translit" : "arabic",
        choices: choices,
        correctIndex: correctIndex,
        wordId: item.id
      };
    });
  }

  /* =========================================================
     QUESTIONS POUR LES MOTS (existant)
     ========================================================= */
  async function buildWordQuestions(ctx) {
    let pool = [];

    if (ctx.source === "list" && ctx.listId) {
      const list = window.State.getList(ctx.listId);
      if (list && list.words.length > 0) {
        pool = list.words.map(function(w) {
          return { ar: w.ar, fr: w.fr, translit: w.translit, id: w.id };
        });
      }
    }

    if (pool.length === 0 && ctx.themeId) {
      const themeData = await window.Api.getTheme(ctx.themeId);
      if (themeData && themeData.levels) {
        const levelId = ctx.levelId || "debutant";
        const words = themeData.levels[levelId] || [];
        pool = words.map(function(w, i) {
          return { ar: w.ar, fr: w.fr, translit: w.translit || w.tr, id: ctx.themeId + ":" + levelId + ":" + i };
        });
      }
    }

    if (pool.length < 4) {
      pool = pool.concat(getDefaultPool());
    }

    pool = pool.filter(function(w) { return w.ar && w.fr; });
    if (pool.length < 4) return [];

    const shuffled = shuffleArray(pool);
    const selected = shuffled.slice(0, Math.min(QUIZ_LENGTH, shuffled.length));

    return selected.map(function(correctWord) {
      const wrongs = shuffled.filter(function(w) { return w.ar !== correctWord.ar; });
      const wrongChoices = shuffleArray(wrongs).slice(0, 3);
      const allChoices = shuffleArray(wrongChoices.concat([correctWord]));
      const correctIndex = allChoices.findIndex(function(w) { return w.ar === correctWord.ar; });

      return {
        questionAr: correctWord.ar,
        questionFr: "Que signifie ce mot ?",
        questionStyle: "arabic",
        choicesStyle: "translit",
        choices: allChoices.map(function(w) { return w.fr; }),
        correctIndex: correctIndex,
        wordId: correctWord.id
      };
    });
  }

  function getDefaultPool() {
    return [
      { ar:"نور",  fr:"Lumière",     translit:"NŪR",    id:"def:nur" },
      { ar:"كتاب", fr:"Livre",       translit:"KITĀB",  id:"def:kitab" },
      { ar:"ماء",  fr:"Eau",         translit:"MĀʾ",    id:"def:ma" },
      { ar:"شمس",  fr:"Soleil",      translit:"SHAMS",  id:"def:shams" },
      { ar:"قمر",  fr:"Lune",        translit:"QAMAR",  id:"def:qamar" },
      { ar:"صديق", fr:"Ami",         translit:"ṢADĪQ",  id:"def:sadiq" },
      { ar:"بيت",  fr:"Maison",      translit:"BAYT",   id:"def:bayt" },
      { ar:"حب",   fr:"Amour",       translit:"ḤUBB",   id:"def:hubb" },
      { ar:"سلام", fr:"Paix",        translit:"SALĀM",  id:"def:salam" },
      { ar:"قلب",  fr:"Cœur",        translit:"QALB",   id:"def:qalb" }
    ];
  }

  /* =========================================================
     AFFICHER LA QUESTION
     ========================================================= */
  function renderQuestion() {
    const q = questions[currentIdx];
    if (!q) {
      renderEmpty();
      return;
    }

    const numEl = document.getElementById("quizNum");
    const totalEl = document.getElementById("quizTotal");
    if (numEl) numEl.textContent = currentIdx + 1;
    if (totalEl) totalEl.textContent = questions.length;

    const rewardEl = document.getElementById("quizReward");
    if (rewardEl) {
      const isPremium = window.State && window.State.get("isPremium");
      rewardEl.textContent = isPremium ? "+20 XP" : "+10 XP";
    }

    // Question : adapter le style selon le type
    const qAr = document.getElementById("quizQuestion");
    const qFr = document.getElementById("quizQuestionFr");

    if (qAr) {
      qAr.textContent = q.questionAr;
      if (q.questionStyle === "translit") {
        qAr.style.fontFamily = "'Cinzel', serif";
        qAr.style.fontSize = "32px";
        qAr.style.letterSpacing = "4px";
        qAr.style.direction = "ltr";
        qAr.style.color = "var(--gold-light)";
        qAr.style.background = "none";
        qAr.style.webkitTextFillColor = "var(--gold-light)";
      } else {
        qAr.style.fontFamily = "";
        qAr.style.fontSize = "";
        qAr.style.letterSpacing = "";
        qAr.style.direction = "";
        qAr.style.color = "";
        qAr.style.background = "";
        qAr.style.webkitTextFillColor = "";
      }
    }
    if (qFr) {
      qFr.textContent = q.questionFr;
      qFr.style.direction = "ltr";
    }

    // Réponses : adapter le style
    const ansContainer = document.getElementById("quizAnswers");
    if (!ansContainer) return;

    ansContainer.innerHTML = "";
    q.choices.forEach(function(choice, i) {
      const btn = document.createElement("button");
      btn.className = "answer";
      btn.type = "button";
      btn.textContent = choice;

      if (q.choicesStyle === "arabic") {
        btn.style.fontFamily = "'Amiri', serif";
        btn.style.fontSize = "26px";
        btn.style.fontWeight = "700";
        btn.style.direction = "rtl";
      } else {
        btn.style.direction = "ltr";
      }

      btn.setAttribute("data-action", "quiz-pick");
      btn.setAttribute("data-pick-index", i);
      ansContainer.appendChild(btn);
    });

    selectedAnswer = -1;
    answered = false;

    const nextBtn = document.getElementById("quizNextBtn");
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = "Vérifier";
    }
  }

  function renderEmpty() {
    const qAr = document.getElementById("quizQuestion");
    const qFr = document.getElementById("quizQuestionFr");
    if (qAr) qAr.textContent = "—";
    if (qFr) qFr.textContent = "Pas assez d'éléments pour un quiz. Apprenez d'abord du contenu.";
    const ansContainer = document.getElementById("quizAnswers");
    if (ansContainer) ansContainer.innerHTML = "";
    inSession = false;
  }

  /* =========================================================
     PICK / NEXT
     ========================================================= */
  function pickAnswer(i) {
    if (answered) return;
    selectedAnswer = i;

    document.querySelectorAll("#quizAnswers .answer").forEach(function(btn, idx) {
      btn.classList.toggle("selected", idx === i);
    });

    const nextBtn = document.getElementById("quizNextBtn");
    if (nextBtn) nextBtn.disabled = false;
  }

  function nextOrCheck() {
    if (!inSession) return;

    if (!answered) {
      if (selectedAnswer < 0) return;
      const q = questions[currentIdx];
      const isCorrect = selectedAnswer === q.correctIndex;

      document.querySelectorAll("#quizAnswers .answer").forEach(function(btn, idx) {
        btn.disabled = true;
        if (idx === q.correctIndex) btn.classList.add("correct");
        else if (idx === selectedAnswer) btn.classList.add("wrong");
      });

      answered = true;

      const stats = (window.State && window.State.get("stats")) || {};
      stats.totalQuizAnswered = (stats.totalQuizAnswered || 0) + 1;

      if (isCorrect) {
        correctCount++;
        stats.totalCorrect = (stats.totalCorrect || 0) + 1;
        if (window.XP) window.XP.gainQCMCorrect();
        if (window.Audio) window.Audio.correct();
        if (window.State && q.wordId) {
          window.State.recordReview(q.wordId, true);
        }
      } else {
        if (window.Audio) window.Audio.wrong();
      }

      window.State && window.State.set("stats", stats);

      const nextBtn = document.getElementById("quizNextBtn");
      if (nextBtn) {
        nextBtn.textContent = currentIdx < questions.length - 1 ? "Suivant" : "Terminer";
      }
    } else {
      if (currentIdx < questions.length - 1) {
        currentIdx++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }
  }

  function finishQuiz() {
    inSession = false;

    const isPerfect = correctCount === questions.length;
    if (isPerfect) {
      const stats = (window.State && window.State.get("stats")) || {};
      stats.perfectQuizzes = (stats.perfectQuizzes || 0) + 1;
      window.State.set("stats", stats);
      if (window.XP) window.XP.checkBadges();
    }

    const msg = isPerfect
      ? "Quiz parfait ! " + correctCount + "/" + questions.length + " 🏆"
      : "Quiz terminé : " + correctCount + "/" + questions.length;

    if (window.Main && window.Main.toast) {
      window.Main.toast(msg);
    }

    const ctx = (window.State && window.State.get("learningContext")) || {};
    if (isPerfect && ctx.themeId && ctx.levelId && window.ThemesScreen) {
      window.ThemesScreen.markLevelCompleted(ctx.themeId, ctx.levelId);
    }

    if (window.Main) {
      setTimeout(function() {
        // Si on vient des lettres, retour à reading; sinon home
        if (ctx.source === "letters") {
          window.Main.goto("reading");
        } else {
          window.Main.goto("home");
        }
      }, 800);
    }
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  /* -------- API publique -------- */
  return {
    show: show,
    pickAnswer: pickAnswer,
    nextOrCheck: nextOrCheck
  };
})();

window.QuizScreen = QuizScreen;
console.log("✓ QuizScreen v2 chargé (mots + lettres)");
