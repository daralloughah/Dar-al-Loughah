/* =========================================================
   DAR AL LOUGHAH — AUDIO ENGINE
   Sons générés directement par Web Audio API (zéro fichier)
   - tap     : clic doux quand on touche un bouton
   - correct : ding cristallin pour bonne réponse
   - wrong   : buzz bas et doux pour mauvaise réponse
   - levelUp : fanfare courte au passage de niveau
   - badge   : son magique au déblocage de badge
   ========================================================= */

const Audio = (function() {

  let ctx = null;
  let initialized = false;

  // Reglages depuis CONFIG (avec fallback si CONFIG pas dispo)
  const VOL = (window.CONFIG && window.CONFIG.SOUNDS) || {
    TAP_VOLUME: 0.15,
    CORRECT_VOLUME: 0.25,
    WRONG_VOLUME: 0.20
  };

  // États ON/OFF (lus depuis localStorage)
  let tapEnabled = true;
  let feedbackEnabled = true;

  /* -------- INIT -------- */
  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      initialized = true;
      console.log("✓ Audio engine prêt");
    } catch (e) {
      console.warn("Audio non supporté sur ce navigateur");
    }

    // Lire les préférences sauvegardées
    try {
      const prefs = localStorage.getItem("dar_audio_prefs");
      if (prefs) {
        const p = JSON.parse(prefs);
        tapEnabled = p.tap !== false;
        feedbackEnabled = p.feedback !== false;
      }
    } catch (e) {}
  }

  /* -------- ACTIVER L'AUDIO (nécessaire iOS / Safari) -------- */
  // iOS bloque l'audio tant que l'utilisateur n'a pas interagi
  function unlock() {
    if (!ctx) init();
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
  }

  /* -------- HELPERS -------- */
  function makeOsc(frequency, type) {
    const osc = ctx.createOscillator();
    osc.type = type || "sine";
    osc.frequency.value = frequency;
    return osc;
  }

  function makeGain(volume) {
    const g = ctx.createGain();
    g.gain.value = volume;
    return g;
  }

  /* =========================================================
     SON 1 : TAP (clic au toucher)
     Court, doux, agréable
     ========================================================= */
  function tap() {
    if (!tapEnabled || !ctx) return;
    unlock();

    const now = ctx.currentTime;
    const osc = makeOsc(880, "sine");
    const gain = makeGain(0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Attaque rapide, decay très court
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(VOL.TAP_VOLUME, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    // Légère descente de fréquence pour effet "drop"
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  /* =========================================================
     SON 2 : CORRECT (bonne réponse)
     Ding cristallin à 2 notes ascendantes
     ========================================================= */
  function correct() {
    if (!feedbackEnabled || !ctx) return;
    unlock();

    const now = ctx.currentTime;

    // Première note : Do5
    playNote(523.25, now,        0.12, "triangle", VOL.CORRECT_VOLUME);
    // Seconde note : Mi5 (tierce majeure, harmonieux)
    playNote(659.25, now + 0.08, 0.15, "triangle", VOL.CORRECT_VOLUME);
    // Troisième note : Sol5 (quinte) - cristallin
    playNote(783.99, now + 0.16, 0.20, "triangle", VOL.CORRECT_VOLUME * 0.7);
  }

  /* =========================================================
     SON 3 : WRONG (mauvaise réponse)
     Buzz bas, doux, pas agressif
     ========================================================= */
  function wrong() {
    if (!feedbackEnabled || !ctx) return;
    unlock();

    const now = ctx.currentTime;
    const osc = makeOsc(220, "sawtooth");
    const gain = makeGain(0);

    // Filtre passe-bas pour adoucir
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 800;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(VOL.WRONG_VOLUME, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    // Descente de note pour effet "fail" doux
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /* =========================================================
     SON 4 : LEVEL UP (passage de niveau)
     Petite fanfare ascendante
     ========================================================= */
  function levelUp() {
    if (!feedbackEnabled || !ctx) return;
    unlock();

    const now = ctx.currentTime;
    // Arpège majeur ascendant : Do - Mi - Sol - Do
    playNote(523.25, now,        0.15, "triangle", VOL.CORRECT_VOLUME);
    playNote(659.25, now + 0.10, 0.15, "triangle", VOL.CORRECT_VOLUME);
    playNote(783.99, now + 0.20, 0.15, "triangle", VOL.CORRECT_VOLUME);
    playNote(1046.5, now + 0.30, 0.40, "triangle", VOL.CORRECT_VOLUME * 0.9);
  }

  /* =========================================================
     SON 5 : BADGE (déblocage de badge)
     Son magique scintillant
     ========================================================= */
  function badge() {
    if (!feedbackEnabled || !ctx) return;
    unlock();

    const now = ctx.currentTime;
    // Cloche aigüe
    playNote(1046.5, now,        0.30, "sine", VOL.CORRECT_VOLUME);
    playNote(1318.5, now + 0.05, 0.30, "sine", VOL.CORRECT_VOLUME * 0.7);
    playNote(1568.0, now + 0.10, 0.40, "sine", VOL.CORRECT_VOLUME * 0.5);
  }

  /* -------- HELPER : jouer une note -------- */
  function playNote(freq, when, duration, type, volume) {
    const osc = makeOsc(freq, type);
    const gain = makeGain(0);

    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);

    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  /* =========================================================
     CONTROLS (activer / désactiver les sons)
     ========================================================= */
  function setTapEnabled(value) {
    tapEnabled = !!value;
    savePrefs();
  }

  function setFeedbackEnabled(value) {
    feedbackEnabled = !!value;
    savePrefs();
  }

  function isTapEnabled() { return tapEnabled; }
  function isFeedbackEnabled() { return feedbackEnabled; }

  function savePrefs() {
    try {
      localStorage.setItem("dar_audio_prefs", JSON.stringify({
        tap: tapEnabled,
        feedback: feedbackEnabled
      }));
    } catch (e) {}
  }

  /* =========================================================
     AUTO-INIT au premier toucher (workaround iOS)
     ========================================================= */
  function setupAutoUnlock() {
    const handler = function() {
      unlock();
      document.removeEventListener("touchstart", handler);
      document.removeEventListener("click", handler);
    };
    document.addEventListener("touchstart", handler, { once: true });
    document.addEventListener("click", handler, { once: true });
  }

  // Lancer au chargement
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      init();
      setupAutoUnlock();
    });
  } else {
    init();
    setupAutoUnlock();
  }

  /* -------- API publique -------- */
  return {
    tap: tap,
    correct: correct,
    wrong: wrong,
    levelUp: levelUp,
    badge: badge,
    unlock: unlock,
    setTapEnabled: setTapEnabled,
    setFeedbackEnabled: setFeedbackEnabled,
    isTapEnabled: isTapEnabled,
    isFeedbackEnabled: isFeedbackEnabled
  };
})();

// Exposer globalement
window.Audio = Audio;
console.log("✓ Audio engine chargé (5 sons disponibles)");
