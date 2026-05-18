/* =========================================================
   DAR AL LOUGHAH — baroque-renderer.js
   ---------------------------------------------------------
   Génère des cards baroque (style menu principal artifact)
   pour n'importe quel écran. Réutilisable partout.
   ========================================================= */

(function () {
  'use strict';

  // ===== Mapping icon name → SVG symbol id =====
  // Si tu ajoutes une icône, mets-la ici + dans le SVG library
  const ICON_MAP = {
    book: 'iconBook',
    alphabet: 'iconAlphabet',
    groups: 'iconGroups',
    star: 'iconStar',
    lists: 'iconLists',
    badge: 'iconBadge',
    trophy: 'iconTrophy',
    scroll: 'iconScroll',
    quill: 'iconQuill',
    key: 'iconKey',
    compass: 'iconCompass',
    gear: 'iconGear',
    profile: 'iconProfile',
    mail: 'iconMail',
    // alias pratiques
    themes: 'iconBook',
    reading: 'iconAlphabet',
    quiz: 'iconQuill',
    rapid: 'iconStar',
    chat: 'iconGroups',
    wotd: 'iconStar',
    badges: 'iconBadge',
    leaderboard: 'iconTrophy',
    premium: 'iconBadge',
    settings: 'iconGear',
    contact: 'iconMail',
    dictionnaire: 'iconQuill',
    methode: 'iconCompass',
    contenus: 'iconKey',
    notions: 'iconScroll',
    'notions-etymo': 'iconScroll',
  };

  /**
   * Génère le HTML d'une card baroque
   * @param {Object} opts
   * @param {string} opts.icon      - clé du ICON_MAP (ex: 'book', 'star')
   * @param {string} opts.title     - titre principal de la card
   * @param {string} opts.sub       - sous-titre (italique)
   * @param {boolean} opts.full     - true → card pleine largeur (2 colonnes)
   * @param {string} opts.target    - data-target (pour goto)
   * @param {string} opts.action    - data-action (défaut: 'goto')
   * @param {number} opts.idx       - index pour les délais d'animation
   * @returns {string} HTML
   */
  function makeBaroqueCard(opts) {
    const {
      icon = 'star',
      title = '',
      sub = '',
      full = false,
      target = '',
      action = 'goto',
      idx = 0,
    } = opts;

    const symbolId = ICON_MAP[icon] || ICON_MAP.star;
    const shimmerDelay = (idx * 0.4) % 6;
    const floatDelay = (idx * 0.27) % 5;

    const dataAttrs = [
      action ? `data-action="${action}"` : '',
      target ? `data-target="${target}"` : '',
    ].filter(Boolean).join(' ');

    return `
      <button
        class="baroque-card${full ? ' baroque-card--full' : ''}"
        type="button"
        aria-label="${title}"
        style="--shimmer-delay:${shimmerDelay}s; --float-delay:${floatDelay}s"
        ${dataAttrs}
      >
        <svg class="baroque-card__frame" preserveAspectRatio="none" viewBox="0 0 340 200">
          <use href="#ornateFrame"/>
          <g transform="translate(0,0)"><use href="#cornerFlourish" width="60" height="60"/></g>
          <g transform="translate(340,0) scale(-1,1)"><use href="#cornerFlourish" width="60" height="60"/></g>
          <g transform="translate(0,200) scale(1,-1)"><use href="#cornerFlourish" width="60" height="60"/></g>
          <g transform="translate(340,200) scale(-1,-1)"><use href="#cornerFlourish" width="60" height="60"/></g>
          <g transform="translate(-2,75)"><use href="#sideCart" width="24" height="50"/></g>
          <g transform="translate(318,75)"><use href="#sideCart" width="24" height="50"/></g>
          <g transform="translate(150,-2)"><use href="#midCart" width="40" height="16"/></g>
          <g transform="translate(150,186)"><use href="#midCart" width="40" height="16"/></g>
        </svg>
        <div class="baroque-card__shimmer"></div>
        <div class="baroque-card__inner">
          <svg class="baroque-card__icon" viewBox="0 0 60 60"><use href="#${symbolId}"/></svg>
          <div class="baroque-card__text">
            <span class="baroque-card__title">${title}</span>
            ${sub ? `<span class="baroque-card__sub">${sub}</span>` : ''}
          </div>
        </div>
      </button>
    `;
  }

  /**
   * Génère une grille de cards baroque
   * @param {Array} items - tableau d'objets pour makeBaroqueCard
   * @returns {string} HTML d'une grille complète
   */
  function makeBaroqueGrid(items) {
    return `
      <div class="baroque-grid">
        ${items.map((item, i) => makeBaroqueCard({ ...item, idx: i })).join('')}
      </div>
    `;
  }

  /**
   * Génère un séparateur de section baroque
   * @param {string} text - texte du séparateur
   * @returns {string} HTML
   */
  function makeBaroqueSection(text) {
    return `
      <div class="baroque-section-head">
        <span class="baroque-section-head__line"></span>
        <svg class="baroque-section-head__rosette" viewBox="0 0 22 22"><use href="#rosette"/></svg>
        <span class="baroque-section-head__text">${text}</span>
        <svg class="baroque-section-head__rosette" viewBox="0 0 22 22"><use href="#rosette"/></svg>
        <span class="baroque-section-head__line"></span>
      </div>
    `;
  }

  /**
   * Remplace le contenu d'un élément par une grille baroque
   * @param {string|HTMLElement} target - sélecteur ou élément
   * @param {Array} items - items pour la grille
   */
  function renderBaroqueGrid(target, items) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) {
      console.warn('[baroque] target introuvable:', target);
      return;
    }
    el.innerHTML = makeBaroqueGrid(items);
  }

  /**
   * Transforme automatiquement les .menu-row d'un écran en cards baroque.
   * Lit les data-target et title existants. Préserve la logique JS.
   * @param {string|HTMLElement} container - sélecteur du conteneur (ex: '#screen-menu')
   * @param {Object} iconOverrides - mapping {target: iconName} pour override
   */
  function upgradeMenuRows(container, iconOverrides = {}) {
    const root = typeof container === 'string' ? document.querySelector(container) : container;
    if (!root) return;

    const rows = root.querySelectorAll('.menu-row');
    if (!rows.length) return;

    // Construit le tableau d'items à partir des .menu-row existants
    const items = Array.from(rows).map((row) => {
      const target = row.dataset.target || '';
      const action = row.dataset.action || 'goto';
      const titleEl = row.querySelector('.title');
      const title = titleEl ? titleEl.textContent.trim().replace(/^[🏆⚙️✦]\s*/, '') : '';
      const icon = iconOverrides[target] || target || 'star';
      const isPremium = row.dataset.premium === 'true';

      return {
        icon,
        title,
        sub: '',
        target,
        action,
        premium: isPremium,
      };
    });

    // Trouve le panel parent ou crée un wrapper
    const panel = root.querySelector('.panel');
    if (panel) {
      // Garde le panel-title s'il existe
      const panelTitle = panel.querySelector('.panel-title');
      const titleHtml = panelTitle ? panelTitle.outerHTML : '';
      panel.innerHTML = titleHtml + makeBaroqueGrid(items);

      // Réapplique data-premium sur les cards
      items.forEach((item, i) => {
        if (item.premium) {
          const card = panel.querySelectorAll('.baroque-card')[i];
          if (card) card.dataset.premium = 'true';
        }
      });
    }
  }
  /**
   * Génère un panel baroque (cadre doré ornementé pour contenir du contenu)
   * @param {Object} opts
   * @param {string} opts.title    - titre du panel (optionnel)
   * @param {string} opts.content  - HTML interne
   * @param {string} opts.id       - id optionnel
   * @returns {string} HTML
   */
  function makeBaroquePanel(opts) {
    const { title = '', content = '', id = '' } = opts;
    return `
      <div class="baroque-panel" ${id ? `id="${id}"` : ''}>
        <svg class="baroque-panel__frame" preserveAspectRatio="none" viewBox="0 0 340 200">
          <use href="#ornateFrame"/>
          <g transform="translate(0,0)"><use href="#cornerFlourish" width="50" height="50"/></g>
          <g transform="translate(340,0) scale(-1,1)"><use href="#cornerFlourish" width="50" height="50"/></g>
          <g transform="translate(0,200) scale(1,-1)"><use href="#cornerFlourish" width="50" height="50"/></g>
          <g transform="translate(340,200) scale(-1,-1)"><use href="#cornerFlourish" width="50" height="50"/></g>
        </svg>
        <div class="baroque-panel__inner">
          ${title ? `<div class="baroque-panel__title">${title}</div>` : ''}
          <div class="baroque-panel__content">${content}</div>
        </div>
      </div>
    `;
  }

  /**
   * Génère un header baroque (titre médaillon doré au sommet d'un écran)
   * @param {string} title - le titre à afficher
   * @param {string} subtitle - sous-titre optionnel
   * @returns {string} HTML
   */
  function makeBaroqueHeader(title, subtitle = '') {
    return `
      <div class="baroque-header">
        <div class="baroque-header__line"></div>
        <h2 class="baroque-header__title">${title}</h2>
        ${subtitle ? `<p class="baroque-header__sub">${subtitle}</p>` : ''}
        <div class="baroque-header__line"></div>
      </div>
    `;
  }

  /**
   * Génère un bouton baroque doré (style des cards mais en format bouton)
   * @param {string} label - texte du bouton
   * @param {Object} opts - { action, target, id, full }
   * @returns {string} HTML
   */
  function makeBaroqueButton(label, opts = {}) {
    const { action = '', target = '', id = '', full = false } = opts;
    const dataAttrs = [
      action ? `data-action="${action}"` : '',
      target ? `data-target="${target}"` : '',
      id ? `id="${id}"` : '',
    ].filter(Boolean).join(' ');
    return `
      <button class="baroque-btn${full ? ' baroque-btn--full' : ''}" type="button" ${dataAttrs}>
        <span class="baroque-btn__label">${label}</span>
      </button>
    `;
  }

  /**
   * Génère une mini-card baroque carrée (pour Mot du jour, Badges, Premium)
   * @param {Object} opts - { icon, title, target }
   * @returns {string} HTML
   */
  function makeBaroqueMiniCard(opts) {
    const { icon = 'star', title = '', target = '', action = 'goto' } = opts;
    const symbolId = ICON_MAP[icon] || ICON_MAP.star;
    return `
      <button class="baroque-mini" type="button"
              ${action ? `data-action="${action}"` : ''}
              ${target ? `data-target="${target}"` : ''}>
        <svg class="baroque-mini__frame" preserveAspectRatio="none" viewBox="0 0 100 100">
          <rect x="3" y="3" width="94" height="94" rx="8" fill="url(#goldRimV)"/>
          <rect x="10" y="10" width="80" height="80" rx="4" fill="url(#navyPanel)"/>
          <rect x="10" y="10" width="80" height="80" rx="4" fill="none" stroke="#6b4a0e" stroke-width="1"/>
          <g transform="translate(0,0)"><use href="#cornerFlourish" width="30" height="30"/></g>
          <g transform="translate(100,0) scale(-1,1)"><use href="#cornerFlourish" width="30" height="30"/></g>
          <g transform="translate(0,100) scale(1,-1)"><use href="#cornerFlourish" width="30" height="30"/></g>
          <g transform="translate(100,100) scale(-1,-1)"><use href="#cornerFlourish" width="30" height="30"/></g>
        </svg>
        <div class="baroque-mini__inner">
          <svg class="baroque-mini__icon" viewBox="0 0 60 60"><use href="#${symbolId}"/></svg>
          <span class="baroque-mini__title">${title}</span>
        </div>
      </button>
    `;
  }

  window.Baroque = {
    makeCard: makeBaroqueCard,
    makeGrid: makeBaroqueGrid,
    makeSection: makeBaroqueSection,
    makePanel: makeBaroquePanel,
    makeHeader: makeBaroqueHeader,
    makeButton: makeBaroqueButton,
    makeMiniCard: makeBaroqueMiniCard,
    renderGrid: renderBaroqueGrid,
    upgradeMenuRows: upgradeMenuRows,
    ICON_MAP,
  };
