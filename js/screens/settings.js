/* =========================================================
   DAR AL LOUGHAH — SCREEN: SETTINGS
   - Toggles pour sons, notifications, apprentissage
   - Info sur la version et le backend
   - Réinitialisation des données
   ========================================================= */

const SettingsScreen = (function() {

  // Liste des toggles avec leur clé state
  const TOGGLES = [
    { id: "settingTapSound",      key: "settings.tapSound",      audio: "tap" },
    { id: "settingFeedbackSound", key: "settings.feedbackSound", audio: "feedback" },
    { id: "settingAmbientSound",  key: "settings.ambientSound" },
    { id: "settingStreakNotif",   key: "settings.streakNotif" },
    { id: "settingWotdNotif",     key: "settings.wotdNotif" },
    { id: "settingShowTranslit",  key: "settings.showTranslit" },
    { id: "settingOfflineCache",  key: "settings.offlineCache" },
    { id: "settingShareProgress", key: "settings.shareProgress" }
  ];

  /* =========================================================
     SHOW
     ========================================================= */
  function show() {
    loadAllToggles();
    refreshAbout();
    bindToggleEvents();
  }

  /* =========================================================
     CHARGER LES VALEURS DEPUIS LE STATE
     ========================================================= */
  function loadAllToggles() {
    if (!window.State) return;

    TOGGLES.forEach(function(toggle) {
      const checkbox = document.getElementById(toggle.id);
      if (checkbox) {
        const value = window.State.get(toggle.key);
        // Par défaut true sauf pour ambient et shareProgress
        checkbox.checked = (value !== undefined) ? !!value :
                           (toggle.key === "settings.ambientSound" ||
                            toggle.key === "settings.shareProgress" ? false : true);
      }
    });
  }

  /* =========================================================
     LIER LES ÉVÉNEMENTS DE CHANGEMENT
     ========================================================= */
  function bindToggleEvents() {
    TOGGLES.forEach(function(toggle) {
      const checkbox = document.getElementById(toggle.id);
      if (!checkbox) return;

      // Retirer ancien listener si présent
      checkbox.onchange = function() {
        const value = checkbox.checked;
        if (window.State) {
          window.State.set(toggle.key, value);
        }

        // Synchroniser avec le module Audio
        if (window.Audio && toggle.audio === "tap") {
          window.Audio.setTapEnabled(value);
        }
        if (window.Audio && toggle.audio === "feedback") {
          window.Audio.setFeedbackEnabled(value);
        }

        // Petit son de confirmation (sauf pour le toggle son lui-même)
        if (window.Audio && toggle.audio !== "tap") {
          window.Audio.tap();
        }

        if (window.Main && window.Main.toast) {
          window.Main.toast(value ? "Activé ✓" : "Désactivé");
        }
      };
    });
  }

  /* =========================================================
     SECTION À PROPOS
     ========================================================= */
  function refreshAbout() {
    const versionEl = document.getElementById("appVersion");
    if (versionEl) {
      versionEl.textContent = (window.CONFIG && window.CONFIG.APP_VERSION) || "1.0.0";
    }

    const backendEl = document.getElementById("backendStatus");
    if (backendEl) {
      const hasBackend = window.Api && window.Api.hasBackend && window.Api.hasBackend();
      const isOnline = window.Api && window.Api.isOnline && window.Api.isOnline();
      if (hasBackend && isOnline) {
        backendEl.textContent = "✓ Connecté";
        backendEl.style.color = "var(--correct, #4fd69a)";
      } else if (hasBackend && !isOnline) {
        backendEl.textContent = "Hors-ligne (cache)";
        backendEl.style.color = "var(--ink-muted)";
      } else {
        backendEl.textContent = "Mode local (JSON)";
        backendEl.style.color = "var(--gold-light)";
      }
    }
  }

  /* =========================================================
     RÉINITIALISER LES DONNÉES
     ========================================================= */
  function resetData() {
    if (window.Main && window.Main.confirm) {
      window.Main.confirm(
        "Tout réinitialiser ?",
        "Cette action effacera votre progression, vos listes, vos badges. Cette action est irréversible.",
        function() {
          if (window.State) {
            window.State.reset();
          }
          // Effacer aussi les autres clés
          try {
            localStorage.removeItem("dar_audio_prefs");
            localStorage.removeItem("dar_used_codes");
            localStorage.removeItem("dar_auth_token");
          } catch (e) {}

          if (window.Main && window.Main.toast) {
            window.Main.toast("Données réinitialisées");
          }

          // Retour à l'écran de login
          setTimeout(function() {
            if (window.Main) window.Main.goto("login");
          }, 800);
        }
      );
    } else {
      if (confirm("Réinitialiser toutes les données ?")) {
        if (window.State) window.State.reset();
        if (window.Main) window.Main.goto("login");
      }
    }
  }

  /* -------- API publique -------- */
  return {
    show: show,
    resetData: resetData,
    refreshAbout: refreshAbout
  };
})();

window.SettingsScreen = SettingsScreen;
console.log("✓ SettingsScreen chargé");
