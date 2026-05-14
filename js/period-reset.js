/* =========================================================
   DAR AL LOUGHAH - PERIOD RESET HELPER
   Calcule la cle de semaine (YYYY-WNN) et de mois (YYYY-MM)
   pour declencher l auto-reset des compteurs xpThisWeek/Month
   ========================================================= */

const PeriodReset = (function() {

  // ===== Cle de semaine ISO 8601 (lundi = debut de semaine) =====
  function getCurrentWeekKey(date) {
    const d = date ? new Date(date) : new Date();
    d.setHours(0, 0, 0, 0);
    // Jeudi de la semaine courante (norme ISO 8601)
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const firstThursday = new Date(d.getFullYear(), 0, 4);
    firstThursday.setDate(firstThursday.getDate() + 3 - (firstThursday.getDay() + 6) % 7);
    const weekNum = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + (firstThursday.getDay() + 6) % 7) / 7);
    return d.getFullYear() + "-W" + String(weekNum).padStart(2, "0");
  }

  // ===== Cle de mois (YYYY-MM) =====
  function getCurrentMonthKey(date) {
    const d = date ? new Date(date) : new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }

  // ===== Cle de jour (YYYY-MM-DD) - utile pour streak =====
  function getCurrentDayKey(date) {
    const d = date ? new Date(date) : new Date();
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  // ===== Cle d annee =====
  function getCurrentYearKey(date) {
    const d = date ? new Date(date) : new Date();
    return String(d.getFullYear());
  }

  // ===== Numero de semaine courant (1-53) =====
  function getCurrentWeekNumber() {
    const key = getCurrentWeekKey();
    return parseInt(key.split("-W")[1], 10);
  }

  // ===== Numero de mois courant (1-12) =====
  function getCurrentMonthNumber() {
    return new Date().getMonth() + 1;
  }

  // ===== Verifier si une date est dans la semaine en cours =====
  function isThisWeek(date) {
    return getCurrentWeekKey(date) === getCurrentWeekKey();
  }

  // ===== Verifier si une date est dans le mois en cours =====
  function isThisMonth(date) {
    return getCurrentMonthKey(date) === getCurrentMonthKey();
  }

  // ===== Force le reset des compteurs (utile pour debug) =====
  function forceResetWeek() {
    if (window.State) {
      window.State.update({
        xpThisWeek: 0,
        wordsThisWeek: 0,
        unlocksThisWeek: 0,
        weekKey: getCurrentWeekKey()
      });
    }
  }

  function forceResetMonth() {
    if (window.State) {
      window.State.update({
        xpThisMonth: 0,
        wordsThisMonth: 0,
        unlocksThisMonth: 0,
        monthKey: getCurrentMonthKey()
      });
    }
  }

  // ===== Auto-reset au demarrage (verifie si on a change de periode) =====
  function checkAndReset() {
    if (!window.State) return;
    const storedWeek = window.State.get("weekKey");
    const storedMonth = window.State.get("monthKey");
    const currentWeek = getCurrentWeekKey();
    const currentMonth = getCurrentMonthKey();

    const updates = {};
    if (storedWeek && storedWeek !== currentWeek) {
      updates.xpThisWeek = 0;
      updates.wordsThisWeek = 0;
      updates.unlocksThisWeek = 0;
      updates.weekKey = currentWeek;
    } else if (!storedWeek) {
      updates.weekKey = currentWeek;
    }

    if (storedMonth && storedMonth !== currentMonth) {
      updates.xpThisMonth = 0;
      updates.wordsThisMonth = 0;
      updates.unlocksThisMonth = 0;
      updates.monthKey = currentMonth;
    } else if (!storedMonth) {
      updates.monthKey = currentMonth;
    }

    if (Object.keys(updates).length > 0) {
      window.State.update(updates);
      console.log("PeriodReset: compteurs ajustes", updates);
    }
  }

  // ===== Init au demarrage =====
  function init() {
    setTimeout(checkAndReset, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    getCurrentWeekKey: getCurrentWeekKey,
    getCurrentMonthKey: getCurrentMonthKey,
    getCurrentDayKey: getCurrentDayKey,
    getCurrentYearKey: getCurrentYearKey,
    getCurrentWeekNumber: getCurrentWeekNumber,
    getCurrentMonthNumber: getCurrentMonthNumber,
    isThisWeek: isThisWeek,
    isThisMonth: isThisMonth,
    forceResetWeek: forceResetWeek,
    forceResetMonth: forceResetMonth,
    checkAndReset: checkAndReset
  };
})();

window.PeriodReset = PeriodReset;
console.log("PeriodReset charge - Semaine " + PeriodReset.getCurrentWeekKey() + " / Mois " + PeriodReset.getCurrentMonthKey());
