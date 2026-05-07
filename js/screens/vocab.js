/* =========================================================
   DAR AL LOUGHAH — SCREEN: VOCAB CARDS
   Cartes flippables avec système de mastery (10 révisions)
   ========================================================= */

const VocabScreen = (function() {

  let deck = [];
  let currentIndex = 0;
  let showingFront = true;
  let currentContext = null;

  /* =========================================================
     SHOW : charger le deck en fonction du contexte
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
    renderCard();
  }

  /* =========================================================
     CHARGER LE BON DECK SELON LE CONTEXTE
     - Liste personnelle (ctx.source === "list")
     - Thème + niveau (ctx.themeId + ctx.levelId)
     - Aucun → fallback : mots du jour
     ========================================================= */
  async function loadDeckForContext(ctx) {
    // Liste personnelle
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

    // Thème + niveau
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

    // Fallback : un petit deck par défaut
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
     RENDU DE LA CARTE COURANTE
     ========================================================= */
  function renderCard() {
    const card = document.getElementById("vocabCard");
    if (!card) return;

    if (deck.length === 0) {
      renderEmpty();
      return;
    }

    const word = deck[currentIndex];
    const showTranslit = window.State && window.State.get("settings.showTranslit") !== false;

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

      if (word.example) {
        html += '<div class="example">' + escapeHTML(word.example) + '</div>';
      }
      if (word.exFr) {
        html += '<div class="example-fr">' + escapeHTML(word.exFr) + '</div>';
      }

      // Indicateur de mastery
      const reviews = window.State ? window.State.getReviewCount(word.id) : 0;
      const threshold = (window.CONFIG && window.CONFIG.WORD_MASTERY_REVIEWS) || 10;
      let dotsHtml = '<div class="mastery-dots" style="justify-content:center; margin-top:8px;">';
      for (let i = 0; i < threshold; i++) {
        dotsHtml += '<div class="dot' + (i < reviews ? ' on' : '') + '" style="width:8px; height:8px; border-radius:50%; margin: 0 2px; background:' + (i < reviews ? 'var(--gold-light)' : 'rgba(212,175,55,0.2)') + ';"></div>';
      }
      dotsHtml += '</div>';
      html += dotsHtml;

      card.innerHTML = html;
    }

    // Mettre à jour le compteur
    const progressEl = document.getElementById("deckProgress");
    if (progressEl) {
      progressEl.textContent = (currentIndex + 1) + " / " + deck.length;
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
     FLIP CARD
     ========================================================= */
  function flip() {
    if (deck.length === 0) return;
    showingFront = !showingFront;
    renderCard();
  }

  /* =========================================================
     RÉVISION : marquer la carte comme connue / à revoir
     ========================================================= */
  function review(isKnown) {
    if (deck.length === 0) return;

    const word = deck[currentIndex];

    // Enregistrer la révision
    if (window.State) {
      window.State.recordReview(word.id, isKnown);
    }

    // Donner de l'XP si connu
    if (isKnown && window.XP) {
      window.XP.gainWordKnown();

      // Si c'est dans un thème, enregistrer la progression
      if (word.source === "theme" && word.sourceId && window.ThemesScreen) {
        const tp = window.State.get("themeProgress") || {};
        const themeData = tp[word.sourceId] || { completedLevels: [] };
        const levelKey = word.levelId || "debutant";
        themeData[levelKey] = (themeData[levelKey] || 0) + 1;
        tp[word.sourceId] = themeData;
        window.State.set("themeProgress", tp);
      }
    }

    // Sons
    if (window.Audio) {
      if (isKnown) window.Audio.tap();
    }

    // Carte suivante
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
     PRONONCIATION VOCALE (Speech Synthesis)
     ========================================================= */
  function speakCurrent() {
    if (deck.length === 0) return;
    if (!window.speechSynthesis) {
      console.warn("Speech synthesis non supportée");
      return;
    }

    const word = deck[currentIndex];
    const text = word.ar || word.fr;
    if (!text) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = word.ar ? "ar-SA" : "fr-FR";
      utter.rate = 0.85;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Erreur speak :", e);
    }
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* =========================================================
     ACCESSEURS
     ========================================================= */
  function getDeck()         { return deck.slice(); }
  function getCurrentWord()  { return deck[currentIndex] || null; }
  function getCurrentIndex() { return currentIndex; }

  /* -------- API publique -------- */
  return {
    show: show,
    flip: flip,
    review: review,
    nextCard: nextCard,
    previousCard: previousCard,
    speakCurrent: speakCurrent,
    getDeck: getDeck,
    getCurrentWord: getCurrentWord,
    getCurrentIndex: getCurrentIndex
  };
})();

window.VocabScreen = VocabScreen;
console.log("✓ VocabScreen chargé");
