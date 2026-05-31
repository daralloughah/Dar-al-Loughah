/* =========================================================
   DAR AL LOUGHAH — TIME TRACKER
   - Compte temps réel passé (total, day, week, month)
   - Met à jour last_active_at toutes les 30s
   - Auto-pause si onglet caché / utilisateur inactif
   ========================================================= */

const Tracker = (function() {

  // Configuration
  const HEARTBEAT_MS = 30 * 1000;   // 30s : ping Supabase + tick local
  const INACTIVITY_MS = 5 * 60 * 1000; // 5 min : on considère que l'user a abandonné

  let lastTick = Date.now();
  let lastInteraction = Date.now();
  let isVisible = true;
  let intervalId = null;
  let isRunning = false;

  /* =========================================================
     START / STOP
     ========================================================= */
  function start() {
    if (isRunning) return;
    isRunning = true;
    lastTick = Date.now();
    lastInteraction = Date.now();

    // Heartbeat principal
    intervalId = setInterval(tick, HEARTBEAT_MS);

    // Détecter quand l'onglet est caché/visible
    document.addEventListener("visibilitychange", onVisibility);

    // Détecter l'interaction utilisateur
    ["click", "touchstart", "keydown", "scroll"].forEach(function(ev) {
      document.addEventListener(ev, onInteraction, { passive: true });
    });

    // Tick immédiat (pour mettre last_active_at à jour tout de suite)
    pingNow();

    console.log("✓ Tracker démarré");
  }

  function stop() {
    if (!isRunning) return;
    isRunning = false;
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    // Sauvegarde finale
    tick();
  }

  /* =========================================================
     TICK : appelé toutes les 30s
     ========================================================= */
  function tick() {
    const now = Date.now();
    const elapsed = now - lastTick;
    lastTick = now;

    // Si onglet caché ou inactif depuis 5min → on compte pas
    if (!isVisible) return;
    if (now - lastInteraction > INACTIVITY_MS) return;

    // Cap : max 60s par tick (sécurité)
    const seconds = Math.min(Math.round(elapsed / 1000), 60);
    if (seconds < 1) return;

    addTimeSpent(seconds);
    pingNow();
  }

  /* =========================================================
     pingNow : marque last_active_at
     ========================================================= */
  function pingNow() {
    if (!window.State) return;

    const now = Date.now();
    const todayKey = getTodayKey();

    // Met à jour le state local
    const timeSpent = window.State.get("timeSpent") || { total: 0, day: 0, week: 0, month: 0 };
    const dailyActivity = window.State.get("dailyActivity") || {};

    window.State.update({
      lastActiveAt: now,
      timeSpent: timeSpent,
      dailyActivity: dailyActivity
    });

    // Push vers cloud (silencieux, c'est juste un ping)
    if (window.State.schedulePush) {
      window.State.schedulePush();
    }
  }

  /* =========================================================
     addTimeSpent : ajoute X secondes au compteur
     ========================================================= */
  function addTimeSpent(seconds) {
    if (!window.State || !seconds || seconds < 1) return;

    const timeSpent = window.State.get("timeSpent") || { total: 0, day: 0, week: 0, month: 0 };
    const dailyActivity = window.State.get("dailyActivity") || {};
    const todayKey = getTodayKey();

    // Vérifier si on a changé de jour/semaine/mois → reset des compteurs
    const lastTrackDay = window.State.get("lastTrackDay") || todayKey;
    if (lastTrackDay !== todayKey) {
      timeSpent.day = 0;
      // Check si on a changé de semaine
      if (!isSameWeek(lastTrackDay, todayKey)) timeSpent.week = 0;
      // Check si on a changé de mois
      if (lastTrackDay.slice(0, 7) !== todayKey.slice(0, 7)) timeSpent.month = 0;
    }

    // Incrémente tous les compteurs
    timeSpent.total = (timeSpent.total || 0) + seconds;
    timeSpent.day = (timeSpent.day || 0) + seconds;
    timeSpent.week = (timeSpent.week || 0) + seconds;
    timeSpent.month = (timeSpent.month || 0) + seconds;

    // Activité du jour
    dailyActivity[todayKey] = (dailyActivity[todayKey] || 0) + seconds;

    // Nettoyer les vieux jours (garder 90 derniers jours max)
    const keys = Object.keys(dailyActivity).sort();
    if (keys.length > 90) {
      keys.slice(0, keys.length - 90).forEach(function(k) { delete dailyActivity[k]; });
    }

    window.State.update({
      timeSpent: timeSpent,
      dailyActivity: dailyActivity,
      lastTrackDay: todayKey,
      lastActiveAt: Date.now()
    });
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function onVisibility() {
    isVisible = !document.hidden;
    if (isVisible) {
      lastTick = Date.now();
      lastInteraction = Date.now();
      pingNow();
    } else {
      // L'onglet vient d'être caché : on sauvegarde le temps avant de "perdre"
      tick();
    }
  }

  function onInteraction() {
    lastInteraction = Date.now();
  }

  function getTodayKey() {
    const d = new Date();
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  function isSameWeek(date1Str, date2Str) {
    const d1 = new Date(date1Str);
    const d2 = new Date(date2Str);
    const week1 = getWeekNumber(d1);
    const week2 = getWeekNumber(d2);
    return week1 === week2 && d1.getFullYear() === d2.getFullYear();
  }

  function getWeekNumber(d) {
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayNum = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - dayNum + 3);
    const firstThursday = date.valueOf();
    date.setMonth(0, 1);
    if (date.getDay() !== 4) {
      date.setMonth(0, 1 + ((4 - date.getDay()) + 7) % 7);
    }
    return 1 + Math.ceil((firstThursday - date) / 604800000);
  }

  // API publique
  return {
    start: start,
    stop: stop,
    addTime: addTimeSpent,
    ping: pingNow
  };
})();

window.Tracker = Tracker;
console.log("✓ Tracker chargé");

// Auto-start au chargement
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function(){ Tracker.start(); });
} else {
  Tracker.start();
}
