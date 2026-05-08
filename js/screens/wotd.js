/* =========================================================
   DAR AL LOUGHAH — SCREEN: WORD OF THE DAY
   - Mot du jour différent chaque jour
   - Prononciation vocale
   - Ajout à une liste auto "Mots du jour collectés"
   ========================================================= */

const WotdScreen = (function() {

  let currentWotd = null;

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    if (!window.Api) return;

    try {
      currentWotd = await window.Api.getWordOfTheDay();
      renderWotd();
    } catch (e) {
      console.warn("Impossible de charger le mot du jour :", e);
    }
  }

  /* =========================================================
     RENDU
     ========================================================= */
  function renderWotd() {
    if (!currentWotd) return;

    document.querySelectorAll('[data-bind="wotd-ar"]').forEach(function(el) {
      el.textContent = currentWotd.ar || "—";
    });
    document.querySelectorAll('[data-bind="wotd-translit"]').forEach(function(el) {
      el.textContent = currentWotd.translit || "";
    });
    document.querySelectorAll('[data-bind="wotd-fr"]').forEach(function(el) {
      el.textContent = currentWotd.fr || "—";
    });
    document.querySelectorAll('[data-bind="wotd-def"]').forEach(function(el) {
      el.textContent = currentWotd.def || "";
    });
    document.querySelectorAll('[data-bind="wotd-example-ar"]').forEach(function(el) {
      el.textContent = currentWotd.exAr || "";
    });
    document.querySelectorAll('[data-bind="wotd-example-fr"]').forEach(function(el) {
      el.textContent = currentWotd.exFr || "";
    });
  }

  /* =========================================================
     AJOUTER À UNE LISTE
     ========================================================= */
  function addToList() {
    if (!currentWotd || !window.State) return;

    // Trouver ou créer la liste "Mots du jour collectés"
    const listName = "Mots du jour collectés";
    const lists = window.State.get("lists") || [];
    let targetList = lists.find(function(l) { return l.name === listName; });

    if (!targetList) {
      targetList = window.State.createList(listName);
    }

    // Vérifier si déjà ajouté
    const alreadyAdded = targetList.words.some(function(w) {
      return w.ar === currentWotd.ar;
    });

    if (alreadyAdded) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Déjà dans votre liste");
      }
      return;
    }

    // Ajouter
    window.State.addWordToList(targetList.id, {
      ar: currentWotd.ar,
      translit: currentWotd.translit || "",
      fr: currentWotd.fr,
      example: currentWotd.exAr || ""
    });

    if (window.Audio) window.Audio.correct();
    if (window.Main && window.Main.toast) {
      window.Main.toast("Ajouté à « Mots du jour collectés » ✓");
    }
  }

  /* =========================================================
     PRONONCIATION
     ========================================================= */
  function speak() {
    if (!currentWotd || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(currentWotd.ar);
      utter.lang = "ar-SA";
      utter.rate = 0.85;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Erreur speak wotd :", e);
    }
  }

  /* -------- API publique -------- */
  return {
    show: show,
    addToList: addToList,
    speak: speak
  };
})();

window.WotdScreen = WotdScreen;
console.log("✓ WotdScreen chargé");
