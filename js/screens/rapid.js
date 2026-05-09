/* =========================================================
   DAR AL LOUGHAH — SCREEN: RAPID REVIEW (v2 avec support lettres)
   - Timer 30s avec anneau doré
   - Combo system
   - Détection automatique : mots OU lettres
   - Pour les lettres : mélange avec mots palier quand 5+ lettres apprises
   - Bug fix : "Terminé !" en LTR (point d'exclamation à droite)
   ========================================================= */

const RapidScreen = (function() {

  let pool = [];
  let timerHandle = null;
  let timeLeft = 30;
  let combo = 0;
  let bestCombo = 0;
  let questionsAsked = 0;
  let inSession = false;
  let currentQuestion = null;
  let isLetterMode = false;

  const SESSION_DURATION = 30;
  const TIMER_RING_CIRCUMFERENCE = 326.7;

  // Mots palier (composés UNIQUEMENT de lettres apprises)
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

    const ctx = (window.State && window.State.get("learningContext")) || {};
    isLetterMode = ctx.source === "letters";

    pool = await buildPool(ctx);

    resetUI();

    const startBtn = document.getElementById("rapidStartBtn");
    if (startBtn) startBtn.style.display = "";

    updateTimerDisplay(SESSION_DURATION);
    updateTimerRing(1);

    const comboBadge = document.getElementById("comboBadge");
    if (comboBadge) comboBadge.hidden = true;

    const qAr = document.getElementById("rapidQuestion");
    const qFr = document.getElementById("rapidQuestionFr");
    if (qAr) {
      qAr.textContent = "—";
      qAr.style.direction = "";
      qAr.style.fontFamily = "";
    }
    if (qFr) {
      qFr.textContent = "Appuyez sur Démarrer";
      qFr.style.direction = "ltr";
    }

    const ans = document.getElementById("rapidAnswers");
    if (ans) ans.innerHTML = "";
  }

  /* =========================================================
     CONSTRUIRE LE POOL
     ========================================================= */
  async function buildPool(ctx) {
    // === MODE LETTRES ===
    if (ctx.source === "letters") {
      return await buildLetterPool(ctx);
    }

    // === MODE MOTS ===
    return await buildWordPool(ctx);
  }

  async function buildLetterPool(ctx) {
    const allLetters = await window.Api.getLetters();
    if (!allLetters) return [];

    const learnedIds = ctx.letterIds || [];
    const learnedLetters = allLetters.filter(function(l) { return learnedIds.includes(l.id); });
    if (learnedLetters.length < 4) return [];

    const items = learnedLetters.map(function(l) {
      return {
        type: "letter",
        ar: l.ar,
        translit: (l.name || "") + (l.sound ? " (" + l.sound + ")" : ""),
        fr: l.name || "",
        id: l.id
      };
    });

    // Si 5+ lettres apprises, ajouter les mots palier disponibles
    if (learnedLetters.length >= 5) {
      const learnedSet = new Set(learnedIds);
      MILESTONE_WORDS.forEach(function(m) {
        if (m.letters.every(function(letterId) { return learnedSet.has(letterId); })) {
          items.push({
            type: "word",
            ar: m.ar,
            translit: m.translit,
            fr: m.fr,
            id: "word:" + m.ar
          });
        }
      });
    }

    return items.filter(function(i) { return i.ar && i.translit; });
  }

  async function buildWordPool(ctx) {
    let words = [];

    if (ctx.source === "list" && ctx.listId) {
      const list = window.State.getList(ctx.listId);
      if (list && list.words.length > 0) {
        words = list.words.map(function(w) {
          return { type: "word", ar: w.ar, fr: w.fr, translit: w.translit, id: w.id };
        });
      }
    }

    if (words.length === 0 && ctx.themeId) {
      const themeData = await window.Api.getTheme(ctx.themeId);
      if (themeData && themeData.levels) {
        const levelId = ctx.levelId || "debutant";
        const arr = themeData.levels[levelId] || [];
        words = arr.map(function(w, i) {
          return { type: "word", ar: w.ar, fr: w.fr, translit: w.translit || "", id: ctx.themeId + ":" + levelId + ":" + i };
        });
      }
    }

    if (words.length < 4) {
      words = words.concat([
        { type:"word", ar:"نور",  fr:"Lumière", translit:"NŪR",   id:"def:nur" },
        { type:"word", ar:"كتاب", fr:"Livre",   translit:"KITĀB", id:"def:kitab" },
        { type:"word", ar:"ماء",  fr:"Eau",     translit:"MĀʾ",   id:"def:ma" },
        { type:"word", ar:"شمس",  fr:"Soleil",  translit:"SHAMS", id:"def:shams" },
        { type:"word", ar:"قمر",  fr:"Lune",    translit:"QAMAR", id:"def:qamar" },
        { type:"word", ar:"صديق", fr:"Ami",     translit:"ṢADĪQ", id:"def:sadiq" },
        { type:"word", ar:"بيت",  fr:"Maison",  translit:"BAYT",  id:"def:bayt" },
        { type:"word", ar:"حب",   fr:"Amour",   translit:"ḤUBB",  id:"def:hubb" }
      ]);
    }

    return words.filter(function(w) { return w.ar && w.fr; });
  }

  /* =========================================================
     DÉMARRER
     ========================================================= */
  function start() {
    if (inSession) return;
    if (pool.length < 4) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Pas assez d'éléments pour la révision rapide");
      }
      return;
    }

    inSession = true;
    timeLeft = SESSION_DURATION;
    combo = 0;
    bestCombo = 0;
    questionsAsked = 0;

    const startBtn = document.getElementById("rapidStartBtn");
    if (startBtn) startBtn.style.display = "none";

    const comboBadge = document.getElementById("comboBadge");
    if (comboBadge) comboBadge.hidden = false;

    updateComboDisplay();
    updateTimerDisplay(timeLeft);
    updateTimerRing(1);

    nextQuestion();

    if (timerHandle) clearInterval(timerHandle);
    timerHandle = setInterval(function() {
      timeLeft--;
      updateTimerDisplay(timeLeft);
      updateTimerRing(timeLeft / SESSION_DURATION);
      if (timeLeft <= 0) {
        endSession();
      }
    }, 1000);
  }

  /* =========================================================
     QUESTION SUIVANTE
     ========================================================= */
  function nextQuestion() {
    if (!inSession) return;

    const shuffled = shuffleArray(pool);
    const correctItem = shuffled[0];

    // Choisir random : afficher AR / demander translit (50%) ou inverse (50%)
    const askMode = Math.random() < 0.5 ? "ar-to-translit" : "translit-to-ar";

    const sameType = shuffled.filter(function(s) { return s.type === correctItem.type && s.id !== correctItem.id; });
    const wrongs = shuffleArray(sameType).slice(0, 3);

    // Pour les mots, on peut utiliser fr aussi (au lieu de translit)
    const useFr = correctItem.type === "word" && Math.random() < 0.5;

    const allChoices = shuffleArray(wrongs.concat([correctItem]));
    const correctIndex = allChoices.findIndex(function(c) { return c.id === correctItem.id; });

    let questionText, questionStyle, choices, choicesStyle;

    if (askMode === "ar-to-translit") {
      questionText = correctItem.ar;
      questionStyle = "arabic";
      if (useFr) {
        choices = allChoices.map(function(c) { return c.fr; });
      } else {
        choices = allChoices.map(function(c) { return c.translit; });
      }
      choicesStyle = "translit";
    } else {
      questionText = useFr ? correctItem.fr : correctItem.translit;
      questionStyle = "translit";
      choices = allChoices.map(function(c) { return c.ar; });
      choicesStyle = "arabic";
    }

    currentQuestion = {
      questionText: questionText,
      questionStyle: questionStyle,
      choices: choices,
      choicesStyle: choicesStyle,
      correctIndex: correctIndex,
      wordId: correctItem.id
    };

    questionsAsked++;

    // Affichage adapté
    const qAr = document.getElementById("rapidQuestion");
    const qFr = document.getElementById("rapidQuestionFr");

    if (qAr) {
      qAr.textContent = questionText;
      if (questionStyle === "translit") {
        qAr.style.fontFamily = "'Cinzel', serif";
        qAr.style.fontSize = "30px";
        qAr.style.letterSpacing = "3px";
        qAr.style.direction = "ltr";
      } else {
        qAr.style.fontFamily = "";
        qAr.style.fontSize = "";
        qAr.style.letterSpacing = "";
        qAr.style.direction = "";
      }
    }
    if (qFr) {
      qFr.textContent = isLetterMode
        ? (correctItem.type === "letter" ? "Quelle réponse correspond à cette lettre ?" : "Quelle réponse correspond à ce mot ?")
        : "Que signifie ce mot ?";
      qFr.style.direction = "ltr";
    }

    const ansContainer = document.getElementById("rapidAnswers");
    if (!ansContainer) return;

    ansContainer.innerHTML = "";
    currentQuestion.choices.forEach(function(choice, i) {
      const btn = document.createElement("button");
      btn.className = "answer";
      btn.type = "button";
      btn.textContent = choice;

      if (choicesStyle === "arabic") {
        btn.style.fontFamily = "'Amiri', serif";
        btn.style.fontSize = "24px";
        btn.style.fontWeight = "700";
        btn.style.direction = "rtl";
      } else {
        btn.style.direction = "ltr";
      }

      btn.setAttribute("data-action", "rapid-pick");
      btn.setAttribute("data-pick-index", i);
      ansContainer.appendChild(btn);
    });
  }

  /* =========================================================
     PICK ANSWER
     ========================================================= */
  function pickAnswer(i) {
    if (!inSession || !currentQuestion) return;

    const isCorrect = i === currentQuestion.correctIndex;

    document.querySelectorAll("#rapidAnswers .answer").forEach(function(btn, idx) {
      btn.disabled = true;
      if (idx === currentQuestion.correctIndex) btn.classList.add("correct");
      else if (idx === i) btn.classList.add("wrong");
    });

    if (isCorrect) {
      combo++;
      if (combo > bestCombo) bestCombo = combo;
      if (window.XP) window.XP.gainRapidCorrect(combo);
      if (window.Audio) window.Audio.correct();
      if (window.State && currentQuestion.wordId) {
        window.State.recordReview(currentQuestion.wordId, true);
      }
    } else {
      combo = 0;
      if (window.Audio) window.Audio.wrong();
    }

    updateComboDisplay();

    setTimeout(function() {
      if (inSession) nextQuestion();
    }, 500);
  }

  /* =========================================================
     UI UPDATE
     ========================================================= */
  function updateTimerDisplay(seconds) {
    const tEl = document.getElementById("timerVal");
    if (tEl) tEl.textContent = Math.max(0, seconds);
  }

  function updateTimerRing(percent) {
    const circle = document.getElementById("timerCircle");
    if (circle) {
      const offset = TIMER_RING_CIRCUMFERENCE * (1 - percent);
      circle.style.strokeDashoffset = offset;
    }
  }

  function updateComboDisplay() {
    const comboVal = document.getElementById("comboVal");
    if (comboVal) comboVal.textContent = combo;

    const comboBadge = document.getElementById("comboBadge");
    if (comboBadge) {
      if (combo >= 50) {
        comboBadge.style.background = "linear-gradient(180deg, #FF7A9A, #7A0F2A)";
        comboBadge.style.color = "#FFFCE0";
      } else if (combo >= 20) {
        comboBadge.style.background = "linear-gradient(180deg, #FCE89A, #A07A1C)";
        comboBadge.style.color = "#2a1d00";
      } else if (combo >= 10) {
        comboBadge.style.background = "linear-gradient(180deg, #F4D77A, #D4AF37)";
        comboBadge.style.color = "#2a1d00";
      } else {
        comboBadge.style.background = "";
        comboBadge.style.color = "";
      }
    }
  }

  function resetUI() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
    inSession = false;
    timeLeft = SESSION_DURATION;
    combo = 0;
    bestCombo = 0;
    questionsAsked = 0;
    currentQuestion = null;
  }

  /* =========================================================
     FIN DE SESSION (avec fix du point d'exclamation)
     ========================================================= */
  function endSession() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
    inSession = false;

    const stats = (window.State && window.State.get("stats")) || {};
    if (bestCombo > (stats.bestRapidCombo || 0)) {
      stats.bestRapidCombo = bestCombo;
      window.State.set("stats", stats);
      if (window.XP) window.XP.checkBadges();
    }

    // Affichage avec direction LTR forcée pour le point d'exclamation à droite
    const qAr = document.getElementById("rapidQuestion");
    const qFr = document.getElementById("rapidQuestionFr");
    if (qAr) {
      qAr.textContent = "Terminé !";
      qAr.style.direction = "ltr";
      qAr.style.fontFamily = "'Cormorant Garamond', serif";
      qAr.style.fontSize = "";
      qAr.style.letterSpacing = "";
    }
    if (qFr) {
      qFr.textContent = "Meilleur combo : ×" + bestCombo + " · Questions : " + questionsAsked;
      qFr.style.direction = "ltr";
    }

    const ans = document.getElementById("rapidAnswers");
    if (ans) ans.innerHTML = "";

    const startBtn = document.getElementById("rapidStartBtn");
    if (startBtn) {
      startBtn.style.display = "";
      startBtn.textContent = "Recommencer";
    }

    if (window.Main && window.Main.toast) {
      let msg = "Session terminée — Combo max ×" + bestCombo;
      if (bestCombo >= 50) msg += " 🌩️ FOUDRE PURE !";
      else if (bestCombo >= 20) msg += " ⚡ Combo Maître !";
      else if (bestCombo >= 10) msg += " 🔥";
      window.Main.toast(msg);
    }
  }

  function stop() {
    resetUI();
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
    start: start,
    pickAnswer: pickAnswer,
    stop: stop
  };
})();

window.RapidScreen = RapidScreen;
console.log("✓ RapidScreen v2 chargé (mots + lettres)");
