/* =========================================================
   DAR AL LOUGHAH — APPRENDRE v2 (5 ÉTAGES + breadcrumb)
   Catégorie › Domaine › Branche (opt) › Thème › Sous-thème › Niveau
   ========================================================= */

const ThemesScreen = (function() {

  let allThemes = [];          // cache de tous les thèmes Supabase
  let currentPath = {           // où on est dans la navigation
    category: null,
    domain: null,
    branch: null,
    themeId: null,
    subThemeId: null,
    levelId: null
  };

  // Catégories (mêmes que l'admin)
  const CATEGORIES = [
    { id: "religieux",  name: "Sciences Religieuses", emoji: "🕌", desc: "Fiqh, Aqida, Quran, Tajwid, Hadith..." },
    { id: "quotidien",  name: "Vie Quotidienne",      emoji: "💬", desc: "Salutations, famille, voyage..." },
    { id: "classique",  name: "Langue Classique",     emoji: "📜", desc: "Poésie, éloquence, grammaire" },
    { id: "academique", name: "Académique",           emoji: "🎓", desc: "Vocabulaire universitaire" },
    { id: "monde",      name: "Monde & Société",      emoji: "🌍", desc: "Métiers, sciences, actualité" },
    { id: "institut",   name: "Programmes Instituts", emoji: "⭐", desc: "Contenu officiel" }
  ];

  /* =========================================================
     ENTRÉE PRINCIPALE
     ========================================================= */
  async function show() {
    const root = getRoot();
    if (!root) return;

    root.innerHTML = '<div class="apprendre-loading">Chargement…</div>';

    try {
      allThemes = await window.FB.getCollection("themes") || [];
      allThemes.forEach(normalizeTheme);
    } catch (e) {
      root.innerHTML = '<div class="apprendre-empty">Impossible de charger les thèmes.<br>' + (e.message||"") + '</div>';
      return;
    }

    // Réinitialise la navigation : retour à la racine (catégories)
    currentPath = { category: null, domain: null, branch: null, themeId: null, subThemeId: null, levelId: null };
    renderCategoriesView();
  }

  // Récupère le conteneur principal (compatible avec l'ancien design)
  function getRoot() {
    // Cherche d'abord un container dédié, sinon fallback sur themesGrid
    let root = document.getElementById("apprendreRoot");
    if (root) return root;

    const grid = document.getElementById("themesGrid");
    if (grid) {
      // Crée un container parent au grid existant
      const parent = grid.parentElement;
      if (parent) {
        let host = parent.querySelector("#apprendreRoot");
        if (!host) {
          host = document.createElement("div");
          host.id = "apprendreRoot";
          host.className = "apprendre-screen";
          grid.style.display = "none";
          parent.insertBefore(host, grid);
        }
        return host;
      }
    }
    return null;
  }

  function normalizeTheme(t) {
    if (!t) return t;
    if (!t.category) t.category = "quotidien";
    if (!t.domain) t.domain = "";
    if (t.branch === undefined) t.branch = "";
    if (!Array.isArray(t.subThemes)) t.subThemes = [];
    return t;
  }

  /* =========================================================
     BREADCRUMB (fil d'Ariane cliquable)
     ========================================================= */
  function buildBreadcrumb() {
    const parts = [];
    parts.push({ label: "📚 Apprendre", action: "home" });

    if (currentPath.category) {
      const cat = CATEGORIES.find(function(c){ return c.id === currentPath.category; });
      if (cat) parts.push({ label: cat.emoji + " " + cat.name, action: "category" });
    }
    if (currentPath.domain) {
      parts.push({ label: "📚 " + currentPath.domain, action: "domain" });
    }
    if (currentPath.branch) {
      parts.push({ label: "🌿 " + currentPath.branch, action: "branch" });
    }
    if (currentPath.themeId) {
      const t = allThemes.find(function(x){ return x._id === currentPath.themeId; });
      if (t) parts.push({ label: "📖 " + (t.name || ""), action: "theme" });
    }
    if (currentPath.subThemeId) {
      const t = allThemes.find(function(x){ return x._id === currentPath.themeId; });
      const sub = t && (t.subThemes||[]).find(function(s){ return s.id === currentPath.subThemeId; });
      if (sub) parts.push({ label: "📑 " + sub.name, action: "subTheme" });
    }
    if (currentPath.levelId) {
      const t = allThemes.find(function(x){ return x._id === currentPath.themeId; });
      const sub = t && (t.subThemes||[]).find(function(s){ return s.id === currentPath.subThemeId; });
      const lvl = sub && (sub.customLevels||[]).find(function(l){ return l.id === currentPath.levelId; });
      if (lvl) parts.push({ label: "🎯 " + lvl.name, action: "level" });
    }

    let html = '<div class="apprendre-breadcrumb">';
    parts.forEach(function(p, i) {
      const isLast = i === parts.length - 1;
      if (isLast) {
        html += '<span class="bc-current">' + escapeHTML(p.label) + '</span>';
      } else {
        html += '<button class="bc-link" data-bc="' + p.action + '" type="button">' + escapeHTML(p.label) + '</button>';
        html += '<span class="bc-sep">›</span>';
      }
    });
    html += '</div>';
    return html;
  }

  function buildBackButton() {
    if (!currentPath.category) return ""; // sur la home, pas de retour
    return '<button class="apprendre-back" id="apprBackBtn" type="button">← Retour</button>';
  }

  function bindBreadcrumb() {
    document.querySelectorAll("[data-bc]").forEach(function(b) {
      b.onclick = function() {
        const action = b.getAttribute("data-bc");
        navigateTo(action);
      };
    });
    const back = document.getElementById("apprBackBtn");
    if (back) back.onclick = goBack;
  }

  function navigateTo(level) {
    // Remet à null tout ce qui est APRÈS le niveau cliqué
    switch (level) {
      case "home":
        currentPath = { category: null, domain: null, branch: null, themeId: null, subThemeId: null, levelId: null };
        renderCategoriesView(); break;
      case "category":
        currentPath.domain = null; currentPath.branch = null; currentPath.themeId = null; currentPath.subThemeId = null; currentPath.levelId = null;
        renderDomainsView(); break;
      case "domain":
        currentPath.branch = null; currentPath.themeId = null; currentPath.subThemeId = null; currentPath.levelId = null;
        renderAfterDomainView(); break;
      case "branch":
        currentPath.themeId = null; currentPath.subThemeId = null; currentPath.levelId = null;
        renderThemesView(); break;
      case "theme":
        currentPath.subThemeId = null; currentPath.levelId = null;
        renderSubThemesView(); break;
      case "subTheme":
        currentPath.levelId = null;
        renderLevelsView(); break;
    }
  }

  function goBack() {
    if (currentPath.levelId) { currentPath.levelId = null; renderLevelsView(); return; }
    if (currentPath.subThemeId) { currentPath.subThemeId = null; renderSubThemesView(); return; }
    if (currentPath.themeId) { currentPath.themeId = null; renderThemesView(); return; }
    if (currentPath.branch) { currentPath.branch = null; renderAfterDomainView(); return; }
    if (currentPath.domain) { currentPath.domain = null; renderDomainsView(); return; }
    if (currentPath.category) { currentPath.category = null; renderCategoriesView(); return; }
  }

  /* =========================================================
     ÉTAGE 1 — CATÉGORIES (page d'accueil)
     ========================================================= */
  function renderCategoriesView() {
    const root = getRoot();
    if (!root) return;

    // On filtre les catégories qui ont AU MOINS un thème
    const counts = {};
    CATEGORIES.forEach(function(c){ counts[c.id] = 0; });
    allThemes.forEach(function(t){ if (counts[t.category] !== undefined) counts[t.category]++; });

    let cardsHtml = CATEGORIES.map(function(c) {
      const n = counts[c.id] || 0;
      const empty = n === 0 ? " apprendre-card-empty" : "";
      return '<button class="apprendre-card apprendre-card-cat' + empty + '" data-cat="' + c.id + '" type="button">' +
          '<div class="apprendre-card-emoji">' + c.emoji + '</div>' +
          '<div class="apprendre-card-title">' + escapeHTML(c.name) + '</div>' +
          '<div class="apprendre-card-desc">' + escapeHTML(c.desc) + '</div>' +
          '<div class="apprendre-card-count">' + (n === 0 ? "À venir 🌱" : (n + " thème" + (n>1?"s":""))) + '</div>' +
        '</button>';
    }).join("");

    root.innerHTML =
      buildBreadcrumb() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">Choisis ta science</h2>' +
        '<input class="apprendre-search" type="search" id="apprSearch" placeholder="🔍 Rechercher un thème..."/>' +
      '</div>' +
      '<div class="apprendre-grid">' + cardsHtml + '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-cat]").forEach(function(b) {
      b.onclick = function() {
        const catId = b.getAttribute("data-cat");
        if (counts[catId] === 0) return; // empty, on bloque
        currentPath.category = catId;
        renderDomainsView();
      };
    });

    // Recherche globale
    const sb = document.getElementById("apprSearch");
    if (sb) sb.addEventListener("input", function() {
      const q = sb.value.toLowerCase().trim();
      if (q.length < 2) { renderCategoriesView(); return; }
      renderSearchResults(q);
    });
  }

  /* =========================================================
     RECHERCHE GLOBALE
     ========================================================= */
  function renderSearchResults(q) {
    const root = getRoot();
    if (!root) return;
    const hits = allThemes.filter(function(t){
      return (t.name||"").toLowerCase().indexOf(q)!==-1 ||
             (t.domain||"").toLowerCase().indexOf(q)!==-1 ||
             (t.branch||"").toLowerCase().indexOf(q)!==-1 ||
             (t.nameAr||"").toLowerCase().indexOf(q)!==-1;
    });

    let html = buildBreadcrumb() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">Résultats : ' + hits.length + '</h2>' +
        '<input class="apprendre-search" type="search" id="apprSearch" value="' + escapeHTML(q) + '" placeholder="🔍 Rechercher..."/>' +
      '</div>';

    if (hits.length === 0) {
      html += '<div class="apprendre-empty">Aucun résultat pour « ' + escapeHTML(q) + ' »</div>';
    } else {
      html += '<div class="apprendre-grid">';
      hits.forEach(function(t){
        const cat = CATEGORIES.find(function(c){ return c.id === t.category; }) || CATEGORIES[1];
        html += '<button class="apprendre-card apprendre-card-theme" data-theme="' + t._id + '" type="button">' +
          '<div class="apprendre-card-emoji">' + (t.icon || cat.emoji) + '</div>' +
          '<div class="apprendre-card-title">' + escapeHTML(t.name || "") + '</div>' +
          '<div class="apprendre-card-path">' + cat.emoji + ' ' + escapeHTML(t.domain || "") + (t.branch ? ' › ' + escapeHTML(t.branch) : "") + '</div>' +
          '</button>';
      });
      html += '</div>';
    }

    root.innerHTML = html;
    bindBreadcrumb();
    root.querySelectorAll("[data-theme]").forEach(function(b) {
      b.onclick = function() {
        const t = allThemes.find(function(x){ return x._id === b.getAttribute("data-theme"); });
        if (!t) return;
        currentPath.category = t.category;
        currentPath.domain = t.domain;
        currentPath.branch = t.branch || null;
        currentPath.themeId = t._id;
        renderSubThemesView();
      };
    });
    const sb = document.getElementById("apprSearch");
    if (sb) {
      sb.focus();
      sb.setSelectionRange(sb.value.length, sb.value.length);
      sb.addEventListener("input", function() {
        const v = sb.value.toLowerCase().trim();
        if (v.length < 2) renderCategoriesView();
        else renderSearchResults(v);
      });
    }
  }

  /* =========================================================
     ÉTAGE 2 — DOMAINES (à l'intérieur d'une catégorie)
     ========================================================= */
  function renderDomainsView() {
    const root = getRoot();
    if (!root) return;
    const cat = CATEGORIES.find(function(c){ return c.id === currentPath.category; });
    if (!cat) { renderCategoriesView(); return; }

    // Collecte tous les domaines uniques de cette catégorie
    const domainsMap = {};
    allThemes.forEach(function(t) {
      if (t.category !== currentPath.category) return;
      const d = t.domain || "Autres";
      if (!domainsMap[d]) domainsMap[d] = 0;
      domainsMap[d]++;
    });
    const domains = Object.keys(domainsMap).sort();

    let cardsHtml = domains.map(function(d) {
      return '<button class="apprendre-card apprendre-card-domain" data-domain="' + escapeHTML(d) + '" type="button">' +
          '<div class="apprendre-card-emoji">📚</div>' +
          '<div class="apprendre-card-title">' + escapeHTML(d) + '</div>' +
          '<div class="apprendre-card-count">' + domainsMap[d] + ' thème' + (domainsMap[d]>1?"s":"") + '</div>' +
        '</button>';
    }).join("");

    if (domains.length === 0) {
      cardsHtml = '<div class="apprendre-empty">Aucun domaine dans cette catégorie pour l\'instant 🌱</div>';
    }

    root.innerHTML =
      buildBreadcrumb() +
      buildBackButton() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">' + cat.emoji + ' ' + escapeHTML(cat.name) + '</h2>' +
        '<p class="apprendre-subtitle">' + escapeHTML(cat.desc) + '</p>' +
      '</div>' +
      '<div class="apprendre-grid">' + cardsHtml + '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-domain]").forEach(function(b) {
      b.onclick = function() {
        currentPath.domain = b.getAttribute("data-domain");
        renderAfterDomainView();
      };
    });
  }

  /* =========================================================
     ÉTAGE 3 — BRANCHES (si le domaine en a) OU directement thèmes
     ========================================================= */
  function renderAfterDomainView() {
    // Y a-t-il des branches dans ce domaine ?
    const themesInDomain = allThemes.filter(function(t) {
      return t.category === currentPath.category && t.domain === currentPath.domain;
    });

    const hasBranches = themesInDomain.some(function(t){ return t.branch && t.branch.trim(); });

    if (hasBranches) {
      renderBranchesView();
    } else {
      // Pas de branche → on saute directement aux thèmes
      currentPath.branch = null;
      renderThemesView();
    }
  }

  function renderBranchesView() {
    const root = getRoot();
    if (!root) return;

    const branchesMap = {};
    let noBranchCount = 0;
    allThemes.forEach(function(t) {
      if (t.category !== currentPath.category || t.domain !== currentPath.domain) return;
      if (t.branch) {
        if (!branchesMap[t.branch]) branchesMap[t.branch] = 0;
        branchesMap[t.branch]++;
      } else {
        noBranchCount++;
      }
    });
    const branches = Object.keys(branchesMap).sort();

    let cardsHtml = branches.map(function(b) {
      return '<button class="apprendre-card apprendre-card-branch" data-branch="' + escapeHTML(b) + '" type="button">' +
          '<div class="apprendre-card-emoji">🌿</div>' +
          '<div class="apprendre-card-title">' + escapeHTML(b) + '</div>' +
          '<div class="apprendre-card-count">' + branchesMap[b] + ' thème' + (branchesMap[b]>1?"s":"") + '</div>' +
        '</button>';
    }).join("");

    if (noBranchCount > 0) {
      cardsHtml += '<button class="apprendre-card apprendre-card-branch" data-branch="__none__" type="button">' +
          '<div class="apprendre-card-emoji">📖</div>' +
          '<div class="apprendre-card-title">Sans branche</div>' +
          '<div class="apprendre-card-count">' + noBranchCount + ' thème' + (noBranchCount>1?"s":"") + '</div>' +
        '</button>';
    }

    root.innerHTML =
      buildBreadcrumb() +
      buildBackButton() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">📚 ' + escapeHTML(currentPath.domain) + '</h2>' +
        '<p class="apprendre-subtitle">Choisis une école ou un courant</p>' +
      '</div>' +
      '<div class="apprendre-grid">' + cardsHtml + '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-branch]").forEach(function(b) {
      b.onclick = function() {
        const val = b.getAttribute("data-branch");
        currentPath.branch = (val === "__none__") ? "" : val;
        renderThemesView();
      };
    });
  }
  /* =========================================================
     ÉTAGE 4 — THÈMES (livres / sujets précis)
     ========================================================= */
  function renderThemesView() {
    const root = getRoot();
    if (!root) return;

    const list = allThemes.filter(function(t) {
      if (t.category !== currentPath.category) return false;
      if (t.domain !== currentPath.domain) return false;
      if (currentPath.branch && currentPath.branch !== t.branch) return false;
      if (!currentPath.branch && t.branch) return false; // "Sans branche"
      return true;
    }).sort(function(a,b){ return (a.order||99)-(b.order||99); });

    let cardsHtml = list.map(function(t) {
      const cat = CATEGORIES.find(function(c){ return c.id === t.category; }) || CATEGORIES[1];
      const wordCount = countWordsInTheme(t);
      const subCount = (t.subThemes || []).length;
      const prog = getThemeProgress(t._id);
      return '<button class="apprendre-card apprendre-card-theme" data-theme="' + escapeHTML(t._id) + '" type="button">' +
          '<div class="apprendre-card-emoji">' + (t.icon || cat.emoji) + '</div>' +
          (t.nameAr ? '<div class="apprendre-card-ar" dir="rtl">' + escapeHTML(t.nameAr) + '</div>' : '') +
          '<div class="apprendre-card-title">' + escapeHTML(t.name || "") + '</div>' +
          (t.description ? '<div class="apprendre-card-desc">' + escapeHTML(t.description) + '</div>' : '') +
          '<div class="apprendre-card-count">' + subCount + ' partie' + (subCount>1?"s":"") + ' · ' + wordCount + ' mot' + (wordCount>1?"s":"") + '</div>' +
          (prog.percent > 0 ? '<div class="apprendre-card-progress"><div class="apprendre-card-progress-fill" style="width:' + prog.percent + '%"></div></div>' : '') +
        '</button>';
    }).join("");

    if (list.length === 0) {
      cardsHtml = '<div class="apprendre-empty">Aucun thème ici pour l\'instant 🌱<br><small>Reviens bientôt, on enrichit la bibliothèque chaque semaine.</small></div>';
    }

    const headerTitle = currentPath.branch
      ? ("🌿 " + escapeHTML(currentPath.branch))
      : ("📚 " + escapeHTML(currentPath.domain));

    root.innerHTML =
      buildBreadcrumb() +
      buildBackButton() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">' + headerTitle + '</h2>' +
        '<p class="apprendre-subtitle">Choisis un thème à étudier</p>' +
      '</div>' +
      '<div class="apprendre-grid">' + cardsHtml + '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-theme]").forEach(function(b) {
      b.onclick = function() {
        currentPath.themeId = b.getAttribute("data-theme");
        renderSubThemesView();
      };
    });
  }

  function countWordsInTheme(theme) {
    let total = 0;
    (theme.subThemes || []).forEach(function(st) {
      (st.customLevels || []).forEach(function(lvl) {
        if (Array.isArray(lvl.words)) total += lvl.words.length;
      });
    });
    return total;
  }

  /* =========================================================
     ÉTAGE 5 — SOUS-THÈMES (chapitres du livre)
     ========================================================= */
  function renderSubThemesView() {
    const root = getRoot();
    if (!root) return;
    const theme = allThemes.find(function(t){ return t._id === currentPath.themeId; });
    if (!theme) { renderThemesView(); return; }

    const subs = (theme.subThemes || []).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});

    let cardsHtml = subs.map(function(st) {
      const lvlCount = (st.customLevels || []).length;
      let wc = 0;
      (st.customLevels || []).forEach(function(l){ wc += (l.words||[]).length; });
      return '<button class="apprendre-card apprendre-card-sub" data-sub="' + escapeHTML(st.id) + '" type="button">' +
          '<div class="apprendre-card-emoji">' + escapeHTML(st.emoji || "📑") + '</div>' +
          '<div class="apprendre-card-title">' + escapeHTML(st.name) + '</div>' +
          '<div class="apprendre-card-count">' + lvlCount + ' niveau' + (lvlCount>1?"x":"") + ' · ' + wc + ' mot' + (wc>1?"s":"") + '</div>' +
        '</button>';
    }).join("");

    if (subs.length === 0) {
      cardsHtml = '<div class="apprendre-empty">Ce thème n\'a pas encore de contenu 🌱<br><small>Bientôt disponible inchâ\'Allah.</small></div>';
    }

    root.innerHTML =
      buildBreadcrumb() +
      buildBackButton() +
      '<div class="apprendre-header">' +
        (theme.nameAr ? '<div class="apprendre-title-ar" dir="rtl">' + escapeHTML(theme.nameAr) + '</div>' : '') +
        '<h2 class="apprendre-title">' + escapeHTML(theme.icon || "📖") + ' ' + escapeHTML(theme.name) + '</h2>' +
        (theme.description ? '<p class="apprendre-subtitle">' + escapeHTML(theme.description) + '</p>' : '') +
      '</div>' +
      '<div class="apprendre-grid">' + cardsHtml + '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-sub]").forEach(function(b) {
      b.onclick = function() {
        currentPath.subThemeId = b.getAttribute("data-sub");
        renderLevelsView();
      };
    });
  }

  /* =========================================================
     ÉTAGE 6 — NIVEAUX (avec 🔒 si verrouillés)
     ========================================================= */
  function renderLevelsView() {
    const root = getRoot();
    if (!root) return;
    const theme = allThemes.find(function(t){ return t._id === currentPath.themeId; });
    if (!theme) { renderThemesView(); return; }
    const sub = (theme.subThemes||[]).find(function(s){ return s.id === currentPath.subThemeId; });
    if (!sub) { renderSubThemesView(); return; }

    const userXp = (window.State && window.State.get("xp")) || 0;
    const isPremium = (window.State && window.State.get("isPremium")) || false;

    const levels = (sub.customLevels || []).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});

    let cardsHtml = levels.map(function(lvl, idx) {
      const wc = (lvl.words || []).length;
      const access = lvl.access || "free";
      let locked = false;
      let lockReason = "";

      if (access === "premium" && !isPremium) {
        locked = true;
        lockReason = "⭐ Premium requis";
      } else if (access === "xp") {
        const required = lvl.accessValue || 0;
        if (userXp < required) {
          locked = true;
          lockReason = "🎯 " + required + " XP requis (tu as " + userXp + ")";
        }
      } else if (access === "locked") {
        locked = true;
        lockReason = "🔒 Bientôt disponible";
      }

      const progress = getLevelProgress(theme._id, sub.id, lvl.id);

      return '<button class="apprendre-card apprendre-card-level' + (locked ? ' locked' : '') + '" ' +
          'data-level="' + escapeHTML(lvl.id) + '"' + (locked ? ' disabled' : '') + ' type="button">' +
          '<div class="apprendre-card-emoji">' + (locked ? "🔒" : escapeHTML(lvl.emoji || "🎯")) + '</div>' +
          '<div class="apprendre-card-title">' + escapeHTML(lvl.name) + '</div>' +
          '<div class="apprendre-card-count">' + (locked ? escapeHTML(lockReason) : (wc + " mot" + (wc>1?"s":""))) + '</div>' +
          (!locked && progress.percent > 0 ? '<div class="apprendre-card-progress"><div class="apprendre-card-progress-fill" style="width:' + progress.percent + '%"></div></div>' : '') +
          (!locked && progress.percent > 0 ? '<div class="apprendre-card-progress-text">' + progress.label + '</div>' : '') +
        '</button>';
    }).join("");

    if (levels.length === 0) {
      cardsHtml = '<div class="apprendre-empty">Aucun niveau dans ce chapitre 🌱<br><small>Bientôt disponible inchâ\'Allah.</small></div>';
    }

    root.innerHTML =
      buildBreadcrumb() +
      buildBackButton() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">' + escapeHTML(sub.emoji || "📑") + ' ' + escapeHTML(sub.name) + '</h2>' +
        '<p class="apprendre-subtitle">Choisis un niveau à étudier</p>' +
      '</div>' +
      '<div class="apprendre-grid">' + cardsHtml + '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-level]:not([disabled])").forEach(function(b) {
      b.onclick = function() {
        currentPath.levelId = b.getAttribute("data-level");
        renderLearningMenu();
      };
    });
  }

  function getLevelProgress(themeId, subId, levelId) {
    if (!window.State) return { label: "", percent: 0 };
    const tp = window.State.get("themeProgress") || {};
    const key = themeId + "::" + subId + "::" + levelId;
    const learned = (tp[key] && tp[key].wordsLearned) || 0;

    // Total mots du niveau
    const theme = allThemes.find(function(t){ return t._id === themeId; });
    const sub = theme && (theme.subThemes||[]).find(function(s){ return s.id === subId; });
    const lvl = sub && (sub.customLevels||[]).find(function(l){ return l.id === levelId; });
    const total = (lvl && lvl.words) ? lvl.words.length : 0;

    if (total === 0) return { label: "", percent: 0 };
    const pct = Math.round((learned / total) * 100);
    return { label: learned + "/" + total, percent: Math.min(100, pct) };
  }

  function getThemeProgress(themeId) {
    if (!window.State) return { percent: 0 };
    const tp = window.State.get("themeProgress") || {};
    const theme = allThemes.find(function(t){ return t._id === themeId; });
    if (!theme) return { percent: 0 };
    let total = 0, learned = 0;
    (theme.subThemes||[]).forEach(function(s) {
      (s.customLevels||[]).forEach(function(l) {
        total += (l.words||[]).length;
        const key = themeId + "::" + s.id + "::" + l.id;
        learned += (tp[key] && tp[key].wordsLearned) || 0;
      });
    });
    if (total === 0) return { percent: 0 };
    return { percent: Math.min(100, Math.round((learned/total)*100)) };
  }

  /* =========================================================
     ÉTAGE 7 — MENU APPRENTISSAGE (Vocab / QCM / Rapide)
     ========================================================= */
 function renderLearningMenu() {
    const root = getRoot();
    if (!root) return;
    const theme = allThemes.find(function(t){ return t._id === currentPath.themeId; });
    if (!theme) { renderThemesView(); return; }
    const sub = (theme.subThemes||[]).find(function(s){ return s.id === currentPath.subThemeId; });
    const lvl = sub && (sub.customLevels||[]).find(function(l){ return l.id === currentPath.levelId; });
    if (!lvl) { renderLevelsView(); return; }

    const wc = (lvl.words || []).length;

    root.innerHTML =
      buildBreadcrumb() +
      buildBackButton() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">' + escapeHTML(lvl.emoji || "🎯") + ' ' + escapeHTML(lvl.name) + '</h2>' +
        '<p class="apprendre-subtitle">' + wc + ' mot' + (wc>1?"s":"") + ' · Choisis ton mode</p>' +
      '</div>' +
      '<div class="apprendre-grid apprendre-grid-menu">' +
        '<button class="apprendre-card apprendre-card-mode" data-mode="cards" type="button">' +
          '<div class="apprendre-card-emoji">📚</div>' +
          '<div class="apprendre-card-title">Apprendre</div>' +
          '<div class="apprendre-card-desc">Cartes mot par mot pour découvrir et mémoriser</div>' +
        '</button>' +
        '<button class="apprendre-card apprendre-card-mode" data-mode="qcm" type="button">' +
          '<div class="apprendre-card-emoji">🎯</div>' +
          '<div class="apprendre-card-title">Quiz QCM</div>' +
          '<div class="apprendre-card-desc">Tester ce que tu as retenu</div>' +
        '</button>' +
        '<button class="apprendre-card apprendre-card-mode" data-mode="rapid" type="button">' +
          '<div class="apprendre-card-emoji">⚡</div>' +
          '<div class="apprendre-card-title">Révision rapide</div>' +
          '<div class="apprendre-card-desc">Mode chrono pour réviser ce que tu as appris</div>' +
        '</button>' +
        '<button class="apprendre-card apprendre-card-mode" data-mode="list" type="button">' +
          '<div class="apprendre-card-emoji">📋</div>' +
          '<div class="apprendre-card-title">Voir la liste</div>' +
          '<div class="apprendre-card-desc">Tous les mots du niveau d\'un coup d\'œil</div>' +
        '</button>' +
      '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-mode]").forEach(function(b) {
      b.onclick = function() {
        const mode = b.getAttribute("data-mode");
        if (mode === "list") {
          renderWordsList(theme, sub, lvl);
        } else {
          launchPractice(mode, theme, sub, lvl);
        }
      };
    });
  }

  /* =========================================================
     ÉCRAN "VOIR LA LISTE" — tous les mots du niveau
     ========================================================= */
  function renderWordsList(theme, sub, lvl) {
    const root = getRoot();
    if (!root) return;

    const words = lvl.words || [];
    const quizValidations = (window.State && window.State.get("quizValidations")) || {};
    const priorityIds = (window.State && window.State.get("priorityWords")) || {};

    let listHtml = "";
    if (words.length === 0) {
      listHtml = '<div class="apprendre-empty">Aucun mot dans ce niveau 🌱</div>';
    } else {
      listHtml = '<div class="apprendre-words-list">';
      words.forEach(function(w, i) {
        const wid = w.id || (theme._id + ":" + sub.id + ":" + lvl.id + ":" + i);
        const validations = quizValidations[wid] || 0;
        const mastered = validations >= 3;
        const priority = !!priorityIds[wid];
        listHtml += '<div class="apprendre-word-item' + (mastered ? ' mastered' : '') + '">' +
          '<div class="apprendre-word-main">' +
            '<div class="apprendre-word-ar" dir="rtl">' + escapeHTML(w.ar || "") + '</div>' +
            '<div class="apprendre-word-fr">' + escapeHTML(w.fr || "") + '</div>' +
            (w.example ? '<div class="apprendre-word-example" dir="rtl">' + escapeHTML(w.example) + '</div>' : '') +
            (w.exFr ? '<div class="apprendre-word-example-fr">' + escapeHTML(w.exFr) + '</div>' : '') +
          '</div>' +
          '<div class="apprendre-word-status">' +
            (mastered ? '<span class="badge-mastered">✓ Appris</span>' :
              '<span class="badge-progress">' + validations + '/3</span>') +
            (priority ? '<span class="badge-priority">⭐</span>' : '') +
          '</div>' +
        '</div>';
      });
      listHtml += '</div>';
    }

    root.innerHTML =
      buildBreadcrumb() +
      '<button class="apprendre-back" id="apprBackBtn" type="button">← Retour au menu</button>' +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">📋 Liste : ' + escapeHTML(lvl.name) + '</h2>' +
        '<p class="apprendre-subtitle">' + words.length + ' mot' + (words.length>1?"s":"") + ' au total</p>' +
      '</div>' +
      listHtml;

    bindBreadcrumb();
    // Le bouton "Retour" revient au menu d'apprentissage du niveau
    const back = document.getElementById("apprBackBtn");
    if (back) back.onclick = function() { renderLearningMenu(); };
  }

    const wc = (lvl.words || []).length;

    root.innerHTML =
      buildBreadcrumb() +
      buildBackButton() +
      '<div class="apprendre-header">' +
        '<h2 class="apprendre-title">' + escapeHTML(lvl.emoji || "🎯") + ' ' + escapeHTML(lvl.name) + '</h2>' +
        '<p class="apprendre-subtitle">' + wc + ' mot' + (wc>1?"s":"") + ' · Choisis ton mode</p>' +
      '</div>' +
      '<div class="apprendre-grid apprendre-grid-menu">' +
        '<button class="apprendre-card apprendre-card-mode" data-mode="cards" type="button">' +
          '<div class="apprendre-card-emoji">📚</div>' +
          '<div class="apprendre-card-title">Apprendre</div>' +
          '<div class="apprendre-card-desc">Cartes mot par mot pour découvrir et mémoriser</div>' +
        '</button>' +
        '<button class="apprendre-card apprendre-card-mode" data-mode="qcm" type="button">' +
          '<div class="apprendre-card-emoji">🎯</div>' +
          '<div class="apprendre-card-title">Quiz QCM</div>' +
          '<div class="apprendre-card-desc">Tester ce que tu as retenu</div>' +
        '</button>' +
        '<button class="apprendre-card apprendre-card-mode" data-mode="rapid" type="button">' +
          '<div class="apprendre-card-emoji">⚡</div>' +
          '<div class="apprendre-card-title">Révision rapide</div>' +
          '<div class="apprendre-card-desc">Mode chrono pour réviser ce que tu as appris</div>' +
        '</button>' +
      '</div>';

    bindBreadcrumb();

    root.querySelectorAll("[data-mode]").forEach(function(b) {
      b.onclick = function() {
        const mode = b.getAttribute("data-mode");
        launchPractice(mode, theme, sub, lvl);
      };
    });
  }

  /* =========================================================
     LANCEMENT D'UN MODE (Vocab / QCM / Rapide)
     ========================================================= */
  function launchPractice(mode, theme, sub, lvl) {
    if (!window.State) return;

    // Mémorise le contexte précis pour vocab/quiz/rapid
    window.State.update({
      learningContext: {
        themeId: theme._id,
        themeName: theme.name,
        subThemeId: sub.id,
        subThemeName: sub.name,
        levelId: lvl.id,
        levelName: lvl.name,
        words: lvl.words || [],   // <-- les vocab/quiz/rapid liront CES mots
        source: "theme"
      }
    });

    // Met à jour les éléments de contexte dans les écrans d'entraînement
    document.querySelectorAll('[data-bind="vocab-context"]').forEach(function(el) {
      el.textContent = theme.name + " — " + sub.name + " — " + lvl.name;
    });
    document.querySelectorAll('[data-bind="theme-name"]').forEach(function(el) {
      el.textContent = theme.name + " — " + sub.name;
    });

    if (!window.Main) return;
    switch (mode) {
      case "cards": window.Main.goto("vocab"); break;
      case "qcm":   window.Main.goto("quiz");  break;
      case "rapid": window.Main.goto("rapid"); break;
      default:      window.Main.goto("vocab");
    }
  }

  /* =========================================================
     API COMPATIBILITÉ (anciens noms publics)
     ========================================================= */
  function openTheme(themeId) {
    const t = allThemes.find(function(x){ return x._id === themeId; });
    if (!t) return;
    currentPath.category = t.category;
    currentPath.domain = t.domain;
    currentPath.branch = t.branch || null;
    currentPath.themeId = t._id;
    renderSubThemesView();
  }

  function selectLevel(levelId, themeId) {
    // Anciens appels : on essaie de retrouver le contexte
    currentPath.levelId = levelId;
    if (themeId) currentPath.themeId = themeId;
    renderLearningMenu();
  }

  function practiceTheme(mode) {
    const theme = allThemes.find(function(t){ return t._id === currentPath.themeId; });
    if (!theme) return;
    const sub = (theme.subThemes||[]).find(function(s){ return s.id === currentPath.subThemeId; });
    if (!sub) return;
    const lvl = (sub.customLevels||[]).find(function(l){ return l.id === currentPath.levelId; });
    if (!lvl) return;
    launchPractice(mode || "cards", theme, sub, lvl);
  }

  function recordThemeProgress(themeId, levelId, wordsLearned) {
    if (!window.State) return;
    const ctx = window.State.get("learningContext") || {};
    const subId = ctx.subThemeId || currentPath.subThemeId;
    if (!subId) return;
    const tp = window.State.get("themeProgress") || {};
    const key = themeId + "::" + subId + "::" + levelId;
    if (!tp[key]) tp[key] = {};
    tp[key].wordsLearned = wordsLearned;
    window.State.set("themeProgress", tp);
  }

  function markLevelCompleted(themeId, levelId) {
    if (!window.State) return;
    const ctx = window.State.get("learningContext") || {};
    const subId = ctx.subThemeId || currentPath.subThemeId;
    if (!subId) return;
    const tp = window.State.get("themeProgress") || {};
    const key = themeId + "::" + subId + "::" + levelId;
    if (!tp[key]) tp[key] = {};
    tp[key].completed = true;
    tp[key].completedAt = Date.now();
    window.State.set("themeProgress", tp);
    if (window.XP && window.XP.checkBadges) window.XP.checkBadges();
  }

  function getCurrentTheme() {
    return allThemes.find(function(t){ return t._id === currentPath.themeId; });
  }
  function getLevelTiers() { return []; } // legacy

  /* =========================================================
     UTILS
     ========================================================= */
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }

  /* =========================================================
     API PUBLIQUE
     ========================================================= */
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
console.log("✓ ThemesScreen v2 (5 étages baroque) chargé");
