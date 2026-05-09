/* =========================================================
   DAR AL LOUGHAH — SCREEN: READING (v2 avec anti-triche)
   - 28 lettres avec 4 formes
   - Mastery system : "Mémorisée" donne +2 XP, mini-quiz toutes les 3 lettres
   - Mini-quiz : lettre↔translit (4 choix), 3 validations pour mastery
   - QCM dédié aux lettres apprises
   - Révision rapide adaptée aux lettres
   - Mots débloqués tous les 3-4 lettres apprises
   ========================================================= */

const ReadingScreen = (function() {

  let lettersData = [];
  let currentLetterIndex = 0;
  const ENGAGEMENT_XP = 2;          // XP au clic "mémorisée"
  const MINI_VALIDATION_XP = 15;    // XP par validation correcte
  const VALIDATIONS_REQUIRED = 3;   // 3 validations pour vraiment apprendre
  const CARDS_BEFORE_MINIQUIZ = 3;  // mini-quiz toutes les 3 lettres

  // Anti-triche : queue des lettres en attente de validation
  let pendingValidation = [];
  let inMiniQuiz = false;
  let miniQuizQueue = [];
  let miniQuizCurrent = null;

  // Mots palier (composés UNIQUEMENT de lettres apprises)
  const MILESTONE_WORDS = [
    { afterIndex: 5,  ar: "بحث", translit: "BAḤTH", fr: "Recherche", example: "بحث جيد", exFr: "Une bonne recherche", letters: ["alif","ba","ta","tha","jim","ha"] },
    { afterIndex: 9,  ar: "بحر", translit: "BAḤR", fr: "Mer", example: "البحر جميل", exFr: "La mer est belle", letters: ["ba","ha","ra"] },
    { afterIndex: 14, ar: "شمس", translit: "SHAMS", fr: "Soleil", example: "شمس مشرقة", exFr: "Un soleil radieux", letters: ["shin","mim","sin"] },
    { afterIndex: 24, ar: "قلم", translit: "QALAM", fr: "Stylo", example: "قلم ذهبي", exFr: "Un stylo doré", letters: ["qaf","lam","mim"] },
    { afterIndex: 27, ar: "كتاب", translit: "KITĀB", fr: "Livre", example: "كتاب جميل", exFr: "Un beau livre", letters: ["kaf","ta","alif","ba"] }
  ];

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    if (!window.Api) return;

    lettersData = await window.Api.getLetters();
    if (!lettersData || lettersData.length === 0) lettersData = [];

    currentLetterIndex = findNextUnlearnedIndex();
    pendingValidation = [];
    inMiniQuiz = false;
    miniQuizQueue = [];
    miniQuizCurrent = null;

    // Cacher la mini-quiz card par défaut
    const miniCard = document.getElementById("letterMiniQuizCard");
    if (miniCard) miniCard.hidden = true;

    renderLettersGrid();
    renderProgress();
    renderCurrentLetter();
    renderMilestone();
    refreshTrainingActions();
  }

  /* =========================================================
     UTILS — LETTRES APPRISES
     ========================================================= */
  function getLearnedLetters() {
    if (!window.State) return [];
    return window.State.get("lettersLearned") || [];
  }

  function getLetterValidations() {
    if (!window.State) return {};
    return window.State.get("letterValidations") || {};
  }

  function findNextUnlearnedIndex() {
    const learned = getLearnedLetters();
    for (let i = 0; i < lettersData.length; i++) {
      if (!learned.includes(lettersData[i].id)) return i;
    }
    return 0;
  }

  /* =========================================================
     PROGRESSION
     ========================================================= */
  function renderProgress() {
    const learnedCount = getLearnedLetters().length;
    const total = lettersData.length || 28;
    const percent = Math.round((learnedCount / total) * 100);

    const fillEl = document.getElementById("alphabetFill");
    if (fillEl) fillEl.style.width = percent + "%";

    const learnedEl = document.getElementById("lettersLearned");
    if (learnedEl) learnedEl.textContent = learnedCount;

    const nextEl = document.getElementById("nextMilestone");
    if (nextEl) {
      const nextMilestone = MILESTONE_WORDS.find(function(m) { return m.afterIndex >= learnedCount; });
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
      const isLocked = !isLearned && index > 0 && !learned.includes(lettersData[index - 1].id) && index > getLearnedLetters().length;

      if (isLearned) cell.classList.add("learned");
      if (isCurrent) cell.classList.add("current");
      if (isLocked && !isCurrent) cell.classList.add("locked");

      cell.textContent = letter.ar || "•";
      grid.appendChild(cell);
    });
  }

  /* =========================================================
     CARTE LETTRE COURANTE
     ========================================================= */
  function renderCurrentLetter() {
    const card = document.getElementById("readingCard");
    if (!card || lettersData.length === 0) return;

    const letter = lettersData[currentLetterIndex];
    if (!letter) return;

    const validations = getLetterValidations();
    const validationCount = validations[letter.id] || 0;
    const learned = getLearnedLetters().includes(letter.id);

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

    // Indicateur de validations (3 dots)
    html += '<div class="mastery-dots" style="justify-content:center; margin-top:14px;">';
    for (let i = 0; i < VALIDATIONS_REQUIRED; i++) {
      html += '<div class="dot' + (i < validationCount ? ' on' : '') + '" style="width:8px; height:8px; border-radius:50%; margin:0 3px; background:' + (i < validationCount ? 'var(--gold-light)' : 'rgba(212,175,55,0.2)') + ';"></div>';
    }
    html += '</div>';
    html += '<div style="font-family:Inter,sans-serif; font-size:10px; color:var(--ink-muted); letter-spacing:1px; margin-top:4px;">' + validationCount + ' / ' + VALIDATIONS_REQUIRED + ' validations</div>';

    if (learned) {
      html += '<div style="margin-top:10px; color:var(--gold-light); font-family:Cinzel,serif; font-size:12px; letter-spacing:2px;">✓ MÉMORISÉE</div>';
    }

    card.innerHTML = html;
  }

  function computeLetterForms(letter) {
    const ar = letter.ar;
    const nonConnecting = ["ا", "د", "ذ", "ر", "ز", "و"];
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
     MILESTONE
     ========================================================= */
  function renderMilestone() {
    const card = document.getElementById("milestoneCard");
    if (!card) return;

    const learnedSet = new Set(getLearnedLetters());
    const seenMilestones = (window.State && window.State.get("seenMilestones")) || [];

    const available = MILESTONE_WORDS.filter(function(m) {
      const allLearned = m.letters.every(function(l) { return learnedSet.has(l); });
      return allLearned && !seenMilestones.includes(m.ar);
    });

    if (available.length === 0) {
      card.hidden = true;
      return;
    }

    const word = available[0];
    card.hidden = false;

    document.querySelectorAll('[data-bind="milestone-ar"]').forEach(function(el) { el.textContent = word.ar; });
    document.querySelectorAll('[data-bind="milestone-translit"]').forEach(function(el) { el.textContent = word.translit; });
    document.querySelectorAll('[data-bind="milestone-fr"]').forEach(function(el) { el.textContent = word.fr; });

    card._currentMilestone = word;
  }

  /* =========================================================
     SÉLECTIONNER UNE LETTRE
     ========================================================= */
  function selectLetter(index) {
    if (inMiniQuiz) return;
    const learned = getLearnedLetters();
    const isLocked = index > 0 &&
                     !learned.includes(lettersData[index].id) &&
                     !learned.includes(lettersData[index - 1].id) &&
                     index > learned.length;

    if (isLocked) {
      if (window.Main && window.Main.toast) window.Main.toast("Apprends d'abord les lettres précédentes");
      return;
    }

    currentLetterIndex = index;
    renderLettersGrid();
    renderCurrentLetter();
    speakCurrent();
  }

  /* =========================================================
     RÉVISION : "Mémorisée" / "À revoir"
     ========================================================= */
  function review(isKnown) {
    if (inMiniQuiz) return;
    if (lettersData.length === 0) return;

    const letter = lettersData[currentLetterIndex];
    if (!letter) return;

    if (isKnown) {
      // Si déjà apprise, on passe à la suivante sans rien faire
      if (getLearnedLetters().includes(letter.id)) {
        nextLetter();
        return;
      }

      // +2 XP engagement
      if (window.XP) window.XP.addXP(ENGAGEMENT_XP, "Engagement lettre");
      if (window.Audio) window.Audio.tap();

      // Ajouter à la queue de validation
      pendingValidation.push(letter);

      if (pendingValidation.length >= CARDS_BEFORE_MINIQUIZ) {
        startMiniQuiz();
        return;
      }
    } else {
      if (window.Audio) window.Audio.tap();
    }

    nextLetter();
  }

  function nextLetter() {
    currentLetterIndex = findNextUnlearnedIndex();
    renderLettersGrid();
    renderProgress();
    renderCurrentLetter();
    renderMilestone();
  }

  /* =========================================================
     MINI-QUIZ DE VALIDATION (anti-triche)
     ========================================================= */
  function startMiniQuiz() {
    if (pendingValidation.length === 0) return;

    inMiniQuiz = true;
    miniQuizQueue = pendingValidation.slice();
    pendingValidation = [];

    // Cacher la carte normale, afficher la carte de mini-quiz
    const readingCard = document.getElementById("readingCard");
    const miniCard = document.getElementById("letterMiniQuizCard");
    if (readingCard) readingCard.style.display = "none";
    if (miniCard) miniCard.hidden = false;

    askNextMiniQuestion();
  }

  function askNextMiniQuestion() {
    if (miniQuizQueue.length === 0) {
      endMiniQuiz();
      return;
    }

    const letter = miniQuizQueue.shift();
    miniQuizCurrent = letter;

    // Choisir random : lettre→translit ou translit→lettre
    const askMode = Math.random() < 0.5 ? "letter-to-translit" : "translit-to-letter";

    // 3 distracteurs
    const otherLetters = lettersData.filter(function(l) { return l.id !== letter.id && l.sound; });
    const wrongChoices = shuffleArray(otherLetters).slice(0, 3);
    const allChoices = shuffleArray(wrongChoices.concat([letter]));
    const correctIndex = allChoices.findIndex(function(l) { return l.id === letter.id; });

    miniQuizCurrent._choices = allChoices;
    miniQuizCurrent._correctIndex = correctIndex;
    miniQuizCurrent._askMode = askMode;

    renderMiniQuizQuestion();
  }

  function renderMiniQuizQuestion() {
    const content = document.getElementById("letterMiniQuizContent");
    const titleEl = document.getElementById("letterMiniQuizTitle");
    if (!content || !miniQuizCurrent) return;

    if (titleEl) {
      titleEl.textContent = "VALIDATION — " + (miniQuizQueue.length + 1) + " RESTANT" + (miniQuizQueue.length > 0 ? "S" : "");
    }

    const letter = miniQuizCurrent;
    const askMode = letter._askMode;

    let html = "";

    if (askMode === "letter-to-translit") {
      // Affiche la lettre, demande la translit
      html += '<div class="letter-mini-prompt">' + escapeHTML(letter.ar) + '</div>';
      html += '<div class="letter-mini-question">Quel est son nom / son ?</div>';

      letter._choices.forEach(function(choice, i) {
        const txt = (choice.name || "") + (choice.sound ? " (" + choice.sound + ")" : "");
        html += '<button class="answer translit-answer" type="button" data-action="letter-mini-pick" data-pick-index="' + i + '">' + escapeHTML(txt) + '</button>';
      });
    } else {
      // Affiche la translit, demande la lettre
      const promptText = (letter.name || "") + (letter.sound ? " (" + letter.sound + ")" : "");
      html += '<div class="letter-mini-prompt-translit">' + escapeHTML(promptText) + '</div>';
      html += '<div class="letter-mini-question">Quelle est la lettre arabe correspondante ?</div>';

      letter._choices.forEach(function(choice, i) {
        html += '<button class="answer letter-answer" type="button" data-action="letter-mini-pick" data-pick-index="' + i + '">' + escapeHTML(choice.ar) + '</button>';
      });
    }

    content.innerHTML = html;
  }

  function pickMiniAnswer(pickedIndex) {
    if (!miniQuizCurrent) return;

    const isCorrect = pickedIndex === miniQuizCurrent._correctIndex;
    const letter = miniQuizCurrent;

    // Marquer visuellement
    document.querySelectorAll("#letterMiniQuizContent .answer").forEach(function(btn, idx) {
      btn.disabled = true;
      if (idx === miniQuizCurrent._correctIndex) btn.classList.add("correct");
      else if (idx === pickedIndex) btn.classList.add("wrong");
    });

    if (isCorrect) {
      if (window.XP) window.XP.addXP(MINI_VALIDATION_XP, "Validation lettre");
      if (window.Audio) window.Audio.correct();

      // Incrémenter validations
      const validations = getLetterValidations();
      validations[letter.id] = (validations[letter.id] || 0) + 1;
      window.State.set("letterValidations", validations);

      // 3 validations → vraiment apprise
      if (validations[letter.id] >= VALIDATIONS_REQUIRED) {
        const learned = getLearnedLetters();
        if (!learned.includes(letter.id)) {
          learned.push(letter.id);
          window.State.set("lettersLearned", learned);

          if (window.XP) {
            window.XP.gainLetterLearned();
            window.XP.checkBadges();
          }

          if (window.Main && window.Main.toast) {
            window.Main.toast("Lettre " + letter.name + " apprise ✓");
          }

          checkMilestoneUnlock();
        }
      }
    } else {
      if (window.Audio) window.Audio.wrong();
    }

    setTimeout(askNextMiniQuestion, 1200);
  }

  function endMiniQuiz() {
    inMiniQuiz = false;
    miniQuizCurrent = null;
    miniQuizQueue = [];

    // Restaurer l'affichage
    const readingCard = document.getElementById("readingCard");
    const miniCard = document.getElementById("letterMiniQuizCard");
    if (readingCard) readingCard.style.display = "";
    if (miniCard) miniCard.hidden = true;

    if (window.Main && window.Main.toast) {
      window.Main.toast("Validation terminée !");
    }

    // Re-render tout
    renderLettersGrid();
    renderProgress();
    renderCurrentLetter();
    renderMilestone();
    refreshTrainingActions();
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

    const seen = (window.State && window.State.get("seenMilestones")) || [];
    if (!seen.includes(word.ar)) {
      seen.push(word.ar);
      window.State.set("seenMilestones", seen);
    }

    if (!window.State.get("firstWordRead")) {
      window.State.set("firstWordRead", true);
      if (window.XP) window.XP.checkBadges();
    }

    if (window.XP) window.XP.gainReadingMilestone();

    if (window.State) {
      let firstList = (window.State.get("lists") || []).find(function(l) {
        return l.name === "Mes premiers mots";
      });
      if (!firstList) firstList = window.State.createList("Mes premiers mots");

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

    renderMilestone();
  }

  /* =========================================================
     LANCER LE QCM DES LETTRES (apprise) — vers screen-quiz
     ========================================================= */
  function launchLetterQuiz() {
    const learned = getLearnedLetters();
    if (learned.length < 4) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Apprends au moins 4 lettres pour le QCM");
      }
      return;
    }

    // Set le contexte d'apprentissage = "letters"
    if (window.State) {
      window.State.update({
        learningContext: {
          source: "letters",
          letterIds: learned.slice()
        }
      });
    }

    // Mettre à jour le titre du contexte
    document.querySelectorAll('[data-bind="vocab-context"]').forEach(function(el) {
      el.textContent = "Quiz des lettres";
    });

    if (window.Main) window.Main.goto("quiz");
  }

  function launchLetterRapid() {
    const learned = getLearnedLetters();
    if (learned.length < 4) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Apprends au moins 4 lettres pour la révision rapide");
      }
      return;
    }

    if (window.State) {
      window.State.update({
        learningContext: {
          source: "letters",
          letterIds: learned.slice()
        }
      });
    }

    if (window.Main) window.Main.goto("rapid");
  }

  function refreshTrainingActions() {
    const actionsPanel = document.getElementById("letterTrainingActions");
    if (!actionsPanel) return;
    const learned = getLearnedLetters();
    actionsPanel.style.opacity = learned.length >= 4 ? "1" : "0.4";
  }

  /* =========================================================
     PRONONCIATION
     ========================================================= */
  function speakCurrent() {
    if (!window.speechSynthesis || lettersData.length === 0) return;
    const letter = inMiniQuiz ? miniQuizCurrent : lettersData[currentLetterIndex];
    if (!letter || !letter.ar) return;

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(letter.ar);
      utter.lang = "ar-SA";
      utter.rate = 0.7;
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

  /* -------- API publique -------- */
  return {
    show: show,
    selectLetter: selectLetter,
    review: review,
    pickMiniAnswer: pickMiniAnswer,
    learnMilestoneWord: learnMilestoneWord,
    launchLetterQuiz: launchLetterQuiz,
    launchLetterRapid: launchLetterRapid,
    speakCurrent: speakCurrent
  };
})();

window.ReadingScreen = ReadingScreen;
console.log("✓ ReadingScreen v2 chargé (anti-triche + QCM lettres)");
