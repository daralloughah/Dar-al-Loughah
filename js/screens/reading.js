/* =========================================================
   DAR AL LOUGHAH — SCREEN: READING (alphabet)
   - Affiche les 28 lettres
   - 4 formes par lettre (isolée, initiale, médiane, finale)
   - Mastery system (5 révisions par lettre)
   - Mots débloqués tous les 3-4 lettres
   ========================================================= */

const ReadingScreen = (function() {

  let lettersData = [];
  let currentLetterIndex = 0;
  const LETTER_REVIEWS_REQUIRED = 5;

  // Mots palier (composés UNIQUEMENT de lettres apprises)
  // Ordre des prérequis = position dans l'alphabet
  const MILESTONE_WORDS = [
    // Après ا ب ت ث ج ح
    { afterIndex: 5,  ar: "بحث", translit: "BAḤTH", fr: "Recherche",
      example: "بحث جيد", exFr: "Une bonne recherche", letters: ["alif","ba","ta","tha","jim","ha"] },
    // Après ا ب ت ث ج ح خ د ذ ر
    { afterIndex: 9,  ar: "بحر", translit: "BAḤR", fr: "Mer",
      example: "البحر جميل", exFr: "La mer est belle", letters: ["ba","ha","ra"] },
    // Après ا ب ت ث ج ح خ د ذ ر ز س ش ص ض
    { afterIndex: 14, ar: "شمس", translit: "SHAMS", fr: "Soleil",
      example: "شمس مشرقة", exFr: "Un soleil radieux", letters: ["shin","mim","sin"] },
    // Après ا ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن
    { afterIndex: 24, ar: "قلم", translit: "QALAM", fr: "Stylo",
      example: "قلم ذهبي", exFr: "Un stylo doré", letters: ["qaf","lam","mim"] },
    // Après les 28 lettres
    { afterIndex: 27, ar: "كتاب", translit: "KITĀB", fr: "Livre",
      example: "كتاب جميل", exFr: "Un beau livre", letters: ["kaf","ta","alif","ba"] }
  ];

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    if (!window.Api) return;

    lettersData = await window.Api.getLetters();

    if (!lettersData || lettersData.length === 0) {
      lettersData = []; // sera remplacé par fallback
    }

    // Définir la lettre courante = première non apprise
    currentLetterIndex = findNextUnlearnedIndex();

    renderLettersGrid();
    renderProgress();
    renderCurrentLetter();
    renderMilestone();
  }

  /* =========================================================
     PROGRESSION DE L'ALPHABET
     ========================================================= */
  function getLearnedLetters() {
    if (!window.State) return [];
    return window.State.get("lettersLearned") || [];
  }

  function findNextUnlearnedIndex() {
    const learned = getLearnedLetters();
    for (let i = 0; i < lettersData.length; i++) {
      if (!learned.includes(lettersData[i].id)) return i;
    }
    return 0; // Toutes apprises → revient au début pour révision
  }

  function renderProgress() {
    const learnedCount = getLearnedLetters().length;
    const total = lettersData.length || 28;
    const percent = Math.round((learnedCount / total) * 100);

    const fillEl = document.getElementById("alphabetFill");
    if (fillEl) {
      fillEl.style.width = percent + "%";
    }

    const learnedEl = document.getElementById("lettersLearned");
    if (learnedEl) {
      learnedEl.textContent = learnedCount;
    }

    // Prochain palier
    const nextEl = document.getElementById("nextMilestone");
    if (nextEl) {
      const nextMilestone = MILESTONE_WORDS.find(function(m) {
        return m.afterIndex >= learnedCount;
      });
      if (nextMilestone) {
        const remaining = (nextMilestone.afterIndex + 1) - learnedCount;
        nextEl.textContent = remaining > 0
          ? "Prochain palier dans " + remaining + " lettre" + (remaining > 1 ? "s" : "")
          : "Mot débloqué !";
      } else {
        nextEl.textContent = "Alphabet complet 🎉";
      }
    }
  }

  /* =========================================================
     GRILLE DE LETTRES
     ========================================================= */
  function renderLettersGrid() {
    const grid = document.getElementById("lettersGrid");
    if (!grid) return;

    grid.innerHTML = "";
    const learned = getLearnedLetters();

    lettersData.forEach(function(letter, index) {
      const cell = document.createElement("button");
      cell.className = "letter-cell";
      cell.type = "button";
      cell.setAttribute("data-action", "select-letter");
      cell.setAttribute("data-letter-index", index);

      const isLearned = learned.includes(letter.id);
      const isCurrent = index === currentLetterIndex;

      // Verrouillée si la précédente n'est pas apprise
      // (sauf la première et celles déjà apprises)
      const isLocked = !isLearned && index > 0 && !learned.includes(lettersData[index - 1].id) && index > getLearnedLetters().length;

      if (isLearned) cell.classList.add("learned");
      if (isCurrent) cell.classList.add("current");
      if (isLocked && !isCurrent) cell.classList.add("locked");

      cell.textContent = letter.ar || "•";

      grid.appendChild(cell);
    });
  }

  /* =========================================================
     CARTE LETTRE COURANTE (avec 4 formes)
     ========================================================= */
  function renderCurrentLetter() {
    const card = document.getElementById("readingCard");
    if (!card || lettersData.length === 0) return;

    const letter = lettersData[currentLetterIndex];
    if (!letter) return;

    const reviewKey = "letter:" + letter.id;
    const reviews = window.State ? window.State.getReviewCount(reviewKey) : 0;
    const learned = getLearnedLetters().includes(letter.id);

    // Calculer les 4 formes
    const forms = computeLetterForms(letter);

    let html =
      '<div class="letter-main">' + escapeHTML(letter.ar) + '</div>' +
      '<div class="letter-name">' + escapeHTML(letter.name || "") + " — son : " + escapeHTML(letter.sound || "") + '</div>' +
      '<div class="forms-grid">' +
        '<div class="form-cell"><div class="form-ar">' + forms.isolated + '</div><div class="form-label">Isolée</div></div>' +
        '<div class="form-cell"><div class="form-ar">' + forms.initial + '</div><div class="form-label">Initiale</div></div>' +
        '<div class="form-cell"><div class="form-ar">' + forms.medial + '</div><div class="form-label">Médiane</div></div>' +
        '<div class="form-cell"><div class="form-ar">' + forms.final + '</div><div class="form-label">Finale</div></div>' +
      '</div>';

    // Indicateur de mastery (5 dots)
    html += '<div class="mastery-dots" style="justify-content:center; margin-top:14px;">';
    for (let i = 0; i < LETTER_REVIEWS_REQUIRED; i++) {
      html += '<div class="dot' + (i < reviews ? ' on' : '') + '" style="width:8px; height:8px; border-radius:50%; margin:0 3px; background:' + (i < reviews ? 'var(--gold-light)' : 'rgba(212,175,55,0.2)') + ';"></div>';
    }
    html += '</div>';

    if (learned) {
      html += '<div style="margin-top:10px; color:var(--gold-light); font-family:Cinzel,serif; font-size:12px; letter-spacing:2px;">✓ MÉMORISÉE</div>';
    }

    card.innerHTML = html;
  }

  /* =========================================================
     CALCULER LES 4 FORMES D'UNE LETTRE
     (en utilisant les caractères Unicode arabes contextuels)
     ========================================================= */
  function computeLetterForms(letter) {
    const ar = letter.ar;

    // Lettres qui ne se lient pas à la suivante
    const nonConnecting = ["ا", "د", "ذ", "ر", "ز", "و"];

    // Liaison avec un caractère Zero-Width Joiner (U+200D)
    const ZWJ = "\u200D";

    let isolated = ar;
    let initial = nonConnecting.indexOf(ar) >= 0 ? ar : ar + ZWJ;
    let medial  = nonConnecting.indexOf(ar) >= 0 ? ZWJ + ar : ZWJ + ar + ZWJ;
    let final   = ZWJ + ar;

    return {
      isolated: escapeHTML(isolated),
      initial:  escapeHTML(initial),
      medial:   escapeHTML(medial),
      final:    escapeHTML(final)
    };
  }

  /* =========================================================
     MILESTONE (mot débloqué)
     ========================================================= */
  function renderMilestone() {
    const card = document.getElementById("milestoneCard");
    if (!card) return;

    const learnedCount = getLearnedLetters().length;
    const learnedSet = new Set(getLearnedLetters());

    // Trouver un mot dont TOUTES les lettres sont apprises ET qui n'a pas déjà été montré
    const seenMilestones = (window.State && window.State.get("seenMilestones")) || [];

    const available = MILESTONE_WORDS.filter(function(m) {
      // Toutes les lettres requises sont apprises
      const allLearned = m.letters.every(function(l) { return learnedSet.has(l); });
      const notSeen = !seenMilestones.includes(m.ar);
      return allLearned && notSeen;
    });

    if (available.length === 0) {
      card.hidden = true;
      return;
    }

    const word = available[0];
    card.hidden = false;

    // Mettre à jour les bindings
    document.querySelectorAll('[data-bind="milestone-ar"]').forEach(function(el) { el.textContent = word.ar; });
    document.querySelectorAll('[data-bind="milestone-translit"]').forEach(function(el) { el.textContent = word.translit; });
    document.querySelectorAll('[data-bind="milestone-fr"]').forEach(function(el) { el.textContent = word.fr; });

    card._currentMilestone = word;
  }

  /* =========================================================
     SÉLECTIONNER UNE LETTRE DANS LA GRILLE
     ========================================================= */
  function selectLetter(index) {
    const learned = getLearnedLetters();
    const isLocked = index > 0 &&
                     !learned.includes(lettersData[index].id) &&
                     !learned.includes(lettersData[index - 1].id) &&
                     index > learned.length;

    if (isLocked) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Apprends d'abord les lettres précédentes");
      }
      return;
    }

    currentLetterIndex = index;
    renderLettersGrid();
    renderCurrentLetter();
    speakCurrent();
  }

  /* =========================================================
     RÉVISION : marquer la lettre comme connue / à revoir
     ========================================================= */
  function review(isKnown) {
    if (lettersData.length === 0) return;

    const letter = lettersData[currentLetterIndex];
    if (!letter) return;

    const reviewKey = "letter:" + letter.id;

    if (window.State) {
      window.State.recordReview(reviewKey, isKnown);
    }

    // Si l'utilisateur a confirmé "mémorisée"
    if (isKnown) {
      const reviews = window.State ? window.State.getReviewCount(reviewKey) : 0;

      // Au seuil → la lettre est ajoutée à lettersLearned + XP
      if (reviews === LETTER_REVIEWS_REQUIRED) {
        const learned = getLearnedLetters();
        if (!learned.includes(letter.id)) {
          learned.push(letter.id);
          window.State.set("lettersLearned", learned);

          if (window.XP) {
            window.XP.gainLetterLearned();
            window.XP.checkBadges();
          }

          if (window.Main && window.Main.toast) {
            window.Main.toast("Lettre " + letter.name + " mémorisée ✓");
          }

          // Vérifier si un mot palier est débloqué
          checkMilestoneUnlock();
        }
      }
    }

    // Lettre suivante (si non encore mémorisée, on reste; sinon on passe)
    const learnedNow = getLearnedLetters();
    if (learnedNow.includes(letter.id)) {
      currentLetterIndex = findNextUnlearnedIndex();
    }

    // Re-render
    renderLettersGrid();
    renderProgress();
    renderCurrentLetter();
    renderMilestone();

    // Son
    if (window.Audio && isKnown) {
      window.Audio.tap();
    }
  }

  function checkMilestoneUnlock() {
    const learnedSet = new Set(getLearnedLetters());
    const seenMilestones = (window.State && window.State.get("seenMilestones")) || [];

    const newMilestone = MILESTONE_WORDS.find(function(m) {
      const allLearned = m.letters.every(function(l) { return learnedSet.has(l); });
      return allLearned && !seenMilestones.includes(m.ar);
    });

    if (newMilestone && window.Main && window.Main.toast) {
      window.Main.toast("Mot débloqué : " + newMilestone.ar + " — " + newMilestone.fr);
      if (window.Audio) window.Audio.badge();
    }
  }

  /* =========================================================
     APPRENDRE LE MOT MILESTONE
     ========================================================= */
  function learnMilestoneWord() {
    const card = document.getElementById("milestoneCard");
    if (!card || !card._currentMilestone) return;

    const word = card._currentMilestone;

    // Marquer comme vu
    const seen = (window.State && window.State.get("seenMilestones")) || [];
    if (!seen.includes(word.ar)) {
      seen.push(word.ar);
      window.State.set("seenMilestones", seen);
    }

    // Marquer le premier mot lu (badge)
    if (!window.State.get("firstWordRead")) {
      window.State.set("firstWordRead", true);
      if (window.XP) window.XP.checkBadges();
    }

    // XP
    if (window.XP) {
      window.XP.gainReadingMilestone();
    }

    // Ajouter à la liste "Mes premiers mots"
    if (window.State) {
      let firstList = (window.State.get("lists") || []).find(function(l) {
        return l.name === "Mes premiers mots";
      });
      if (!firstList) {
        firstList = window.State.createList("Mes premiers mots");
      }
      window.State.addWordToList(firstList.id, {
        ar: word.ar,
        translit: word.translit,
        fr: word.fr,
        example: word.example
      });
    }

    if (window.Main && window.Main.toast) {
      window.Main.toast("« " + word.ar + " » ajouté à Mes premiers mots ✓");
    }

    if (window.Audio) window.Audio.correct();

    // Re-render pour potentiellement afficher le suivant
    renderMilestone();
  }

  /* =========================================================
     PRONONCIATION
     ========================================================= */
  function speakCurrent() {
    if (!window.speechSynthesis || lettersData.length === 0) return;

    const letter = lettersData[currentLetterIndex];
    if (!letter || !letter.ar) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(letter.ar);
      utter.lang = "ar-SA";
      utter.rate = 0.7;
      utter.pitch = 1.0;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Erreur speak letter :", e);
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

  /* -------- API publique -------- */
  return {
    show: show,
    selectLetter: selectLetter,
    review: review,
    learnMilestoneWord: learnMilestoneWord,
    speakCurrent: speakCurrent
  };
})();

window.ReadingScreen = ReadingScreen;
console.log("✓ ReadingScreen chargé (alphabet 28 lettres + paliers)");
