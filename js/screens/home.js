/* =========================================================
   DAR AL LOUGHAH — SCREEN: HOME
   ========================================================= */

const HomeScreen = (function() {

  let initialized = false;

  /* =========================================================
     INIT (appelé une seule fois au chargement)
     ========================================================= */
  function init() {
    if (initialized) return;
    initialized = true;
  }

  /* =========================================================
     SHOW (appelé à chaque fois qu'on arrive sur l'écran)
     ========================================================= */
  async function show() {
    init();
    refreshStats();
    await loadDailyLesson();
  }

  /* =========================================================
     RAFRAÎCHIR LES STATS (XP, niveau, streak, pseudo)
     ========================================================= */
  function refreshStats() {
    if (!window.State) return;

    // Pseudo
    const pseudo = window.State.get("pseudo") || "Apprenti";
    document.querySelectorAll('[data-bind="pseudo"]').forEach(function(el) {
      el.textContent = pseudo;
    });

    // XP
    const xp = window.State.get("xp") || 0;
    document.querySelectorAll('[data-bind="xp"]').forEach(function(el) {
      el.textContent = xp.toLocaleString("fr-FR");
    });

    // Niveau
    const level = window.State.get("level") || 1;
    document.querySelectorAll('[data-bind="level"]').forEach(function(el) {
      el.textContent = level;
    });

    // Streak
    const streak = window.State.get("streak") || 0;
    document.querySelectorAll('[data-bind="streak"]').forEach(function(el) {
      el.textContent = streak;
    });
  }

  /* =========================================================
     CHARGER LA LEÇON DU JOUR (mot du jour mis en avant)
     ========================================================= */
  async function loadDailyLesson() {
    if (!window.Api) return;

    try {
      const wotd = await window.Api.getWordOfTheDay();
      if (!wotd) return;

      // Mettre à jour les bindings du mot du jour partout dans la page
      const arEls = document.querySelectorAll('[data-bind="daily-ar"]');
      const trEls = document.querySelectorAll('[data-bind="daily-translit"]');
      const frEls = document.querySelectorAll('[data-bind="daily-fr"]');

      arEls.forEach(function(el) { el.textContent = wotd.ar || "—"; });
      trEls.forEach(function(el) { el.textContent = wotd.translit || ""; });
      frEls.forEach(function(el) { el.textContent = wotd.fr || ""; });
    } catch (e) {
      console.warn("Impossible de charger le mot du jour :", e);
    }
  }

  /* =========================================================
     ÉCOUTEURS D'ÉVÉNEMENTS
     ========================================================= */
  document.addEventListener("xp-gained", refreshStats);
  document.addEventListener("level-up", refreshStats);
  document.addEventListener("auth-login", function() {
    refreshStats();
  });

  /* -------- API publique -------- */
  return {
    init: init,
    show: show,
    refreshStats: refreshStats
  };
})();

window.HomeScreen = HomeScreen;
console.log("✓ HomeScreen chargé");
