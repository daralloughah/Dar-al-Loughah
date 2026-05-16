/* =========================================================
   DAR AL LOUGHAH — SCREEN: LISTS (personnelles) v3 cloud
   - Compatible Supabase (méthodes State.* async)
   - Loader durant les opérations
   - Mêmes actions UI, même apparence
   ========================================================= */

const ListsScreen = (function() {

  let currentListId = null;

  /* =========================================================
     SHOW : page principale des listes
     ========================================================= */
  async function show() {
    // Si on est connecté, on s'assure que les listes sont à jour depuis le cloud
    if (window.State && !window.State.isGuest() && window.State.loadUserLists) {
      if (window.Main && window.Main.showLoader) window.Main.showLoader();
      try {
        await window.State.loadUserLists();
      } catch (e) {
        console.warn("loadUserLists error:", e);
      }
      if (window.Main && window.Main.hideLoader) window.Main.hideLoader();
    }
    renderListsContainer();
  }

  function renderListsContainer() {
    const container = document.getElementById("listsContainer");
    if (!container) return;

    const lists = (window.State && window.State.get("lists")) || [];
    container.innerHTML = "";

    if (lists.length === 0) {
      container.innerHTML =
        '<div style="text-align:center; padding:18px; color:var(--ink-muted); font-family:\'Cormorant Garamond\',serif; font-style:italic;">' +
          'Aucune liste pour l\'instant.<br>Créez-en une ci-dessus pour commencer.' +
        '</div>';
      return;
    }

    lists.forEach(function(list) {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML =
        '<div style="flex:1; min-width:0;">' +
          '<div class="title">' + escapeHTML(list.name) + '</div>' +
          '<div class="meta">' + (list.words ? list.words.length : 0) + ' mot' + ((list.words && list.words.length > 1) ? 's' : '') + '</div>' +
        '</div>' +
        '<div class="actions">' +
          '<button data-action="open-list" data-list-id="' + list.id + '" type="button">Ouvrir</button>' +
          '<button class="del" data-action="delete-list" data-list-id="' + list.id + '" type="button">✕</button>' +
        '</div>';
      container.appendChild(item);
    });
  }

  /* =========================================================
     CRÉER UNE LISTE (async)
     ========================================================= */
  async function createList() {
    const input = document.getElementById("newListName");
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Donnez un nom à votre liste");
      }
      return;
    }

    if (!window.State) return;

    // Empêcher les doublons
    const lists = window.State.get("lists") || [];
    if (lists.some(function(l) { return l.name.toLowerCase() === name.toLowerCase(); })) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Une liste avec ce nom existe déjà");
      }
      return;
    }

    if (window.Main && window.Main.showLoader) window.Main.showLoader();
    try {
      const created = await window.State.createList(name);
      if (window.Main && window.Main.hideLoader) window.Main.hideLoader();

      if (!created) {
        if (window.Main && window.Main.toast) {
          window.Main.toast("Erreur lors de la création de la liste");
        }
        return;
      }

      input.value = "";
      if (window.Audio) window.Audio.correct();
      if (window.Main && window.Main.toast) {
        window.Main.toast("Liste « " + name + " » créée");
      }
      renderListsContainer();
    } catch (e) {
      if (window.Main && window.Main.hideLoader) window.Main.hideLoader();
      console.error("createList error:", e);
      if (window.Main && window.Main.toast) {
        window.Main.toast("Erreur : " + (e.message || "création impossible"));
      }
    }
  }

  /* =========================================================
     SUPPRIMER UNE LISTE (async)
     ========================================================= */
  function deleteList(listId) {
    if (!window.State) return;

    const list = window.State.getList(listId);
    if (!list) return;

    const doDelete = async function() {
      if (window.Main && window.Main.showLoader) window.Main.showLoader();
      try {
        await window.State.deleteList(listId);
        if (currentListId === listId) currentListId = null;
        renderListsContainer();
        if (window.Audio) window.Audio.tap();
      } catch (e) {
        console.error("deleteList error:", e);
        if (window.Main && window.Main.toast) {
          window.Main.toast("Erreur lors de la suppression");
        }
      }
      if (window.Main && window.Main.hideLoader) window.Main.hideLoader();
    };

    if (window.Main && window.Main.confirm) {
      window.Main.confirm(
        "Supprimer la liste",
        "Voulez-vous vraiment supprimer la liste « " + list.name + " » et tous ses mots ?",
        doDelete
      );
    } else {
      // Fallback : confirm natif
      if (confirm("Supprimer la liste « " + list.name + " » ?")) {
        doDelete();
      }
    }
  }

  /* =========================================================
     OUVRIR UNE LISTE (écran détail)
     ========================================================= */
  function openList(listId) {
    if (!window.State) return;
    const list = window.State.getList(listId);
    if (!list) return;

    currentListId = listId;

    const titleEl = document.getElementById("listDetailTitle");
    if (titleEl) titleEl.textContent = list.name;

    if (window.Main) window.Main.goto("list-detail");
  }

  /* =========================================================
     SHOW DÉTAIL
     ========================================================= */
  function showDetail() {
    if (!currentListId) return;
    renderListWords();
    clearAddForm();
  }

  function renderListWords() {
    const container = document.getElementById("listWords");
    if (!container || !currentListId || !window.State) return;

    const list = window.State.getList(currentListId);
    if (!list) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = "";

    if (!list.words || list.words.length === 0) {
      container.innerHTML =
        '<div style="text-align:center; padding:18px; color:var(--ink-muted); font-family:\'Cormorant Garamond\',serif; font-style:italic;">' +
          'Aucun mot dans cette liste.<br>Ajoutez-en un avec le formulaire ci-dessus.' +
        '</div>';
      return;
    }

    list.words.forEach(function(word) {
      const reviews = window.State.getReviewCount(word.id);
      const threshold = (window.CONFIG && window.CONFIG.WORD_MASTERY_REVIEWS) || 10;
      const mastered = reviews >= threshold;

      let dotsHTML = '<div class="mastery-dots">';
      for (let i = 0; i < threshold; i++) {
        dotsHTML += '<div class="dot' + (i < reviews ? ' on' : '') + '"></div>';
      }
      dotsHTML += '</div>';

      const row = document.createElement("div");
      row.className = "word-row";
      row.innerHTML =
        '<div class="word-body">' +
          '<div class="word-ar">' + escapeHTML(word.ar) + '</div>' +
          (word.translit ? '<div class="word-translit">' + escapeHTML(word.translit) + '</div>' : '') +
          '<div class="word-fr">' + escapeHTML(word.fr) + (mastered ? ' ✓' : '') + '</div>' +
          dotsHTML +
        '</div>' +
        '<div class="actions">' +
          '<button class="del" data-action="delete-word" data-word-id="' + word.id + '" type="button">✕</button>' +
        '</div>';
      container.appendChild(row);
    });
  }

  /* =========================================================
     AJOUTER UN MOT À LA LISTE COURANTE (async)
     ========================================================= */
  async function addWordToCurrentList() {
    if (!currentListId || !window.State) return;

    const arInput = document.getElementById("wordArInput");
    const trInput = document.getElementById("wordTranslitInput");
    const frInput = document.getElementById("wordFrInput");
    const exInput = document.getElementById("wordExampleInput");

    const ar = arInput ? arInput.value.trim() : "";
    const translit = trInput ? trInput.value.trim() : "";
    const fr = frInput ? frInput.value.trim() : "";
    const example = exInput ? exInput.value.trim() : "";

    if (!ar) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Le mot en arabe est requis");
      }
      return;
    }
    if (!fr) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("La traduction est requise");
      }
      return;
    }

    if (window.Main && window.Main.showLoader) window.Main.showLoader();
    try {
      const added = await window.State.addWordToList(currentListId, {
        ar: ar, translit: translit, fr: fr, example: example
      });
      if (window.Main && window.Main.hideLoader) window.Main.hideLoader();

      if (!added) {
        if (window.Main && window.Main.toast) {
          window.Main.toast("Erreur lors de l'ajout du mot");
        }
        return;
      }

      if (window.Audio) window.Audio.correct();
      if (window.Main && window.Main.toast) {
        window.Main.toast("Mot ajouté ✓");
      }

      clearAddForm();
      renderListWords();
    } catch (e) {
      if (window.Main && window.Main.hideLoader) window.Main.hideLoader();
      console.error("addWordToCurrentList error:", e);
      if (window.Main && window.Main.toast) {
        window.Main.toast("Erreur : " + (e.message || "ajout impossible"));
      }
    }
  }

  function clearAddForm() {
    ["wordArInput", "wordTranslitInput", "wordFrInput", "wordExampleInput"].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  }

  /* =========================================================
     SUPPRIMER UN MOT (async)
     ========================================================= */
  async function deleteWord(wordId) {
    if (!currentListId || !window.State) return;

    try {
      await window.State.removeWordFromList(currentListId, wordId);
      if (window.Audio) window.Audio.tap();
      renderListWords();
    } catch (e) {
      console.error("deleteWord error:", e);
      if (window.Main && window.Main.toast) {
        window.Main.toast("Erreur lors de la suppression");
      }
    }
  }

  /* =========================================================
     SUPPRIMER LA LISTE COURANTE (depuis l'écran détail)
     ========================================================= */
  function deleteCurrentList() {
    if (!currentListId) return;
    deleteList(currentListId);
    if (window.Main) {
      setTimeout(function() { window.Main.goto("lists"); }, 100);
    }
  }

  /* =========================================================
     APPRENDRE LA LISTE (cartes, QCM, rapid)
     ========================================================= */
  function learnList(mode) {
    if (!currentListId || !window.State) return;

    const list = window.State.getList(currentListId);
    if (!list || !list.words || list.words.length === 0) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Ajoutez d'abord des mots à cette liste");
      }
      return;
    }

    if (mode === "qcm" && list.words.length < 4) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Le QCM nécessite au moins 4 mots");
      }
      return;
    }
    if (mode === "rapid" && list.words.length < 4) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("La révision rapide nécessite au moins 4 mots");
      }
      return;
    }

    // Mémoriser le contexte d'apprentissage
    window.State.update({
      learningContext: {
        source: "list",
        listId: currentListId,
        listName: list.name
      }
    });

    // Mettre à jour le titre du contexte
    document.querySelectorAll('[data-bind="vocab-context"]').forEach(function(el) {
      el.textContent = list.name;
    });

    // Naviguer
    if (window.Main) {
      switch (mode) {
        case "cards": window.Main.goto("vocab"); break;
        case "qcm":   window.Main.goto("quiz");  break;
        case "rapid": window.Main.goto("rapid"); break;
        default:      window.Main.goto("vocab");
      }
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

  function getCurrentListId() { return currentListId; }
  function setCurrentListId(id) { currentListId = id; }

  /* -------- API publique -------- */
  return {
    show: show,
    showDetail: showDetail,
    createList: createList,
    deleteList: deleteList,
    openList: openList,
    addWordToCurrentList: addWordToCurrentList,
    deleteWord: deleteWord,
    deleteCurrentList: deleteCurrentList,
    learnList: learnList,
    getCurrentListId: getCurrentListId,
    setCurrentListId: setCurrentListId
  };
})();

window.ListsScreen = ListsScreen;
console.log("ListsScreen (cloud-ready) chargé");
