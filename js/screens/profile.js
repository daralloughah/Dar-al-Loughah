/* =========================================================
   DAR AL LOUGHAH — SCREEN: PROFILE
   - Avatar, pseudo, niveau, titre
   - Barre XP avec progression vers le niveau suivant
   - Stats : mots, lettres, badges
   - Aperçu des derniers badges
   - Changer pseudo, exporter, logout
   ========================================================= */

const ProfileScreen = (function() {

  /* =========================================================
     SHOW
     ========================================================= */
  function show() {
    if (!window.State) return;
    refreshProfile();
    refreshXPBar();
    refreshMiniStats();
    refreshBadgesPreview();
    refreshAccountForm();
  }

  /* =========================================================
     INFO PROFIL (avatar + pseudo + titre)
     ========================================================= */
  function refreshProfile() {
    const pseudo = window.State.get("pseudo") || "Apprenti";
    const level = window.State.get("level") || 1;

    // Avatar (première lettre)
    const avatarEl = document.getElementById("profileAvatar");
    if (avatarEl) {
      avatarEl.textContent = (pseudo.charAt(0) || "A").toUpperCase();
    }

    // Pseudo bindings
    document.querySelectorAll('[data-bind="pseudo"]').forEach(function(el) {
      el.textContent = pseudo;
    });

    // Niveau bindings
    document.querySelectorAll('[data-bind="level"]').forEach(function(el) {
      el.textContent = level;
    });

    // Titre du niveau
    const titleEl = document.getElementById("levelTitle");
    if (titleEl && window.XP) {
      titleEl.textContent = window.XP.levelTitle(level);
    }
  }

  /* =========================================================
     BARRE XP
     ========================================================= */
  function refreshXPBar() {
    if (!window.XP) return;

    const totalXP = window.State.get("xp") || 0;
    const level = window.State.get("level") || 1;

    const xpInLevel = window.XP.xpInCurrentLevel(totalXP);
    const xpNeeded = window.XP.xpToNextLevel(level);
    const percent = xpNeeded > 0 ? Math.min(100, Math.round((xpInLevel / xpNeeded) * 100)) : 0;

    // Remplir la barre
    const fillEl = document.getElementById("xpFill");
    if (fillEl) {
      fillEl.style.width = percent + "%";
    }

    // Texte
    const currentEl = document.getElementById("xpCurrent");
    const nextEl = document.getElementById("xpNext");
    if (currentEl) currentEl.textContent = xpInLevel.toLocaleString("fr-FR");
    if (nextEl) nextEl.textContent = xpNeeded.toLocaleString("fr-FR");
  }

  /* =========================================================
     MINI STATS (mots, lettres, badges)
     ========================================================= */
  function refreshMiniStats() {
    const words = (window.State.get("masteredWords")) ||
                  (window.State.get("wordsLearned") || []).length;
    const letters = (window.State.get("lettersLearned") || []).length;
    const badges = (window.State.get("unlockedBadges") || []).length;

    const wEl = document.getElementById("wordsLearned");
    const lEl = document.getElementById("lettersDone");
    const bEl = document.getElementById("badgesUnlocked");

    if (wEl) wEl.textContent = words.toLocaleString("fr-FR");
    if (lEl) lEl.textContent = letters;
    if (bEl) bEl.textContent = badges;
  }

  /* =========================================================
     APERÇU DES DERNIERS BADGES (6 max)
     ========================================================= */
  function refreshBadgesPreview() {
    const grid = document.getElementById("badgesPreview");
    if (!grid || !window.XP) return;

    const unlockedIds = window.State.get("unlockedBadges") || [];
    const allBadges = window.XP.getAllBadges();

    // Filtrer les badges débloqués
    const unlocked = unlockedIds.map(function(id) {
      return allBadges.find(function(b) { return b.id === id; });
    }).filter(Boolean);

    grid.innerHTML = "";

    if (unlocked.length === 0) {
      // Afficher 6 placeholders
      for (let i = 0; i < 6; i++) {
        const el = document.createElement("div");
        el.className = "badge-mini";
        el.style.opacity = "0.25";
        el.innerHTML = '<span style="color:var(--ink-muted); font-size:18px;">?</span>';
        grid.appendChild(el);
      }
      return;
    }

    // Afficher les 6 derniers
    const recent = unlocked.slice(-6).reverse();
    recent.forEach(function(badge) {
      const el = document.createElement("div");
      el.className = "badge-mini";
      el.title = badge.name + " — " + badge.desc;
      el.innerHTML = window.XP.getBadgeSVG(badge);
      grid.appendChild(el);
    });

    // Compléter avec des placeholders si moins de 6
    for (let i = recent.length; i < 6; i++) {
      const el = document.createElement("div");
      el.className = "badge-mini";
      el.style.opacity = "0.25";
      el.innerHTML = '<span style="color:var(--ink-muted); font-size:18px;">?</span>';
      grid.appendChild(el);
    }
  }

  /* =========================================================
     FORMULAIRE COMPTE
     ========================================================= */
  function refreshAccountForm() {
    const input = document.getElementById("pseudoInput");
    if (input) {
      input.value = window.State.get("pseudo") || "";
      input.placeholder = "Changer le pseudo";
    }
  }

  /* =========================================================
     SAUVEGARDER LE PSEUDO
     ========================================================= */
  function savePseudo() {
    const input = document.getElementById("pseudoInput");
    if (!input) return;

    const newPseudo = input.value.trim();
    if (!newPseudo || newPseudo.length < 2) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Pseudo trop court (min. 2 caractères)");
      }
      return;
    }
    if (newPseudo.length > 30) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Pseudo trop long (max. 30 caractères)");
      }
      return;
    }

    if (window.Auth) {
      const result = window.Auth.changePseudo(newPseudo);
      if (result.success) {
        if (window.Audio) window.Audio.correct();
        if (window.Main && window.Main.toast) {
          window.Main.toast("Pseudo enregistré ✓");
        }
        refreshProfile();
      }
    }
  }

  /* =========================================================
     EXPORTER LES DONNÉES
     ========================================================= */
  function exportData() {
    if (!window.State) return;

    const data = window.State.exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Tentative de téléchargement direct
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = "dar-al-loughah-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(function() {
        URL.revokeObjectURL(url);
      }, 1000);

      if (window.Main && window.Main.toast) {
        window.Main.toast("Données exportées ✓");
      }
      if (window.Audio) window.Audio.correct();
    } catch (e) {
      // Fallback : copier dans le presse-papier
      try {
        navigator.clipboard.writeText(data);
        if (window.Main && window.Main.toast) {
          window.Main.toast("Données copiées dans le presse-papier");
        }
      } catch (err) {
        alert("Vos données :\n\n" + data);
      }
    }
  }

  /* =========================================================
     LOGOUT
     ========================================================= */
  function logout() {
    if (window.Main && window.Main.confirm) {
      window.Main.confirm(
        "Se déconnecter",
        "Voulez-vous vraiment vous déconnecter ? Vos progrès locaux restent sauvegardés.",
        function() {
          if (window.Auth) window.Auth.logout();
          if (window.Main) window.Main.goto("login");
        }
      );
    } else {
      if (confirm("Se déconnecter ?")) {
        if (window.Auth) window.Auth.logout();
        if (window.Main) window.Main.goto("login");
      }
    }
  }

  /* =========================================================
     RAFRAÎCHIR EN TEMPS RÉEL (sur événements)
     ========================================================= */
  document.addEventListener("xp-gained", function() {
    if (isProfileVisible()) {
      refreshXPBar();
      refreshMiniStats();
    }
  });

  document.addEventListener("level-up", function() {
    if (isProfileVisible()) {
      refreshProfile();
      refreshXPBar();
    }
  });

  document.addEventListener("badge-unlocked", function() {
    if (isProfileVisible()) {
      refreshBadgesPreview();
      refreshMiniStats();
    }
  });

  function isProfileVisible() {
    const screen = document.getElementById("screen-profile");
    return screen && screen.classList.contains("active");
  }

  /* -------- API publique -------- */
  return {
    show: show,
    savePseudo: savePseudo,
    exportData: exportData,
    logout: logout,
    refreshProfile: refreshProfile,
    refreshXPBar: refreshXPBar,
    refreshMiniStats: refreshMiniStats,
    refreshBadgesPreview: refreshBadgesPreview
  };
})();

window.ProfileScreen = ProfileScreen;
console.log("✓ ProfileScreen chargé");
