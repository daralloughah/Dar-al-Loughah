/* =========================================================
   DAR AL LOUGHAH - PERIOD RESET
   Reinitialise les compteurs hebdo / mensuels automatiquement
   Pas besoin de serveur : check a chaque connexion
   ========================================================= */

const PeriodReset = (function() {

  // Retourne la cle ISO de la semaine actuelle (ex: "2026-W20")
  function getCurrentWeekKey() {
    const d = new Date();
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = target - firstThursday;
    const weekNum = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
    return target.getFullYear() + "-W" + String(weekNum).padStart(2, "0");
  }

  // Retourne la cle du mois actuel (ex: "2026-05")
  function getCurrentMonthKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  // Verifie si les compteurs hebdo doivent etre reset
  function shouldResetWeek(user) {
    const currentWeek = getCurrentWeekKey();
    return !user.weekKey || user.weekKey !== currentWeek;
  }

  // Verifie si les compteurs mensuels doivent etre reset
  function shouldResetMonth(user) {
    const currentMonth = getCurrentMonthKey();
    return !user.monthKey || user.monthKey !== currentMonth;
  }

  // Applique les resets si necessaire
  function applyResets(user) {
    if (!user) return user;
    let changed = false;

    if (shouldResetWeek(user)) {
      user.xpThisWeek = 0;
      user.wordsThisWeek = 0;
      user.unlocksThisWeek = 0;
      user.weekKey = getCurrentWeekKey();
      changed = true;
    }

    if (shouldResetMonth(user)) {
      user.xpThisMonth = 0;
      user.wordsThisMonth = 0;
      user.unlocksThisMonth = 0;
      user.monthKey = getCurrentMonthKey();
      changed = true;
    }

    return { user: user, changed: changed };
  }

  // A appeler au chargement de l'app : check + applique + sauvegarde
  async function checkAndReset() {
    if (!window.State) return;
    const stateData = {
      xpThisWeek: window.State.get("xpThisWeek") || 0,
      wordsThisWeek: window.State.get("wordsThisWeek") || 0,
      unlocksThisWeek: window.State.get("unlocksThisWeek") || 0,
      weekKey: window.State.get("weekKey") || "",
      xpThisMonth: window.State.get("xpThisMonth") || 0,
      wordsThisMonth: window.State.get("wordsThisMonth") || 0,
      unlocksThisMonth: window.State.get("unlocksThisMonth") || 0,
      monthKey: window.State.get("monthKey") || ""
    };

    const result = applyResets(stateData);

    if (result.changed) {
      window.State.set("xpThisWeek", result.user.xpThisWeek);
      window.State.set("wordsThisWeek", result.user.wordsThisWeek);
      window.State.set("unlocksThisWeek", result.user.unlocksThisWeek);
      window.State.set("weekKey", result.user.weekKey);
      window.State.set("xpThisMonth", result.user.xpThisMonth);
      window.State.set("wordsThisMonth", result.user.wordsThisMonth);
      window.State.set("unlocksThisMonth", result.user.unlocksThisMonth);
      window.State.set("monthKey", result.user.monthKey);

      // Sauvegarder dans Firestore si connecte
      try {
        if (window.FB && window.FB.updateCurrentUserData) {
          await window.FB.updateCurrentUserData({
            xpThisWeek: result.user.xpThisWeek,
            wordsThisWeek: result.user.wordsThisWeek,
            unlocksThisWeek: result.user.unlocksThisWeek,
            weekKey: result.user.weekKey,
            xpThisMonth: result.user.xpThisMonth,
            wordsThisMonth: result.user.wordsThisMonth,
            unlocksThisMonth: result.user.unlocksThisMonth,
            monthKey: result.user.monthKey
          });
        }
      } catch (e) {
        console.warn("Erreur sync reset hebdo/mensuel:", e);
      }
      console.log("Compteurs hebdo/mensuels reset");
    }
  }

  return {
    checkAndReset: checkAndReset,
    getCurrentWeekKey: getCurrentWeekKey,
    getCurrentMonthKey: getCurrentMonthKey,
    applyResets: applyResets
  };
})();

window.PeriodReset = PeriodReset;
console.log("OK PeriodReset charge");
