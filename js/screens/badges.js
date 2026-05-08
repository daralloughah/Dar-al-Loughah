/* =========================================================
   DAR AL LOUGHAH — SCREEN: BADGES (galerie complète)
   - 30 badges SVG artisanaux (générés par xp.js)
   - Filtres par catégorie
   - Tap pour voir détails
   ========================================================= */

const BadgesScreen = (function() {

  let currentFilter = "all";

  /* =========================================================
     SHOW
     ========================================================= */
  function show() {
    if (!window.XP) return;
    refreshHeader();
    setupFilters();
    renderBadges();
  }

  /* =========================================================
     EN-TÊTE (compteur)
     ========================================================= */
  function refreshHeader() {
    const total = window.XP.getTotalBadges();
    const unlocked = window.XP.getUnlockedCount();

    const countEl = document.getElementById("badgesCount");
    const totalEl = document.getElementById("badgesTotal");

    if (countEl) countEl.textContent = unlocked;
    if (totalEl) totalEl.textContent = total;
  }

  /* =========================================================
     FILTRES (chips de catégorie)
     ========================================================= */
  function setupFilters() {
    const chips = document.querySelectorAll(".filter-chip");
    chips.forEach(function(chip) {
      // Réinitialiser handlers
      chip.onclick = function() {
        const filter = chip.getAttribute("data-filter");
        if (!filter) return;
        applyFilter(filter);
        if (window.Audio) window.Audio.tap();
      };
    });
  }

  function applyFilter(filter) {
    currentFilter = filter;

    // Update visual state
    document.querySelectorAll(".filter-chip").forEach(function(chip) {
      chip.classList.toggle("active", chip.getAttribute("data-filter") === filter);
    });

    renderBadges();
  }

  /* =========================================================
     RENDU DE LA GRILLE
     ========================================================= */
  function renderBadges() {
    const grid = document.getElementById("badgesGridFull");
    if (!grid || !window.XP) return;

    grid.innerHTML = "";

    const badges = window.XP.getBadgesByCategory(currentFilter);

    if (badges.length === 0) {
      grid.innerHTML =
        '<div style="grid-column: 1 / -1; text-align:center; padding:18px; color:var(--ink-muted); font-style:italic; font-family:\'Cormorant Garamond\',serif;">' +
          'Aucun badge dans cette catégorie.' +
        '</div>';
      return;
    }

    badges.forEach(function(badge) {
      const isUnlocked = window.State && window.State.isBadgeUnlocked(badge.id);
      const isRare = badge.tier === "rare";

      const cell = document.createElement("button");
      cell.className = "badge" + (isUnlocked ? "" : " locked") + (isRare ? " rare" : "");
      cell.type = "button";
      cell.setAttribute("data-action", "show-badge-detail");
      cell.setAttribute("data-badge-id", badge.id);

      cell.innerHTML =
        '<div class="badge-svg">' + window.XP.getBadgeSVG(badge) + '</div>' +
        '<div class="nm">' + escapeHTML(badge.name) + '</div>' +
        '<div class="ds">' + escapeHTML(badge.desc) + '</div>';

      grid.appendChild(cell);
    });
  }

  /* =========================================================
     DÉTAIL D'UN BADGE (modale)
     ========================================================= */
  function showBadgeDetail(badgeId) {
    if (!window.XP) return;

    const badge = window.XP.getBadge(badgeId);
    if (!badge) return;

    const isUnlocked = window.State && window.State.isBadgeUnlocked(badge.id);

    // Réutiliser la modale "badge unlocked" pour les détails
    const modal = document.getElementById("modalBadgeUnlock");
    if (!modal) return;

    const visualEl = document.getElementById("unlockBadgeVisual");
    const nameEl = document.getElementById("unlockBadgeName");
    const descEl = document.getElementById("unlockBadgeDesc");
    const titleEl = modal.querySelector(".panel-title");

    if (visualEl) visualEl.innerHTML = window.XP.getBadgeSVG(badge);
    if (nameEl) nameEl.textContent = badge.name;
    if (descEl) {
      descEl.textContent = isUnlocked
        ? "Débloqué — " + badge.desc
        : "À débloquer : " + badge.desc;
    }
    if (titleEl) {
      titleEl.textContent = isUnlocked ? "Badge obtenu" : "Badge à débloquer";
    }

    // Ajouter ou retirer effet visuel selon état
    if (visualEl) {
      visualEl.style.opacity = isUnlocked ? "1" : "0.4";
      visualEl.style.filter = isUnlocked ? "" : "grayscale(0.7)";
    }

    // Afficher la modale
    modal.hidden = false;
    if (window.Audio) window.Audio.tap();
  }

  /* =========================================================
     RAFRAÎCHIR SUR ÉVÉNEMENTS
     ========================================================= */
  document.addEventListener("badge-unlocked", function() {
    if (isBadgesVisible()) {
      refreshHeader();
      renderBadges();
    }
  });

  document.addEventListener("xp-gained", function() {
    if (isBadgesVisible()) {
      // Re-render pour potentiellement débloquer de nouveaux badges
      refreshHeader();
      renderBadges();
    }
  });

  function isBadgesVisible() {
    const screen = document.getElementById("screen-badges");
    return screen && screen.classList.contains("active");
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* -------- API publique -------- */
  return {
    show: show,
    applyFilter: applyFilter,
    showBadgeDetail: showBadgeDetail,
    refreshHeader: refreshHeader
  };
})();

window.BadgesScreen = BadgesScreen;
console.log("✓ BadgesScreen chargé (galerie 30 badges)");
