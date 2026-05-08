/* =========================================================
   DAR AL LOUGHAH — SCREEN: RAPID REVIEW
   - Timer 30s avec anneau doré
   - Combo system (bonus XP progressif)
   - Badges Combo Maître / Foudre Pure
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

  const SESSION_DURATION = 30; // secondes
  const TIMER_RING_CIRCUMFERENCE = 326.7; // 2 × π × 52

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    if (!window.Api) return;

    pool = await buildPool();

    // Reset UI
    resetUI();

    // Bouton "Démarrer" visible
    const startBtn = document.getElementById("rapidStartBtn");
    if (startBtn) startBtn.style.display = "";

    // Timer initial
    updateTimerDisplay(SESSION_DURATION);
    updateTimerRing(1);

    // Combo caché
    const comboBadge = document.getElementById("comboBadge");
    if (comboBadge) comboBadge.hidden = true;

    // Question vide
    const qAr = document.getElementById("rapidQuestion");
    const qFr = document.getElementById("rapidQuestionFr");
    if (qAr) qAr.textContent = "—";
    if (qFr) qFr.textContent = "Appuyez sur Démarrer";

    const ans = document.getElementById("rapidAnswers");
    if (ans) ans.innerHTML = "";
  }

  /* =========================================================
     CONSTRUIRE LE POOL DE MOTS
     ========================================================= */
  async function buildPool() {
    const ctx = (window.State && window.State.get("learningContext")) || {};
    let words = [];

    // Liste perso
    if (ctx.source === "list" && ctx.listId) {
      const list = window.State.getList(ctx.listId);
      if (list && list.words.length > 0) {
        words = list.words.map(function(w) {
          return { ar: w.ar, fr: w.fr, id: w.id };
        });
      }
    }

    // Thème
    if (words.length === 0 && ctx.themeId) {
      const themeData = await window.Api.getTheme(ctx.themeId);
      if (themeData && themeData.levels) {
        const levelId = ctx.levelId || "debutant";
        const arr = themeData.levels[levelId] || [];
        words = arr.map(function(w, i) {
          return { ar: w.ar, fr: w.fr, id: ctx.themeId + ":" + levelId + ":" + i };
        });
      }
    }

    // Fallback
    if (words.length < 4) {
      words = words.concat([
        { ar:"نور",  fr:"Lumière", id:"def:nur" },
        { ar:"كتاب", fr:"Livre",   id:"def:kitab" },
        { ar:"ماء",  fr:"Eau",     id:"def:ma" },
        { ar:"شمس",  fr:"Soleil",  id:"def:shams" },
        { ar:"قمر",  fr:"Lune",    id:"def:qamar" },
        { ar:"صديق", fr:"Ami",     id:"def:sadiq" },
        { ar:"بيت",  fr:"Maison",  id:"def:bayt" },
        { ar:"حب",   fr:"Amour",   id:"def:hubb" },
        { ar:"سلام", fr:"Paix",    id:"def:salam" },
        { ar:"قلب",  fr:"Cœur",    id:"def:qalb" },
        { ar:"خبز",  fr:"Pain",    id:"def:khubz" },
        { ar:"يوم",  fr:"Jour",    id:"def:yawm" },
        { ar:"ليل",  fr:"Nuit",    id:"def:layl" }
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
        window.Main.toast("Pas assez de mots pour la révision rapide");
      }
      return;
    }

    inSession = true;
    timeLeft = SESSION_DURATION;
    combo = 0;
    bestCombo = 0;
    questionsAsked = 0;

    // UI
    const startBtn = document.getElementById("rapidStartBtn");
    if (startBtn) startBtn.style.display = "none";

    const comboBadge = document.getElementById("comboBadge");
    if (comboBadge) comboBadge.hidden = false;

    updateComboDisplay();
    updateTimerDisplay(timeLeft);
    updateTimerRing(1);

    // Première question
    nextQuestion();

    // Lancer le timer
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

    // Mélanger et choisir un mot correct + 3 distracteurs
    const shuffled = shuffleArray(pool);
    const correctWord = shuffled[0];
    const wrongs = shuffled.filter(function(w) { return w.ar !== correctWord.ar; }).slice(0, 3);
    const allChoices = shuffleArray(wrongs.concat([correctWord]));
    const correctIndex = allChoices.findIndex(function(w) { return w.ar === correctWord.ar; });

    currentQuestion = {
      questionAr: correctWord.ar,
      choices: allChoices.map(function(w) { return w.fr; }),
      correctIndex: correctIndex,
      wordId: correctWord.id
    };

    questionsAsked++;

    // Afficher
    const qAr = document.getElementById("rapidQuestion");
    const qFr = document.getElementById("rapidQuestionFr");
    if (qAr) qAr.textContent = correctWord.ar;
    if (qFr) qFr.textContent = "Que signifie ce mot ?";

    const ansContainer = document.getElementById("rapidAnswers");
    if (!ansContainer) return;

    ansContainer.innerHTML = "";
    currentQuestion.choices.forEach(function(choice, i) {
      const btn = document.createElement("button");
      btn.className = "answer";
      btn.type = "button";
      btn.textContent = choice;
      btn.setAttribute("data-action", "rapid-pick");
      btn.setAttribute("data-pick-index", i);
      ansContainer.appendChild(btn);
    });
  }

  /* =========================================================
     CHOIX DE RÉPONSE (instantané — pas de bouton vérifier)
     ========================================================= */
  function pickAnswer(i) {
    if (!inSession || !currentQuestion) return;

    const isCorrect = i === currentQuestion.correctIndex;

    // Marquer visuellement
    document.querySelectorAll("#rapidAnswers .answer").forEach(function(btn, idx) {
      btn.disabled = true;
      if (idx === currentQuestion.correctIndex) btn.classList.add("correct");
      else if (idx === i) btn.classList.add("wrong");
    });

    if (isCorrect) {
      combo++;
      if (combo > bestCombo) bestCombo = combo;

      // XP avec bonus combo
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

    // Question suivante après court délai
    setTimeout(function() {
      if (inSession) nextQuestion();
    }, 500);
  }

  /* =========================================================
     MISE À JOUR UI
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

    // Effet visuel selon le palier de combo
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
     FIN DE SESSION
     ========================================================= */
  function endSession() {
    if (timerHandle) {
      clearInterval(timerHandle);
      timerHandle = null;
    }
    inSession = false;

    // Mettre à jour le best combo dans les stats
    const stats = (window.State && window.State.get("stats")) || {};
    if (bestCombo > (stats.bestRapidCombo || 0)) {
      stats.bestRapidCombo = bestCombo;
      window.State.set("stats", stats);
      if (window.XP) window.XP.checkBadges();
    }

    // Afficher résumé
    const qAr = document.getElementById("rapidQuestion");
    const qFr = document.getElementById("rapidQuestionFr");
    if (qAr) qAr.textContent = "Terminé !";
    if (qFr) qFr.textContent = "Meilleur combo : ×" + bestCombo + " · Questions : " + questionsAsked;

    const ans = document.getElementById("rapidAnswers");
    if (ans) ans.innerHTML = "";

    // Re-afficher bouton démarrer pour rejouer
    const startBtn = document.getElementById("rapidStartBtn");
    if (startBtn) {
      startBtn.style.display = "";
      startBtn.textContent = "Recommencer";
    }

    // Toast
    if (window.Main && window.Main.toast) {
      let msg = "Session terminée — Combo max ×" + bestCombo;
      if (bestCombo >= 50) msg += " 🌩️ FOUDRE PURE !";
      else if (bestCombo >= 20) msg += " ⚡ Combo Maître !";
      else if (bestCombo >= 10) msg += " 🔥";
      window.Main.toast(msg);
    }
  }

  /* =========================================================
     QUITTER LA PAGE → ARRÊTER LE TIMER
     ========================================================= */
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
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
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
console.log("✓ RapidScreen chargé");
