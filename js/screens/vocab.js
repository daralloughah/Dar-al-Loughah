/* =========================================================
   DAR AL LOUGHAH — SCREEN: VOCAB CARDS (anti-triche v2)
   - Cartes flippables
   - "Connu" donne juste +1 XP (engagement)
   - Toutes les 3 cartes : mini-quiz de validation
   - Bonne réponse au mini-quiz = +10 XP par mot
   - Mot vraiment appris après 3 validations en quiz
   ========================================================= */

const VocabScreen = (function() {

  let deck = [];
  let currentIndex = 0;
  let showingFront = true;
  let currentContext = null;

  // Anti-triche : suivi des 3 dernières cartes "connues"
  let pendingValidation = []; // mots cliqués "connu" en attente de mini-quiz
  let inMiniQuiz = false;
  let miniQuizQueue = [];
  let miniQuizCurrent = null;

  const CARDS_BEFORE_QUIZ = 3;

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    if (!window.State || !window.Api) return;

    const ctx = window.State.get("learningContext") || {};
    currentContext = ctx;

    deck = await loadDeckForContext(ctx);

    if (!deck || deck.length === 0) {
      renderEmpty();
      return;
    }

    currentIndex = 0;
    showingFront = true;
    pendingValidation = [];
    inMiniQuiz = false;
    miniQuizQueue = [];
    miniQuizCurrent = null;

    renderCard();
  }

  /* =========================================================
     CHARGER LE DECK
     ========================================================= */
  async function loadDeckForContext(ctx) {
    if (ctx && ctx.source === "list" && ctx.listId) {
      const list = window.State.getList(ctx.listId);
      if (list && list.words && list.words.length > 0) {
        return list.words.map(function(w) {
          return {
            id: w.id,
            ar: w.ar,
            translit: w.translit || "",
            fr: w.fr,
            example: w.example || "",
            exFr: w.exampleFr || "",
            source: "list",
            sourceId: ctx.listId
          };
        });
      }
    }

    if (ctx && ctx.themeId) {
      const themeData = await window.Api.getTheme(ctx.themeId);
      if (themeData && themeData.levels) {
        const levelId = ctx.levelId || "debutant";
        const words = themeData.levels[levelId] || [];
        if (words.length > 0) {
          return words.map(function(w, i) {
            return {
              id: ctx.themeId + ":" + levelId + ":" + i,
              ar: w.ar || "",
              translit: w.translit || w.tr || "",
              fr: w.fr || "",
              example: w.example || w.ex || "",
              exFr: w.exFr || w.exampleFr || "",
              source: "theme",
              sourceId: ctx.themeId,
              levelId: levelId
            };
          });
        }
      }
    }

    return getDefaultDeck();
  }

  function getDefaultDeck() {
    return [
      { id: "default:1", ar: "الحمد لله", translit: "AL-ḤAMDU LILLĀH", fr: "Louange à Dieu", example: "الحمد لله، كل شيء على ما يرام", exFr: "Dieu merci, tout va bien." },
      { id: "default:2", ar: "السلام عليكم", translit: "AS-SALĀMU ʿALAYKUM", fr: "Que la paix soit sur vous", example: "السلام عليكم يا أصدقائي", exFr: "Bonjour mes amis." },
      { id: "default:3", ar: "شكراً", translit: "SHUKRAN", fr: "Merci", example: "شكراً جزيلاً", exFr: "Merci beaucoup." },
      { id: "default:4", ar: "من فضلك", translit: "MIN FAḌLIK", fr: "S'il te plaît", example: "الماء من فضلك", exFr: "De l'eau s'il te plaît." },
      { id: "default:5", ar: "كيف حالك", translit: "KAYFA ḤĀLUK", fr: "Comment vas-tu ?", example: "كيف حالك اليوم ؟", exFr: "Comment vas-tu aujourd'hui ?" },
      { id: "default:6", ar: "صباح الخير", translit: "ṢABĀḤU L-KHAYR", fr: "Bonjour (matin)", example: "صباح الخير يا أمي", exFr: "Bonjour maman." },
      { id: "default:7", ar: "إن شاء الله", translit: "IN SHĀʾA LLĀH", fr: "Si Dieu le veut", example: "نلتقي غداً إن شاء الله", exFr: "À demain, si Dieu le veut." },
      { id: "default:8", ar: "مبروك", translit: "MABRŪK", fr: "Félicitations", example: "مبروك على النجاح", exFr: "Félicitations pour la réussite." }
    ];
  }

  /* =========================================================
     RENDU CARTE NORMALE
     ========================================================= */
  function renderCard() {
    if (inMiniQuiz) return; // protection

    const card = document.getElementById("vocabCard");
    if (!card) return;

    if (deck.length === 0) {
      renderEmpty();
      return;
    }

    const word = deck[currentIndex];
    const showTranslit = window.State && window.State.get("settings.showTranslit") !== false;

    // Compter combien de fois ce mot a été validé en mini-quiz
    const quizValidations = (window.State && window.State.get("quizValidations")) || {};
    const validationCount = quizValidations[word.id] || 0;

    if (showingFront) {
      card.innerHTML =
        '<div class="word-ar">' + escapeHTML(word.ar) + '</div>' +
        (showTranslit && word.translit ? '<div class="transliter">' + escapeHTML(word.translit) + '</div>' : '') +
        '<div class="flip-hint">Touchez « Retourner la carte »</div>';
    } else {
      let html =
        '<div class="word-ar" style="font-size:32px">' + escapeHTML(word.ar) + '</div>' +
        (showTranslit && word.translit ? '<div class="transliter">' + escapeHTML(word.translit) + '</div>' : '') +
        '<div class="word-fr">' + escapeHTML(word.fr) + '</div>';

      if (word.example) html += '<div class="example">' + escapeHTML(word.example) + '</div>';
      if (word.exFr) html += '<div class="example-fr">' + escapeHTML(word.exFr) + '</div>';

      // Indicateur de mastery réelle (validations en quiz)
      let dotsHtml = '<div class="mastery-dots" style="justify-content:center; margin-top:8px;">';
      const targetMastery = 3;
      for (let i = 0; i < targetMastery; i++) {
        dotsHtml += '<div class="dot' + (i < validationCount ? ' on' : '') + '" style="width:8px; height:8px; border-radius:50%; margin: 0 2px; background:' + (i < validationCount ? 'var(--gold-light)' : 'rgba(212,175,55,0.2)') + ';"></div>';
      }
      dotsHtml += '</div>';
      dotsHtml += '<div style="text-align:center; font-family:Inter,sans-serif; font-size:10px; color:var(--ink-muted); letter-spacing:1px; margin-top:4px;">' + validationCount + ' / 3 validations</div>';
      html += dotsHtml;

      card.innerHTML = html;
    }

    const progressEl = document.getElementById("deckProgress");
    if (progressEl) {
      const pendingTxt = pendingValidation.length > 0 ? ' · ' + pendingValidation.length + ' à valider' : '';
      progressEl.textContent = (currentIndex + 1) + ' / ' + deck.length + pendingTxt;
    }
  }

  function renderEmpty() {
    const card = document.getElementById("vocabCard");
    if (card) {
      card.innerHTML = '<div style="text-align:center; padding:30px; color:var(--ink-muted); font-style:italic;">Aucun mot dans ce deck. Ajoutez-en dans vos listes ou choisissez un autre thème.</div>';
    }
    const progressEl = document.getElementById("deckProgress");
    if (progressEl) progressEl.textContent = "0 / 0";
  }

  /* =========================================================
     FLIP
     ========================================================= */
  function flip() {
    if (inMiniQuiz || deck.length === 0) return;
    showingFront = !showingFront;
    renderCard();
  }

  /* =========================================================
     RÉVISION : "Connu" / "À revoir"
     - "Connu" → +1 XP + ajout en attente de mini-quiz
     - "À revoir" → 0 XP, juste passer à la suivante
     ========================================================= */
  function review(isKnown) {
    if (inMiniQuiz) return; // pendant un mini-quiz, ces boutons sont désactivés
    if (deck.length === 0) return;

    const word = deck[currentIndex];

    if (isKnown) {
      // +1 XP minimal pour engagement
      if (window.XP) window.XP.addXP(1, "Engagement vocab");
      if (window.Audio) window.Audio.tap();

      // Ajouter à la queue de validation
      pendingValidation.push(word);

      // Si on atteint 3 mots en attente, lancer le mini-quiz
      if (pendingValidation.length >= CARDS_BEFORE_QUIZ) {
        startMiniQuiz();
        return; // ne pas passer à la carte suivante encore
      }
    } else {
      // "À revoir" : pas de XP, pas de validation
      if (window.Audio) window.Audio.tap();
    }

    nextCard();
  }

  function nextCard() {
    if (deck.length === 0) return;
    currentIndex = (currentIndex + 1) % deck.length;
    showingFront = true;
    renderCard();
  }

  function previousCard() {
    if (deck.length === 0) return;
    currentIndex = (currentIndex - 1 + deck.length) % deck.length;
    showingFront = true;
    renderCard();
  }

  /* =========================================================
     MINI-QUIZ DE VALIDATION (anti-triche)
     ========================================================= */
  function startMiniQuiz() {
    if (pendingValidation.length === 0) return;

    inMiniQuiz = true;
    miniQuizQueue = pendingValidation.slice(); // copie
    pendingValidation = [];
    askNextMiniQuestion();
  }

  function askNextMiniQuestion() {
    if (miniQuizQueue.length === 0) {
      endMiniQuiz();
      return;
    }

    const word = miniQuizQueue.shift();
    miniQuizCurrent = word;

    // Construire 3 distracteurs depuis le deck
    const wrongs = deck.filter(function(w) { return w.id !== word.id && w.fr; });
    const wrongChoices = shuffleArray(wrongs).slice(0, 3);
    const allChoices = shuffleArray(wrongChoices.concat([word]));
    const correctIndex = allChoices.findIndex(function(w) { return w.id === word.id; });

    miniQuizCurrent._quizChoices = allChoices;
    miniQuizCurrent._correctIndex = correctIndex;

    renderMiniQuiz(word, allChoices, correctIndex);
  }

  function renderMiniQuiz(word, choices, correctIndex) {
    const card = document.getElementById("vocabCard");
    if (!card) return;

    let html =
      '<div style="text-align:center; padding:8px 0;">' +
        '<div class="panel-title" style="margin-bottom:14px;">VALIDATION — ' + (miniQuizQueue.length + 1) + ' restant' + (miniQuizQueue.length > 0 ? 's' : '') + '</div>' +
        '<div class="word-ar" style="font-size:36px;">' + escapeHTML(word.ar) + '</div>' +
        (word.translit ? '<div class="transliter">' + escapeHTML(word.translit) + '</div>' : '') +
        '<div class="quiz-question-fr" style="margin:14px 0 10px;">Que signifie ce mot ?</div>' +
      '</div>';

    html += '<div id="vocabMiniQuizAnswers">';
    choices.forEach(function(choice, i) {
      html += '<button class="answer" type="button" data-action="vocab-mini-pick" data-pick-index="' + i + '">' + escapeHTML(choice.fr) + '</button>';
    });
    html += '</div>';

    card.innerHTML = html;

    // Mettre à jour le compteur du bas
    const progressEl = document.getElementById("deckProgress");
    if (progressEl) {
      progressEl.textContent = "Validation des mots vus";
    }
  }

  function pickMiniAnswer(pickedIndex) {
    if (!miniQuizCurrent) return;

    const isCorrect = pickedIndex === miniQuizCurrent._correctIndex;
    const word = miniQuizCurrent;

    // Marquer visuellement
    document.querySelectorAll("#vocabMiniQuizAnswers .answer").forEach(function(btn, idx) {
      btn.disabled = true;
      if (idx === miniQuizCurrent._correctIndex) btn.classList.add("correct");
      else if (idx === pickedIndex) btn.classList.add("wrong");
    });

    if (isCorrect) {
      // +10 XP pour validation réussie
      if (window.XP) window.XP.gainQCMCorrect();
      if (window.Audio) window.Audio.correct();

      // Incrémenter compteur de validations
      const validations = (window.State && window.State.get("quizValidations")) || {};
      validations[word.id] = (validations[word.id] || 0) + 1;
      window.State.set("quizValidations", validations);

      // Au bout de 3 validations, le mot est vraiment "appris"
      if (validations[word.id] >= 3) {
        if (window.State && !window.State.get("wordsLearned").includes(word.id)) {
          const learned = window.State.get("wordsLearned") || [];
          learned.push(word.id);
          window.State.set("wordsLearned", learned);
          window.State.set("masteredWords", learned.length);

          if (window.Main && window.Main.toast) {
            window.Main.toast("« " + word.fr + " » appris ✓");
          }

          if (window.XP) window.XP.checkBadges();

          // Progression de thème
          if (word.source === "theme" && word.sourceId) {
            const tp = window.State.get("themeProgress") || {};
            const themeData = tp[word.sourceId] || { completedLevels: [] };
            const levelKey = word.levelId || "debutant";
            themeData[levelKey] = (themeData[levelKey] || 0) + 1;
            tp[word.sourceId] = themeData;
            window.State.set("themeProgress", tp);
          }
        }
      }
    } else {
      if (window.Audio) window.Audio.wrong();
      // Pas d'incrémentation de validation
    }

    // Passer à la question suivante après 1 seconde
    setTimeout(function() {
      askNextMiniQuestion();
    }, 1200);
  }

  function endMiniQuiz() {
    inMiniQuiz = false;
    miniQuizCurrent = null;
    miniQuizQueue = [];

    if (window.Main && window.Main.toast) {
      window.Main.toast("Validation terminée !");
    }

    // Reprendre le parcours normal
    nextCard();
  }

  /* =========================================================
     PRONONCIATION
     ========================================================= */
  function speakCurrent() {
    if (deck.length === 0 || !window.speechSynthesis) return;

    const word = inMiniQuiz ? miniQuizCurrent : deck[currentIndex];
    if (!word) return;

    const text = word.ar || word.fr;
    if (!text) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = word.ar ? "ar-SA" : "fr-FR";
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    } catch (e) {}
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function getDeck() { return deck.slice(); }
  function getCurrentWord() { return deck[currentIndex] || null; }
  function getCurrentIndex() { return currentIndex; }
  function isInMiniQuiz() { return inMiniQuiz; }

  /* -------- API publique -------- */
  return {
    show: show,
    flip: flip,
    review: review,
    nextCard: nextCard,
    previousCard: previousCard,
    speakCurrent: speakCurrent,
    pickMiniAnswer: pickMiniAnswer,
    isInMiniQuiz: isInMiniQuiz,
    getDeck: getDeck,
    getCurrentWord: getCurrentWord,
    getCurrentIndex: getCurrentIndex
  };
})();

window.VocabScreen = VocabScreen;
console.log("✓ VocabScreen chargé (anti-triche v2)");
