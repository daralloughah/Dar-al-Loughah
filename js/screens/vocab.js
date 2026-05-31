/* =========================================================
   DAR AL LOUGHAH — SCREEN: VOCAB CARDS v3
   - Lit les mots depuis learningContext.words (nouveau format 5 étages)
   - Compatible avec ancien format (themes flat) + listes utilisateur
   - "Connu" → +1 XP + queue mini-quiz
   - Toutes les 3 cartes : mini-quiz de validation
   - Mot vraiment appris après 3 validations
   - NOUVEAU : bouton ⭐ "Réviser en priorité"
   ========================================================= */

const VocabScreen = (function() {

  let deck = [];
  let currentIndex = 0;
  let showingFront = true;
  let currentContext = null;

  let pendingValidation = [];
  let inMiniQuiz = false;
  let miniQuizQueue = [];
  let miniQuizCurrent = null;

  const CARDS_BEFORE_QUIZ = 3;

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    if (!window.State) return;

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

    // Tri : les mots à réviser en priorité d'abord
    deck = prioritizeDeck(deck);

    renderCard();
  }

  /* =========================================================
     CHARGER LE DECK (NOUVEAU — lit le vrai contenu)
     ========================================================= */
  async function loadDeckForContext(ctx) {
    // CAS 1 : Liste utilisateur
    if (ctx && ctx.source === "list" && ctx.listId) {
      const list = window.State.getList && window.State.getList(ctx.listId);
      if (list && list.words && list.words.length > 0) {
        return list.words.map(function(w) {
          return {
            id: w.id || "list:" + ctx.listId + ":" + w.ar,
            ar: w.ar,
            translit: w.translit || "",
            fr: w.fr,
            example: w.example || "",
            exFr: w.exampleFr || w.exFr || "",
            source: "list",
            sourceId: ctx.listId
          };
        });
      }
    }

    // CAS 2 : Nouveau format 5 étages — themes.js v2 a déjà fourni les mots
    if (ctx && Array.isArray(ctx.words) && ctx.words.length > 0) {
      const themeId = ctx.themeId || "theme";
      const subId = ctx.subThemeId || "sub";
      const lvlId = ctx.levelId || "lvl";
      return ctx.words.map(function(w, i) {
        return {
          id: w.id || (themeId + ":" + subId + ":" + lvlId + ":" + i),
          ar: w.ar || "",
          translit: w.translit || w.tr || "",
          fr: w.fr || "",
          example: w.example || w.ex || "",
          exFr: w.exFr || w.exampleFr || "",
          source: "theme",
          themeId: themeId,
          subThemeId: subId,
          levelId: lvlId
        };
      });
    }

    // CAS 3 : Fallback — relit directement depuis Supabase au cas où learningContext est incomplet
    if (ctx && ctx.themeId && window.FB) {
      try {
        const theme = await window.FB.getDocument("themes", ctx.themeId);
        if (theme) {
          // Nouveau format
          if (Array.isArray(theme.subThemes) && theme.subThemes.length > 0) {
            const sub = ctx.subThemeId
              ? theme.subThemes.find(function(s){ return s.id === ctx.subThemeId; })
              : theme.subThemes[0];
            if (sub && Array.isArray(sub.customLevels)) {
              const lvl = ctx.levelId
                ? sub.customLevels.find(function(l){ return l.id === ctx.levelId; })
                : sub.customLevels[0];
              if (lvl && Array.isArray(lvl.words) && lvl.words.length > 0) {
                return lvl.words.map(function(w, i) {
                  return {
                    id: w.id || (theme._id + ":" + sub.id + ":" + lvl.id + ":" + i),
                    ar: w.ar || "",
                    translit: w.translit || w.tr || "",
                    fr: w.fr || "",
                    example: w.example || w.ex || "",
                    exFr: w.exFr || w.exampleFr || "",
                    source: "theme",
                    themeId: theme._id,
                    subThemeId: sub.id,
                    levelId: lvl.id
                  };
                });
              }
            }
          }
          // Ancien format (compatibilité)
          if (theme.levels) {
            const levelId = ctx.levelId || "debutant";
            const words = theme.levels[levelId] || [];
            if (words.length > 0) {
              return words.map(function(w, i) {
                return {
                  id: ctx.themeId + ":" + levelId + ":" + i,
                  ar: w.ar || "", translit: w.translit || w.tr || "",
                  fr: w.fr || "", example: w.example || w.ex || "",
                  exFr: w.exFr || w.exampleFr || "",
                  source: "theme", themeId: ctx.themeId, levelId: levelId
                };
              });
            }
          }
        }
      } catch (e) {
        console.warn("vocab.js fallback Supabase:", e.message);
      }
    }

    // CAS 4 : VRAIMENT rien → on retourne tableau vide (PAS de mots de démo)
    return [];
  }

  /* =========================================================
     PRIORISATION : mots marqués "à réviser en priorité" en premier
     ========================================================= */
  function prioritizeDeck(rawDeck) {
    if (!window.State) return rawDeck;
    const priorityIds = window.State.get("priorityWords") || {};
    const quizValidations = window.State.get("quizValidations") || {};

    // 3 groupes :
    // 1. Mots marqués prioritaires non encore maîtrisés
    // 2. Mots non maîtrisés
    // 3. Mots déjà maîtrisés (validations >= 3) — en fin
    const priority = [];
    const normal = [];
    const mastered = [];

    rawDeck.forEach(function(w) {
      const isMastered = (quizValidations[w.id] || 0) >= 3;
      const isPriority = !!priorityIds[w.id];
      if (isPriority && !isMastered) priority.push(w);
      else if (!isMastered) normal.push(w);
      else mastered.push(w);
    });

    // Si tout est maîtrisé : on retourne tout pour la révision libre
    if (priority.length === 0 && normal.length === 0) return mastered;
    return priority.concat(normal).concat(mastered);
  }

  /* =========================================================
     RENDU CARTE
     ========================================================= */
  function renderCard() {
    if (inMiniQuiz) return;
    const card = document.getElementById("vocabCard");
    if (!card) return;
    if (deck.length === 0) { renderEmpty(); return; }

    const word = deck[currentIndex];
    const showTranslit = window.State && window.State.get("settings.showTranslit") !== false;
    const quizValidations = (window.State && window.State.get("quizValidations")) || {};
    const validationCount = quizValidations[word.id] || 0;
    const priorityIds = (window.State && window.State.get("priorityWords")) || {};
    const isPriority = !!priorityIds[word.id];

    if (showingFront) {
      card.innerHTML =
        (isPriority ? '<div class="vocab-priority-badge">⭐ Priorité</div>' : '') +
        '<div class="word-ar">' + escapeHTML(word.ar) + '</div>' +
        (showTranslit && word.translit ? '<div class="transliter">' + escapeHTML(word.translit) + '</div>' : '') +
        '<div class="flip-hint">Touchez « Retourner la carte »</div>';
    } else {
      let html =
        (isPriority ? '<div class="vocab-priority-badge">⭐ Priorité</div>' : '') +
        '<div class="word-ar" style="font-size:32px">' + escapeHTML(word.ar) + '</div>' +
        (showTranslit && word.translit ? '<div class="transliter">' + escapeHTML(word.translit) + '</div>' : '') +
        '<div class="word-fr">' + escapeHTML(word.fr) + '</div>';

      if (word.example) html += '<div class="example">' + escapeHTML(word.example) + '</div>';
      if (word.exFr) html += '<div class="example-fr">' + escapeHTML(word.exFr) + '</div>';

      // Dots mastery
      let dotsHtml = '<div class="mastery-dots" style="justify-content:center; margin-top:8px;">';
      for (let i = 0; i < 3; i++) {
        dotsHtml += '<div class="dot' + (i < validationCount ? ' on' : '') + '" style="width:8px;height:8px;border-radius:50%;margin:0 2px;background:' + (i < validationCount ? 'var(--gold-light)' : 'rgba(212,175,55,0.2)') + ';"></div>';
      }
      dotsHtml += '</div>';
      dotsHtml += '<div style="text-align:center;font-family:Inter,sans-serif;font-size:10px;color:var(--ink-muted);letter-spacing:1px;margin-top:4px;">' + validationCount + ' / 3 validations</div>';

      // NOUVEAU : bouton "Réviser en priorité"
      dotsHtml += '<div style="text-align:center;margin-top:14px;">' +
        '<button class="vocab-priority-btn ' + (isPriority ? 'on' : '') + '" type="button" id="vocabPriorityBtn">' +
          (isPriority ? '⭐ Retirer de la priorité' : '⭐ Réviser en priorité') +
        '</button>' +
      '</div>';

      html += dotsHtml;
      card.innerHTML = html;

      // Bind bouton priorité
      const pb = document.getElementById("vocabPriorityBtn");
      if (pb) pb.onclick = function(e) {
        e.stopPropagation();
        togglePriority(word);
      };
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
      card.innerHTML = '<div style="text-align:center;padding:30px;color:var(--ink-muted);font-style:italic;">' +
        'Aucun mot dans ce niveau pour l\'instant.<br><br>' +
        '<small>Reviens à l\'écran Apprendre et choisis un niveau qui contient des mots.</small>' +
        '</div>';
    }
    const progressEl = document.getElementById("deckProgress");
    if (progressEl) progressEl.textContent = "0 / 0";
  }

  /* =========================================================
     BOUTON "RÉVISER EN PRIORITÉ"
     ========================================================= */
  function togglePriority(word) {
    if (!window.State) return;
    const priorityIds = window.State.get("priorityWords") || {};
    if (priorityIds[word.id]) {
      delete priorityIds[word.id];
      if (window.Main && window.Main.toast) window.Main.toast("Retiré de la priorité");
    } else {
      priorityIds[word.id] = Date.now();
      if (window.Main && window.Main.toast) window.Main.toast("⭐ Sera révisé en priorité");
    }
    window.State.set("priorityWords", priorityIds);
    renderCard();
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
     RÉVISION : Connu / À revoir
     ========================================================= */
  function review(isKnown) {
    if (inMiniQuiz || deck.length === 0) return;
    const word = deck[currentIndex];

    if (isKnown) {
      const _tid = currentContext && currentContext.themeId;
      if (window.XP) window.XP.addXP(1, { reason: "Engagement vocab", themeId: _tid || null });
      if (window.Audio) window.Audio.tap();

      pendingValidation.push(word);

      if (pendingValidation.length >= CARDS_BEFORE_QUIZ) {
        startMiniQuiz();
        return;
      }
    } else {
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
     MINI-QUIZ DE VALIDATION
     ========================================================= */
  function startMiniQuiz() {
    if (pendingValidation.length === 0) return;
    inMiniQuiz = true;
    miniQuizQueue = pendingValidation.slice();
    pendingValidation = [];
    askNextMiniQuestion();
  }

  function askNextMiniQuestion() {
    if (miniQuizQueue.length === 0) { endMiniQuiz(); return; }
    const word = miniQuizQueue.shift();
    miniQuizCurrent = word;

    const wrongs = deck.filter(function(w) { return w.id !== word.id && w.fr; });
    const wrongChoices = shuffleArray(wrongs).slice(0, 3);

    // Si pas assez de distracteurs dans le deck, on prend des mots génériques
    if (wrongChoices.length < 3) {
      const fallback = [
        { id: "fb1", fr: "Maison" },
        { id: "fb2", fr: "Livre" },
        { id: "fb3", fr: "Eau" },
        { id: "fb4", fr: "Soleil" }
      ];
      while (wrongChoices.length < 3) {
        const f = fallback[wrongChoices.length];
        if (f && f.fr !== word.fr) wrongChoices.push(f);
        else break;
      }
    }

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
      '<div style="text-align:center;padding:8px 0;">' +
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
    const progressEl = document.getElementById("deckProgress");
    if (progressEl) progressEl.textContent = "Validation des mots vus";
  }

  function pickMiniAnswer(pickedIndex) {
    if (!miniQuizCurrent) return;
    const isCorrect = pickedIndex === miniQuizCurrent._correctIndex;
    const word = miniQuizCurrent;

    document.querySelectorAll("#vocabMiniQuizAnswers .answer").forEach(function(btn, idx) {
      btn.disabled = true;
      if (idx === miniQuizCurrent._correctIndex) btn.classList.add("correct");
      else if (idx === pickedIndex) btn.classList.add("wrong");
    });

    const _themeId = currentContext && currentContext.themeId;
    if (isCorrect) {
      if (window.XP) window.XP.gainQCMCorrect(_themeId || null);
      if (window.Audio) window.Audio.correct();

      const validations = (window.State && window.State.get("quizValidations")) || {};
      validations[word.id] = (validations[word.id] || 0) + 1;
      window.State.set("quizValidations", validations);

      if (validations[word.id] >= 3) {
        const learned = window.State.get("wordsLearned") || [];
        if (learned.indexOf(word.id) === -1) {
          learned.push(word.id);
          window.State.set("wordsLearned", learned);

          if (window.XP) window.XP.incrementWordCount(_themeId || null);
          if (window.Main && window.Main.toast) window.Main.toast("« " + word.fr + " » appris ✓");
          if (window.XP) window.XP.checkBadges();

          // Progression sous-thème + niveau (nouveau format)
          if (_themeId && currentContext) {
            const tp = window.State.get("themeProgress") || {};
            // Compatible nouveau format (themes.js v2)
            if (currentContext.subThemeId && currentContext.levelId) {
              const key = _themeId + "::" + currentContext.subThemeId + "::" + currentContext.levelId;
              if (!tp[key]) tp[key] = { wordsLearned: 0 };
              tp[key].wordsLearned = (tp[key].wordsLearned || 0) + 1;
            }
            // Ancien format (compatibilité)
            const themeData = tp[_themeId] || { completedLevels: [] };
            const levelKey = currentContext.levelId || "debutant";
            themeData[levelKey] = (themeData[levelKey] || 0) + 1;
            tp[_themeId] = themeData;
            window.State.set("themeProgress", tp);
          }

          // Retire automatiquement de la priorité quand appris
          const priorityIds = window.State.get("priorityWords") || {};
          if (priorityIds[word.id]) {
            delete priorityIds[word.id];
            window.State.set("priorityWords", priorityIds);
          }
        }
      }
    } else {
      if (window.Audio) window.Audio.wrong();
    }

    setTimeout(function() { askNextMiniQuestion(); }, 1200);
  }

  function endMiniQuiz() {
    inMiniQuiz = false;
    miniQuizCurrent = null;
    miniQuizQueue = [];
    if (window.Main && window.Main.toast) window.Main.toast("Validation terminée !");
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
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
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

  /* API publique */
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
console.log("✓ VocabScreen v3 (5 étages + priorité) chargé");
