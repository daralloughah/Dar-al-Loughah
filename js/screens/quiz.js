/* =========================================================
   DAR AL LOUGHAH — SCREEN: QUIZ QCM
   - 10 questions à 4 choix
   - Feedback rouge/vert
   - XP + tracking stats
   - Badge "Quiz parfait" si 10/10
   ========================================================= */

const QuizScreen = (function() {

  let questions = [];
  let currentIdx = 0;
  let selectedAnswer = -1;
  let answered = false;
  let correctCount = 0;
  let inSession = false;

  const QUIZ_LENGTH = 10;

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
     CONSTRUIRE LES QUESTIONS
     - À partir du contexte (thème + niveau, ou liste)
     - Sinon : pool générique
     ========================================================= */
  async function buildQuestions() {
    const ctx = (window.State && window.State.get("learningContext")) || {};
    let pool = [];

    // Liste personnelle
    if (ctx.source === "list" && ctx.listId) {
      const list = window.State.getList(ctx.listId);
      if (list && list.words.length > 0) {
        pool = list.words.map(function(w) {
          return { ar: w.ar, fr: w.fr, translit: w.translit, id: w.id };
        });
      }
    }

    // Thème + niveau
    if (pool.length === 0 && ctx.themeId) {
      const themeData = await window.Api.getTheme(ctx.themeId);
      if (themeData && themeData.levels) {
        const levelId = ctx.levelId || "debutant";
        const words = themeData.levels[levelId] || [];
        pool = words.map(function(w, i) {
          return {
            ar: w.ar,
            fr: w.fr,
            translit: w.translit || w.tr,
            id: ctx.themeId + ":" + levelId + ":" + i
          };
        });
      }
    }

    // Fallback : pool générique
    if (pool.length < 4) {
      pool = pool.concat(getDefaultPool());
    }

    // Filtrer les mots avec une traduction valide
    pool = pool.filter(function(w) { return w.ar && w.fr; });

    if (pool.length < 4) return [];

    // Construire QUIZ_LENGTH questions à 4 choix
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
        translit: correctWord.translit || "",
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
      { ar:"قلب",  fr:"Cœur",        translit:"QALB",   id:"def:qalb" },
      { ar:"خبز",  fr:"Pain",        translit:"KHUBZ",  id:"def:khubz" },
      { ar:"باب",  fr:"Porte",       translit:"BĀB",    id:"def:bab" },
      { ar:"يوم",  fr:"Jour",        translit:"YAWM",   id:"def:yawm" },
      { ar:"ليل",  fr:"Nuit",        translit:"LAYL",   id:"def:layl" },
      { ar:"ولد",  fr:"Enfant",      translit:"WALAD",  id:"def:walad" },
      { ar:"بنت",  fr:"Fille",       translit:"BINT",   id:"def:bint" }
    ];
  }

  /* =========================================================
     AFFICHER LA QUESTION COURANTE
     ========================================================= */
  function renderQuestion() {
    const q = questions[currentIdx];
    if (!q) {
      renderEmpty();
      return;
    }

    // Numéro et total
    const numEl = document.getElementById("quizNum");
    const totalEl = document.getElementById("quizTotal");
    if (numEl) numEl.textContent = currentIdx + 1;
    if (totalEl) totalEl.textContent = questions.length;

    // Récompense
    const rewardEl = document.getElementById("quizReward");
    if (rewardEl) {
      const isPremium = window.State && window.State.get("isPremium");
      rewardEl.textContent = isPremium ? "+20 XP" : "+10 XP";
    }

    // Question
    const qAr = document.getElementById("quizQuestion");
    const qFr = document.getElementById("quizQuestionFr");
    if (qAr) qAr.textContent = q.questionAr;
    if (qFr) qFr.textContent = q.questionFr;

    // Réponses
    const ansContainer = document.getElementById("quizAnswers");
    if (!ansContainer) return;

    ansContainer.innerHTML = "";
    q.choices.forEach(function(choice, i) {
      const btn = document.createElement("button");
      btn.className = "answer";
      btn.type = "button";
      btn.textContent = choice;
      btn.setAttribute("data-action", "quiz-pick");
      btn.setAttribute("data-pick-index", i);
      ansContainer.appendChild(btn);
    });

    // Reset état
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
    if (qFr) qFr.textContent = "Pas assez de mots pour un quiz. Apprenez d'abord du vocabulaire dans un thème.";
    const ansContainer = document.getElementById("quizAnswers");
    if (ansContainer) ansContainer.innerHTML = "";
    inSession = false;
  }

  /* =========================================================
     SÉLECTIONNER UNE RÉPONSE
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

  /* =========================================================
     PASSER À LA QUESTION SUIVANTE / VÉRIFIER
     ========================================================= */
  function nextOrCheck() {
    if (!inSession) return;

    if (!answered) {
      // 1ère phase : vérifier la réponse
      if (selectedAnswer < 0) return;
      const q = questions[currentIdx];
      const isCorrect = selectedAnswer === q.correctIndex;

      // Marquer visuellement
      document.querySelectorAll("#quizAnswers .answer").forEach(function(btn, idx) {
        btn.disabled = true;
        if (idx === q.correctIndex) btn.classList.add("correct");
        else if (idx === selectedAnswer) btn.classList.add("wrong");
      });

      answered = true;

      // Stats
      const stats = (window.State && window.State.get("stats")) || {};
      stats.totalQuizAnswered = (stats.totalQuizAnswered || 0) + 1;

      if (isCorrect) {
        correctCount++;
        stats.totalCorrect = (stats.totalCorrect || 0) + 1;
        if (window.XP) window.XP.gainQCMCorrect();
        if (window.Audio) window.Audio.correct();
        // Enregistrer la révision réussie
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
      // 2ème phase : passer à la suivante ou terminer
      if (currentIdx < questions.length - 1) {
        currentIdx++;
        renderQuestion();
      } else {
        finishQuiz();
      }
    }
  }

  /* =========================================================
     FIN DU QUIZ
     ========================================================= */
  function finishQuiz() {
    inSession = false;

    // Quiz parfait ?
    const isPerfect = correctCount === questions.length;
    if (isPerfect) {
      const stats = (window.State && window.State.get("stats")) || {};
      stats.perfectQuizzes = (stats.perfectQuizzes || 0) + 1;
      window.State.set("stats", stats);
      if (window.XP) window.XP.checkBadges();
    }

    // Toast résumé
    const msg = isPerfect
      ? "Quiz parfait ! " + correctCount + "/" + questions.length + " 🏆"
      : "Quiz terminé : " + correctCount + "/" + questions.length;

    if (window.Main && window.Main.toast) {
      window.Main.toast(msg);
    }

    // Si tout le contexte (thème) est complété
    const ctx = (window.State && window.State.get("learningContext")) || {};
    if (isPerfect && ctx.themeId && ctx.levelId && window.ThemesScreen) {
      window.ThemesScreen.markLevelCompleted(ctx.themeId, ctx.levelId);
    }

    // Retour à l'accueil
    if (window.Main) {
      setTimeout(function() {
        window.Main.goto("home");
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
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
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
console.log("✓ QuizScreen chargé");
