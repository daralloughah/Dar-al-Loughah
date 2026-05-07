/* =========================================================
   DAR AL LOUGHAH — SCREEN: THEMES + THEME LEVELS
   Affiche les 12 thèmes et les 5 niveaux par thème
   ========================================================= */

const ThemesScreen = (function() {

  let themesCache = null;
  let currentTheme = null;

  // Définition des 5 niveaux par thème
  const LEVEL_TIERS = [
    { id: "debutant",      name: "Débutant",       icon: "🌱", target: 20, requiresPrev: 0   },
    { id: "intermediaire", name: "Intermédiaire",  icon: "📘", target: 30, requiresPrev: 50  },
    { id: "avance",        name: "Avancé",         icon: "🏛️", target: 40, requiresPrev: 50  },
    { id: "expert",        name: "Expert",         icon: "🎓", target: 50, requiresPrev: 50  },
    { id: "mouallim",      name: "Mouallim",       icon: "✨", target: 30, requiresPrev: 80, special: true }
  ];

  /* =========================================================
     SHOW : LISTE DES THÈMES
     ========================================================= */
  async function show() {
    const grid = document.getElementById("themesGrid");
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column: span 2; text-align:center; padding:20px; color:var(--ink-muted); font-style:italic;">Chargement des thèmes…</div>';

    if (!window.Api) return;

    try {
      const themes = await window.Api.getThemesIndex();
      themesCache = themes;
      renderThemesGrid(themes);
    } catch (e) {
      grid.innerHTML = '<div style="grid-column: span 2; text-align:center; padding:20px; color:var(--ink-muted);">Impossible de charger les thèmes.</div>';
    }
  }

  function renderThemesGrid(themes) {
    const grid = document.getElementById("themesGrid");
    if (!grid) return;

    grid.innerHTML = "";

    themes.forEach(function(theme) {
      const progress = getThemeProgress(theme.id);
      const card = document.createElement("button");
      card.className = "theme-card";
      card.type = "button";
      card.setAttribute("data-action", "open-theme");
      card.setAttribute("data-theme-id", theme.id);

      card.innerHTML =
        '<div class="theme-emoji">' + (theme.icon || "📚") + '</div>' +
        '<div class="theme-name-ar">' + escapeHTML(theme.nameAr || "") + '</div>' +
        '<div class="theme-name">' + escapeHTML(theme.name || "") + '</div>' +
        '<div class="theme-progress">' + progress.label + '</div>';

      grid.appendChild(card);
    });
  }

  /* =========================================================
     CALCULER LA PROGRESSION D'UN THÈME
     ========================================================= */
  function getThemeProgress(themeId) {
    if (!window.State) return { label: "Nouveau", percent: 0 };
    const tp = window.State.get("themeProgress") || {};
    const data = tp[themeId];

    if (!data) return { label: "Nouveau", percent: 0 };

    const completedLevels = data.completedLevels || [];
    if (completedLevels.length === LEVEL_TIERS.length) {
      return { label: "✓ Terminé", percent: 100 };
    }
    if (completedLevels.length === 0 && !data.currentLevel) {
      return { label: "Nouveau", percent: 0 };
    }
    return {
      label: completedLevels.length + " / " + LEVEL_TIERS.length + " niveaux",
      percent: Math.round((completedLevels.length / LEVEL_TIERS.length) * 100)
    };
  }

  /* =========================================================
     OUVRIR UN THÈME (afficher ses niveaux)
     ========================================================= */
  async function openTheme(themeId) {
    if (!window.Api) return;

    let theme = themesCache && themesCache.find(function(t) { return t.id === themeId; });
    if (!theme) {
      theme = await window.Api.getThemesIndex().then(function(list) {
        return list.find(function(t) { return t.id === themeId; });
      });
    }
    if (!theme) return;

    currentTheme = theme;

    // Mettre à jour les bindings
    document.querySelectorAll('[data-bind="theme-name"]').forEach(function(el) {
      el.textContent = theme.name || "";
    });
    document.querySelectorAll('[data-bind="theme-name-ar"]').forEach(function(el) {
      el.textContent = theme.nameAr || "";
    });
    document.querySelectorAll('[data-bind="theme-intro"]').forEach(function(el) {
      el.textContent = theme.description || "Explorez ce thème à votre rythme.";
    });

    // Charger le contenu détaillé
    const themeData = await window.Api.getTheme(themeId);
    renderLevels(themeData, theme);

    // Naviguer vers l'écran
    if (window.Main) {
      window.Main.goto("theme-levels");
    }
  }

  /* =========================================================
     AFFICHER LES NIVEAUX D'UN THÈME
     ========================================================= */
  function renderLevels(themeData, theme) {
    const container = document.getElementById("levelsList");
    if (!container) return;

    container.innerHTML = "";

    const isCoran = theme.special || theme.id === "coran";
    const isPremium = window.State && window.State.get("isPremium");
    const masteredWords = (window.State && window.State.get("masteredWords")) || 0;

    if (isCoran) {
      // Le Coran : pas de niveaux, juste un bouton
      const row = document.createElement("button");
      row.className = "level-row";
      row.type = "button";
      row.setAttribute("data-action", "select-level");
      row.setAttribute("data-level-id", "coran");
      row.innerHTML =
        '<div class="level-ico">📖</div>' +
        '<div class="level-info">' +
          '<div class="level-name">Mots du Coran</div>' +
          '<div class="level-meta">Vocabulaire sacré</div>' +
        '</div>' +
        '<div class="level-progress">→</div>';
      container.appendChild(row);
      return;
    }

    LEVEL_TIERS.forEach(function(tier, index) {
      const levelData = (themeData && themeData.levels && themeData.levels[tier.id]) || [];
      const wordCount = levelData.length;
      const tp = (window.State && window.State.get("themeProgress")) || {};
      const themeProgress = tp[theme.id] || {};
      const completedLevels = themeProgress.completedLevels || [];
      const isCompleted = completedLevels.includes(tier.id);

      // Mouallim : nécessite 12 000 mots OU le bonus Premium + niveau Expert terminé
      let isLocked = false;
      let lockReason = "";

      if (tier.id === "mouallim") {
        const mouallimThreshold = (window.CONFIG && window.CONFIG.MOUALLIM_THRESHOLD) || 12000;
        if (masteredWords < mouallimThreshold && !isPremium) {
          isLocked = true;
          lockReason = "12 000 mots requis (ou Premium)";
        } else if (!completedLevels.includes("expert") && !isPremium) {
          isLocked = true;
          lockReason = "Terminez Expert d'abord";
        }
      } else if (tier.requiresPrev > 0 && index > 0) {
        const prevTier = LEVEL_TIERS[index - 1];
        const prevProgress = themeProgress[prevTier.id] || 0;
        const requiredPercent = tier.requiresPrev;
        const requiredWords = Math.ceil(((themeData && themeData.levels && themeData.levels[prevTier.id]) || []).length * requiredPercent / 100);
        if (prevProgress < requiredWords && !isPremium) {
          isLocked = true;
          lockReason = requiredPercent + "% du niveau précédent";
        }
      }

      const row = document.createElement("button");
      row.className = "level-row" + (isLocked ? " locked" : "") + (tier.special ? " mouallim" : "");
      row.type = "button";
      row.disabled = isLocked;

      if (!isLocked) {
        row.setAttribute("data-action", "select-level");
        row.setAttribute("data-level-id", tier.id);
        row.setAttribute("data-theme-id", theme.id);
      }

      const progressText = isCompleted ? "✓" : (isLocked ? lockReason : (wordCount + " mots"));

      row.innerHTML =
        '<div class="level-ico">' + tier.icon + '</div>' +
        '<div class="level-info">' +
          '<div class="level-name">' + tier.name + '</div>' +
          '<div class="level-meta">' + progressText + '</div>' +
        '</div>' +
        '<div class="level-progress">' +
          (isCompleted ? '★' : (isLocked ? '🔒' : '→')) +
        '</div>';

      container.appendChild(row);
    });
  }

  /* =========================================================
     SÉLECTIONNER UN NIVEAU (pour pratique)
     ========================================================= */
  function selectLevel(levelId, themeId) {
    if (!currentTheme) return;

    // Mémoriser le contexte d'apprentissage
    if (window.State) {
      window.State.update({
        learningContext: {
          themeId: themeId || currentTheme.id,
          themeName: currentTheme.name,
          levelId: levelId,
          source: "theme"
        }
      });
    }

    // Par défaut : ouvrir les cartes vocab
    practiceTheme("cards");
  }

  /* =========================================================
     LANCER UN MODE D'ENTRAÎNEMENT (cartes, QCM, rapid)
     ========================================================= */
  async function practiceTheme(mode) {
    if (!currentTheme || !window.Main) return;

    const ctx = window.State && window.State.get("learningContext");
    if (!ctx || !ctx.levelId) {
      // Pas de niveau choisi : prendre débutant par défaut
      if (window.State) {
        window.State.update({
          learningContext: {
            themeId: currentTheme.id,
            themeName: currentTheme.name,
            levelId: "debutant",
            source: "theme"
          }
        });
      }
    }

    // Mettre à jour le titre du contexte
    document.querySelectorAll('[data-bind="vocab-context"]').forEach(function(el) {
      el.textContent = currentTheme.name || "Vocabulaire";
    });

    // Naviguer vers l'écran approprié
    switch (mode) {
      case "cards":  window.Main.goto("vocab"); break;
      case "qcm":    window.Main.goto("quiz");  break;
      case "rapid":  window.Main.goto("rapid"); break;
      default:       window.Main.goto("vocab");
    }
  }

  /* =========================================================
     ENREGISTRER UN MOT APPRIS DANS UN THÈME
     ========================================================= */
  function recordThemeProgress(themeId, levelId, wordsLearned) {
    if (!window.State) return;

    const tp = window.State.get("themeProgress") || {};
    if (!tp[themeId]) tp[themeId] = { completedLevels: [] };
    tp[themeId][levelId] = wordsLearned;

    window.State.set("themeProgress", tp);
  }

  function markLevelCompleted(themeId, levelId) {
    if (!window.State) return;

    const tp = window.State.get("themeProgress") || {};
    if (!tp[themeId]) tp[themeId] = { completedLevels: [] };
    if (!tp[themeId].completedLevels.includes(levelId)) {
      tp[themeId].completedLevels.push(levelId);
    }

    // Si tous les niveaux sont faits → thème complété
    if (tp[themeId].completedLevels.length >= LEVEL_TIERS.length) {
      const stats = window.State.get("stats") || {};
      stats.themesCompleted = (stats.themesCompleted || 0) + 1;
      window.State.set("stats", stats);
      // Vérifier les badges thèmes
      if (window.XP) window.XP.checkBadges();
    }

    window.State.set("themeProgress", tp);
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* =========================================================
     ACCESSEURS
     ========================================================= */
  function getCurrentTheme() { return currentTheme; }
  function getLevelTiers()   { return LEVEL_TIERS.slice(); }

  /* -------- API publique -------- */
  return {
    show: show,
    openTheme: openTheme,
    selectLevel: selectLevel,
    practiceTheme: practiceTheme,
    recordThemeProgress: recordThemeProgress,
    markLevelCompleted: markLevelCompleted,
    getCurrentTheme: getCurrentTheme,
    getLevelTiers: getLevelTiers
  };
})();

window.ThemesScreen = ThemesScreen;
console.log("✓ ThemesScreen chargé (12 thèmes prêts)");
