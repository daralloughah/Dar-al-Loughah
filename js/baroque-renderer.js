/* =========================================================
   DAR AL LOUGHAH — baroque-renderer.js
   Génère des cards baroque réutilisables
   ========================================================= */

(function () {
  'use strict';

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
    notions: 'iconScroll'
  };

  function makeBaroqueCard(opts) {
    const icon = opts.icon || 'star';
    const title = opts.title || '';
    const sub = opts.sub || '';
    const full = opts.full || false;
    const target = opts.target || '';
    const action = opts.action || 'goto';
    const idx = opts.idx || 0;

    const symbolId = ICON_MAP[icon] || ICON_MAP.star;
    const shimmerDelay = (idx * 0.4) % 6;
    const floatDelay = (idx * 0.27) % 5;

    let dataAttrs = '';
    if (action) dataAttrs += ' data-action="' + action + '"';
    if (target) dataAttrs += ' data-target="' + target + '"';

    return '<button class="baroque-card' + (full ? ' baroque-card--full' : '') + '" type="button" aria-label="' + title + '" style="--shimmer-delay:' + shimmerDelay + 's; --float-delay:' + floatDelay + 's"' + dataAttrs + '>' +
      '<svg class="baroque-card__frame" preserveAspectRatio="none" viewBox="0 0 340 200">' +
        '<use href="#ornateFrame"/>' +
        '<g transform="translate(0,0)"><use href="#cornerFlourish" width="60" height="60"/></g>' +
        '<g transform="translate(340,0) scale(-1,1)"><use href="#cornerFlourish" width="60" height="60"/></g>' +
        '<g transform="translate(0,200) scale(1,-1)"><use href="#cornerFlourish" width="60" height="60"/></g>' +
        '<g transform="translate(340,200) scale(-1,-1)"><use href="#cornerFlourish" width="60" height="60"/></g>' +
        '<g transform="translate(-2,75)"><use href="#sideCart" width="24" height="50"/></g>' +
        '<g transform="translate(318,75)"><use href="#sideCart" width="24" height="50"/></g>' +
        '<g transform="translate(150,-2)"><use href="#midCart" width="40" height="16"/></g>' +
        '<g transform="translate(150,186)"><use href="#midCart" width="40" height="16"/></g>' +
      '</svg>' +
      '<div class="baroque-card__shimmer"></div>' +
      '<div class="baroque-card__inner">' +
        '<svg class="baroque-card__icon" viewBox="0 0 60 60"><use href="#' + symbolId + '"/></svg>' +
        '<div class="baroque-card__text">' +
          '<span class="baroque-card__title">' + title + '</span>' +
          (sub ? '<span class="baroque-card__sub">' + sub + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</button>';
  }

  function makeBaroqueGrid(items) {
    let html = '<div class="baroque-grid">';
    for (let i = 0; i < items.length; i++) {
      html += makeBaroqueCard(Object.assign({}, items[i], { idx: i }));
    }
    html += '</div>';
    return html;
  }

  function makeBaroqueSection(text) {
    return '<div class="baroque-section-head">' +
      '<span class="baroque-section-head__line"></span>' +
      '<svg class="baroque-section-head__rosette" viewBox="0 0 22 22"><use href="#rosette"/></svg>' +
      '<span class="baroque-section-head__text">' + text + '</span>' +
      '<svg class="baroque-section-head__rosette" viewBox="0 0 22 22"><use href="#rosette"/></svg>' +
      '<span class="baroque-section-head__line"></span>' +
    '</div>';
  }

  function makeBaroquePanel(opts) {
    const title = (opts && opts.title) || '';
    const content = (opts && opts.content) || '';
    return '<div class="baroque-panel">' +
      '<svg class="baroque-panel__frame" preserveAspectRatio="none" viewBox="0 0 340 200">' +
        '<use href="#ornateFrame"/>' +
      '</svg>' +
      '<div class="baroque-panel__inner">' +
        (title ? '<div class="baroque-panel__title">' + title + '</div>' : '') +
        '<div class="baroque-panel__content">' + content + '</div>' +
      '</div>' +
    '</div>';
  }

  function makeBaroqueHeader(title, subtitle) {
    subtitle = subtitle || '';
    return '<div class="baroque-header">' +
      '<div class="baroque-header__line"></div>' +
      '<h2 class="baroque-header__title">' + title + '</h2>' +
      (subtitle ? '<p class="baroque-header__sub">' + subtitle + '</p>' : '') +
      '<div class="baroque-header__line"></div>' +
    '</div>';
  }

  function makeBaroqueButton(label, opts) {
    opts = opts || {};
    let attrs = '';
    if (opts.action) attrs += ' data-action="' + opts.action + '"';
    if (opts.target) attrs += ' data-target="' + opts.target + '"';
    if (opts.id) attrs += ' id="' + opts.id + '"';
    return '<button class="baroque-btn" type="button"' + attrs + '>' +
      '<span class="baroque-btn__label">' + label + '</span>' +
    '</button>';
  }

  window.Baroque = {
    makeCard: makeBaroqueCard,
    makeGrid: makeBaroqueGrid,
    makeSection: makeBaroqueSection,
    makePanel: makeBaroquePanel,
    makeHeader: makeBaroqueHeader,
    makeButton: makeBaroqueButton,
    ICON_MAP: ICON_MAP
  };

})();
