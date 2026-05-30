/* =========================================================
   DAR AL LOUGHAH - ADMIN CONSOLE v5 (CMS PRO 5 ÉTAGES)
   - Hiérarchie : Catégorie > Domaine > Branche (opt) > Thème > Sous-thème > Niveau > Mots
   - Branche optionnelle (toggle dans le formulaire)
   - Breadcrumb visuel (fil d'Ariane)
   - Boutons Dupliquer (thème/sous-thème/niveau)
   - Aperçu "vue élève"
   - Suppression de mots SANS confirmation
   ========================================================= */

const AdminScreen = (function() {

  let currentTab = "themes";
  let currentTheme = null;
  let currentSubThemeId = null;
  let currentCustomLevelId = null;

  let searchQueries = {};
  let myRole = "none";

  // ===== CATÉGORIES (étage 1 — fixe) =====
  const THEME_CATEGORIES = [
    { id: "religieux",  name: "Sciences Religieuses", emoji: "🕌", color: "#c89a3a" },
    { id: "quotidien",  name: "Vie Quotidienne",      emoji: "💬", color: "#5EE0A5" },
    { id: "classique",  name: "Langue Classique",     emoji: "📜", color: "#f0c860" },
    { id: "academique", name: "Académique",           emoji: "🎓", color: "#3a6fc4" },
    { id: "monde",      name: "Monde & Société",      emoji: "🌍", color: "#FF7A9A" },
    { id: "institut",   name: "Programmes Instituts", emoji: "⭐", color: "#fdeec3" }
  ];

  const ACCESS_TYPES = [
    { id: "free",    label: "Gratuit (débloqué)" },
    { id: "premium", label: "Premium uniquement" },
    { id: "xp",      label: "Palier XP (atteindre X XP)" },
    { id: "locked",  label: "Verrouillé (caché)" }
  ];

  // ===== ENTRÉE =====
  async function show() {
    myRole = detectRole();
    if (myRole === "none") {
      toast("Accès réservé");
      if (window.Main) window.Main.goto("home");
      return;
    }
    renderAdminUI();
    showTab(currentTab || "themes");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function detectRole() {
    try {
      const user = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
      if (user && user.email) {
        const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
        const isSuper = admins.map(function(e){ return (e||"").toLowerCase(); })
                              .indexOf(user.email.toLowerCase()) !== -1;
        if (isSuper) return "super";
        const role = window.State && window.State.get ? window.State.get("role") : null;
        if (role === "teacher" || role === "institute_admin") return "teacher";
      }
    } catch (e) {}
    if (window.State && window.State.isAdmin && window.State.isAdmin()) return "super";
    return "none";
  }
  function isSuper() { return myRole === "super"; }

  // ===== UI PRINCIPALE =====
  function renderAdminUI() {
    const container = document.getElementById("adminContent");
    if (!container) return;

    const superTabs = [
      { id: "themes",      label: "Thèmes" },
      { id: "letters",     label: "Lettres" },
      { id: "definitions", label: "Définitions" },
      { id: "notions",     label: "Notions" },
      { id: "unlocks",     label: "Déblocables" },
      { id: "contenus",    label: "Contenus" },
      { id: "users",       label: "Utilisateurs" },
      { id: "stats",       label: "Stats" },
      { id: "config",      label: "Réglages" },
      { id: "tools",       label: "Outils" }
    ];
    const teacherTabs = [
      { id: "themes",  label: "Mon contenu" },
      { id: "users",   label: "Mes élèves" },
      { id: "stats",   label: "Stats" }
    ];
    const tabs = isSuper() ? superTabs : teacherTabs;

    let tabsHtml = '<div class="admin-role-banner ' + (isSuper() ? "super" : "teacher") + '">' +
      (isSuper() ? "👑 Console Super Admin — Plein pouvoir" : "🎓 Console Professeur — Mon institut") +
      '</div>';

    tabsHtml += '<div class="admin-tabs-wrap"><div class="admin-tabs">';
    tabs.forEach(function(t, i) {
      tabsHtml += '<button class="filter-chip ' + (i === 0 ? "active" : "") + '" data-tab="' + t.id + '">' + t.label + '</button>';
    });
    tabsHtml += '</div></div><div id="adminTabContent"></div>';

    container.innerHTML = tabsHtml;
    container.querySelectorAll(".admin-tabs .filter-chip").forEach(function(btn) {
      btn.addEventListener("click", function() { showTab(btn.getAttribute("data-tab")); });
    });
  }

  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".admin-tabs .filter-chip").forEach(function(b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });
    const content = document.getElementById("adminTabContent");
    if (!content) return;
    content.innerHTML = '<div class="admin-loading">Chargement...</div>';
    window.scrollTo({ top: 0, behavior: "smooth" });
    switch (tab) {
      case "themes":      renderThemesTab(content); break;
      case "letters":     renderLettersTab(content); break;
      case "definitions": renderDefinitionsTab(content); break;
      case "notions":     renderNotionsTab(content); break;
      case "unlocks":     renderUnlocksTab(content); break;
      case "contenus":    renderContenusTab(content); break;
      case "users":       renderUsersTab(content); break;
      case "stats":       renderStatsTab(content); break;
      case "config":      renderConfigTab(content); break;
      case "tools":       renderToolsTab(content); break;
    }
  }

  // ===== NORMALISATION 5 ÉTAGES =====
  function normalizeTheme(theme) {
    if (!theme) return theme;
    if (!theme.category) theme.category = "quotidien";
    if (!theme.domain) theme.domain = "";       // étage 2 (libre)
    if (theme.branch === undefined) theme.branch = ""; // étage 3 (optionnel)
    if (!Array.isArray(theme.subThemes)) theme.subThemes = [];
    if (!Array.isArray(theme.customLevels)) theme.customLevels = [];
    theme.subThemes.forEach(function(st) {
      if (!Array.isArray(st.customLevels)) st.customLevels = [];
    });
    return theme;
  }

  // Récupère tous les domaines / branches DÉJÀ utilisés (pour autocomplétion)
  let allThemesCache = [];
  function getKnownDomains(categoryId) {
    const set = new Set();
    allThemesCache.forEach(function(t) {
      if (!categoryId || t.category === categoryId) {
        if (t.domain) set.add(t.domain);
      }
    });
    return Array.from(set).sort();
  }
  function getKnownBranches(categoryId, domain) {
    const set = new Set();
    allThemesCache.forEach(function(t) {
      if (t.category === categoryId && t.domain === domain && t.branch) set.add(t.branch);
    });
    return Array.from(set).sort();
  }

  // ============================================================
  // ONGLET THÈMES
  // ============================================================
  async function renderThemesTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">GESTION DES THÈMES</div>' +
        '<input class="input admin-search" type="search" id="themesSearch" placeholder="Rechercher un thème, domaine, branche..."/>' +
        '<div class="admin-cat-filter" id="catFilter"></div>' +
        '<div class="admin-count" id="themesCount">0 thèmes</div>' +
        '<div id="themesList" class="admin-list">Chargement...</div>' +
        (isSuper() ? '<button class="btn btn-gold mt-12" id="addThemeBtn">+ Nouveau thème</button>' : '') +
      '</div>' +
      '<div id="themeEditor" hidden></div>';

    const catWrap = document.getElementById("catFilter");
    let catHtml = '<button class="filter-chip active" data-cat="all" type="button">Toutes</button>';
    THEME_CATEGORIES.forEach(function(c) {
      catHtml += '<button class="filter-chip" data-cat="' + c.id + '" type="button">' + c.emoji + ' ' + c.name + '</button>';
    });
    catWrap.innerHTML = catHtml;
    catWrap.querySelectorAll("[data-cat]").forEach(function(btn) {
      btn.onclick = function() {
        catWrap.querySelectorAll("[data-cat]").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        searchQueries.themeCat = btn.getAttribute("data-cat");
        loadThemesList();
      };
    });

    const addBtn = document.getElementById("addThemeBtn");
    if (addBtn) addBtn.onclick = openThemeCreator;

    const sb = document.getElementById("themesSearch");
    sb.value = searchQueries.themes || "";
    sb.addEventListener("input", function() {
      searchQueries.themes = sb.value;
      loadThemesList();
    });
    await loadThemesList();
  }

  async function loadThemesList() {
    const list = document.getElementById("themesList");
    const count = document.getElementById("themesCount");
    if (!list) return;
    let themes;
    try { themes = await window.FB.getCollection("themes") || []; }
    catch (e) { list.innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }

    themes.forEach(normalizeTheme);
    allThemesCache = themes; // pour autocomplétion

    const query = (searchQueries.themes || "").toLowerCase();
    const cat = searchQueries.themeCat || "all";

    let filtered = themes.filter(function(t) {
      if (cat !== "all" && t.category !== cat) return false;
      if (!query) return true;
      return (t.name || "").toLowerCase().indexOf(query) !== -1 ||
             (t._id || "").toLowerCase().indexOf(query) !== -1 ||
             (t.domain || "").toLowerCase().indexOf(query) !== -1 ||
             (t.branch || "").toLowerCase().indexOf(query) !== -1;
    });

    if (count) count.textContent = filtered.length + " thème" + (filtered.length > 1 ? "s" : "");

    if (themes.length === 0) {
      list.innerHTML =
        '<div class="admin-empty">Aucun thème en base.<br>' +
        (isSuper() ? '<button class="btn btn-outline mt-8" id="initThemesBtn">Initialiser les thèmes par défaut</button>' : '') +
        '</div>';
      const ib = document.getElementById("initThemesBtn");
      if (ib) ib.onclick = async function() {
        if (!await confirmAction("Créer les thèmes par défaut ?")) return;
        await initDefaultThemes();
      };
      return;
    }
    if (filtered.length === 0) {
      list.innerHTML = '<div class="admin-empty">Aucun résultat</div>';
      return;
    }

    list.innerHTML = filtered.sort(function(a,b){return(a.order||99)-(b.order||99);}).map(function(t) {
      const catInfo = THEME_CATEGORIES.find(function(c){ return c.id === t.category; }) || THEME_CATEGORIES[1];
      const subCount = (t.subThemes || []).length;
      const wordCount = countWordsInTheme(t);
      // Fil d'Ariane en miniature
      const path = [
        catInfo.emoji + " " + catInfo.name,
        t.domain || "—",
        t.branch || null,
        t.name || t._id
      ].filter(Boolean).join(" › ");
      return '<div class="list-item admin-list-item">' +
        '<div class="admin-item-body">' +
          '<div class="title">' + escapeHTML(t.icon || catInfo.emoji) + ' ' + escapeHTML(t.name || t._id) + '</div>' +
          '<div class="admin-breadcrumb-mini">' + escapeHTML(path) + '</div>' +
          '<div class="meta">' + subCount + ' sous-thèmes · ' + wordCount + ' mots</div>' +
        '</div>' +
        '<div class="admin-item-actions">' +
          '<button class="btn-mini btn-mini-edit" data-edit-theme="' + t._id + '" type="button">Gérer</button>' +
          (isSuper() ? '<button class="btn-mini" data-dup-theme="' + t._id + '" type="button" title="Dupliquer">📋</button>' : '') +
          (isSuper() ? '<button class="btn-mini btn-mini-del" data-del-theme="' + t._id + '" type="button">X</button>' : '') +
        '</div></div>';
    }).join("");

    list.querySelectorAll("[data-edit-theme]").forEach(function(btn) {
      btn.onclick = function() { openThemeEditor(btn.getAttribute("data-edit-theme")); };
    });
    list.querySelectorAll("[data-del-theme]").forEach(function(btn) {
      btn.onclick = function() { deleteTheme(btn.getAttribute("data-del-theme")); };
    });
    list.querySelectorAll("[data-dup-theme]").forEach(function(btn) {
      btn.onclick = function() { duplicateTheme(btn.getAttribute("data-dup-theme")); };
    });
  }

  function countWordsInTheme(theme) {
    let total = 0;
    if (Array.isArray(theme.subThemes)) {
      theme.subThemes.forEach(function(st) {
        (st.customLevels || []).forEach(function(lvl) {
          if (Array.isArray(lvl.words)) total += lvl.words.length;
        });
      });
    }
    if (theme.levels) {
      ["debutant","intermediaire","avance","expert","mouallim"].forEach(function(l) {
        if (Array.isArray(theme.levels[l])) total += theme.levels[l].length;
      });
    }
    return total;
  }

  function openThemeCreator() {
    currentTheme = null;
    currentSubThemeId = null;
    currentCustomLevelId = null;
    showThemeForm({});
    const ed = document.getElementById("themeEditor");
    if (ed) ed.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function openThemeEditor(themeId) {
    try {
      const theme = await window.FB.getDocument("themes", themeId);
      if (!theme) { toast("Thème introuvable"); return; }
      normalizeTheme(theme);
      currentTheme = theme;
      currentSubThemeId = null;
      currentCustomLevelId = null;
      showThemeForm(theme);
      const ed = document.getElementById("themeEditor");
      if (ed) ed.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ===== DUPLIQUER UN THÈME =====
  async function duplicateTheme(themeId) {
    try {
      const original = await window.FB.getDocument("themes", themeId);
      if (!original) return;
      normalizeTheme(original);
      const newId = original._id + "_copy_" + Date.now().toString(36);
      const copy = JSON.parse(JSON.stringify(original));
      copy._id = newId; copy.id = newId;
      copy.name = (original.name || "Sans nom") + " (copie)";
      copy.createdAt = Date.now();
      delete copy.created_at;
      await window.FB.setDocument("themes", newId, copy);
      toast("Thème dupliqué : " + copy.name);
      await loadThemesList();
    } catch (e) { toast("Erreur duplication: " + e.message); }
  }

  // ============================================================
  // FORMULAIRE THÈME (5 ÉTAGES) + BREADCRUMB
  // ============================================================
  function buildBreadcrumb(theme) {
    if (!theme || !theme._id) return "";
    const catInfo = THEME_CATEGORIES.find(function(c){ return c.id === theme.category; }) || THEME_CATEGORIES[1];
    let parts = [
      catInfo.emoji + " " + catInfo.name,
      theme.domain ? ("📚 " + theme.domain) : null,
      theme.branch ? ("🌿 " + theme.branch) : null,
      "📖 " + (theme.name || "")
    ];
    const sub = getCurrentSub(theme);
    if (sub) parts.push("📑 " + sub.name);
    const lvl = getCurrentLevel(theme);
    if (lvl) parts.push("🎯 " + lvl.name);
    return '<div class="admin-breadcrumb">' + parts.filter(Boolean).map(escapeHTML).join(' <span class="bc-sep">›</span> ') + '</div>';
  }

  function showThemeForm(theme) {
    normalizeTheme(theme);
    const editor = document.getElementById("themeEditor");
    if (!editor) return;
    editor.hidden = false;
    const isNew = !theme._id;

    let catOptions = THEME_CATEGORIES.map(function(c) {
      const sel = (theme.category === c.id) ? " selected" : "";
      return '<option value="' + c.id + '"' + sel + '>' + c.emoji + ' ' + c.name + '</option>';
    }).join("");

    // Autocomplétion domaines/branches via datalist
    const domainList = getKnownDomains(theme.category).map(function(d){
      return '<option value="' + escapeHTML(d) + '">';
    }).join("");
    const branchList = getKnownBranches(theme.category, theme.domain).map(function(b){
      return '<option value="' + escapeHTML(b) + '">';
    }).join("");

    const hasBranch = !!theme.branch;

    editor.innerHTML =
      (!isNew ? buildBreadcrumb(theme) : '') +
      '<div class="panel theme-editor-panel">' +
        '<div class="panel-title">' + (isNew ? "NOUVEAU THÈME" : "ÉDITER : " + escapeHTML(theme.name || "")) + '</div>' +
        (!isNew && isSuper() ? '<button class="btn btn-outline mt-8" id="previewUserBtn" type="button">👁️ Voir comme un élève</button>' : '') +
        '<div class="form-grid">' +
          '<label class="admin-label">[1] Catégorie<select class="input" id="thCategory">' + catOptions + '</select></label>' +
          '<label class="admin-label">[2] Domaine (ex: Fiqh, Aqida, Quran...)<input class="input" id="thDomain" list="domainsList" placeholder="Tape ou choisis" value="' + escapeHTML(theme.domain || "") + '"/></label>' +
          '<datalist id="domainsList">' + domainList + '</datalist>' +
          '<label class="toggle-row"><input type="checkbox" id="thHasBranch"' + (hasBranch ? " checked" : "") + '/><span>[3] Ce thème a une branche (école juridique, courant...)</span></label>' +
          '<div id="branchBlock"' + (hasBranch ? "" : ' style="display:none"') + '>' +
            '<label class="admin-label">Branche (ex: Shafi\'i, Hanafi...)<input class="input" id="thBranch" list="branchesList" placeholder="Tape ou choisis" value="' + escapeHTML(theme.branch || "") + '"/></label>' +
            '<datalist id="branchesList">' + branchList + '</datalist>' +
          '</div>' +
          '<input class="input" id="thId" placeholder="ID technique (ex: oumdat_fiqh)" value="' + escapeHTML(theme._id || theme.id || "") + '"' + (theme._id ? " disabled" : "") + '/>' +
          '<input class="input" id="thName" placeholder="[4] Nom du thème (ex: Comprendre Oumdat al Fiqh)" value="' + escapeHTML(theme.name || "") + '"/>' +
          '<input class="input" id="thNameAr" placeholder="Nom arabe" value="' + escapeHTML(theme.nameAr || "") + '" dir="rtl"/>' +
          '<input class="input" id="thIcon" placeholder="Emoji illustration" value="' + escapeHTML(theme.icon || "") + '" maxlength="4"/>' +
          '<input class="input" id="thDesc" placeholder="Description (optionnel)" value="' + escapeHTML(theme.description || "") + '"/>' +
          '<input class="input" id="thOrder" type="number" placeholder="Ordre" value="' + (theme.order || 99) + '"/>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="saveThBtn">' + (isNew ? "Créer ce thème" : "Enregistrer les infos") + '</button>' +
        '<button class="btn btn-outline mt-8" id="cancelThBtn">Fermer</button>' +
      '</div>' +
      (!isNew ? renderLevelsManager(theme) : '<div class="panel mt-12"><div class="admin-empty">Crée le thème d\'abord, puis ajoute des sous-thèmes.</div></div>');

    // Toggle branche
    const cb = document.getElementById("thHasBranch");
    const block = document.getElementById("branchBlock");
    if (cb && block) {
      cb.onchange = function() {
        block.style.display = cb.checked ? "" : "none";
        if (!cb.checked) document.getElementById("thBranch").value = "";
      };
    }

    // Re-charge la datalist des branches quand on change de domaine
    const dom = document.getElementById("thDomain");
    if (dom) dom.addEventListener("change", function() {
      const dl = document.getElementById("branchesList");
      if (!dl) return;
      dl.innerHTML = getKnownBranches(document.getElementById("thCategory").value, dom.value)
        .map(function(b){ return '<option value="' + escapeHTML(b) + '">'; }).join("");
    });

    document.getElementById("saveThBtn").onclick = function() { saveTheme(isNew); };
    document.getElementById("cancelThBtn").onclick = function() { editor.hidden = true; };
    const pv = document.getElementById("previewUserBtn");
    if (pv) pv.onclick = function() { previewAsUser(theme); };

    if (!isNew) bindLevelsManager(theme);
  }

  // ===== APERÇU "VUE ÉLÈVE" (placeholder — branche selon ton fichier user) =====
  function previewAsUser(theme) {
    if (window.Main && window.Main.goto) {
      // Tu peux brancher ça sur ton vrai écran user plus tard
      toast("Aperçu : ouvre l'app dans un autre onglet en mode invité pour voir " + theme.name);
    } else {
      alert("Aperçu utilisateur pour : " + theme.name + "\n(connectera bientôt à l'écran Apprendre)");
    }
  }

  // ===== SAUVEGARDE / SUPPRESSION THÈME =====
  async function saveTheme(isNew) {
    const id = getVal("thId"), name = getVal("thName");
    if (!id || !name) { toast("ID et nom requis"); return; }
    const hasBranchCb = document.getElementById("thHasBranch");
    const data = {
      id: id, name: name,
      nameAr: getVal("thNameAr"),
      icon: getVal("thIcon"),
      category: document.getElementById("thCategory").value,
      domain: getVal("thDomain"),
      branch: (hasBranchCb && hasBranchCb.checked) ? getVal("thBranch") : "",
      description: getVal("thDesc"),
      order: parseInt(getVal("thOrder"), 10) || 99
    };
    if (isNew) {
      data.subThemes = [];
      data.customLevels = [];
      data.createdAt = Date.now();
    } else if (currentTheme) {
      data.subThemes = currentTheme.subThemes || [];
      data.customLevels = currentTheme.customLevels || [];
      data.levels = currentTheme.levels;
    }
    try {
      await window.FB.setDocument("themes", id, data);
      toast("Thème enregistré");
      if (isNew) {
        currentTheme = await window.FB.getDocument("themes", id);
        normalizeTheme(currentTheme);
        showThemeForm(currentTheme);
      } else {
        currentTheme = data;
        await loadThemesList();
        showThemeForm(data);
      }
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function deleteTheme(themeId) {
    if (!await confirmAction("Supprimer ce thème et tout son contenu ?")) return;
    try {
      await window.FB.deleteDocument("themes", themeId);
      toast("Thème supprimé");
      const ed = document.getElementById("themeEditor");
      if (ed) ed.hidden = true;
      await loadThemesList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function initDefaultThemes() {
    const defaults = [
      { id:"quotidien", name:"Les Mots du Quotidien", nameAr:"الحياة اليومية", icon:"💬", category:"quotidien", domain:"Vie courante", order:1 },
      { id:"foi",       name:"La Foi",                nameAr:"الإيمان",        icon:"🕌", category:"religieux", domain:"Aqida", order:2 },
      { id:"coran",     name:"Le Coran",              nameAr:"القرآن",         icon:"📖", category:"religieux", domain:"Quran", order:3 },
      { id:"famille",   name:"La Famille",            nameAr:"العائلة",        icon:"👨", category:"quotidien", domain:"Vie courante", order:4 },
      { id:"voyage",    name:"En Voyage",             nameAr:"في السفر",       icon:"✈️", category:"quotidien", domain:"Vie courante", order:5 }
    ];
    const listEl = document.getElementById("themesList");
    if (listEl) listEl.innerHTML = '<div class="admin-loading">Initialisation...</div>';
    let ok = 0;
    for (let i = 0; i < defaults.length; i++) {
      try {
        await window.FB.setDocument("themes", defaults[i].id, Object.assign({}, defaults[i], {
          subThemes: [], customLevels: [], createdAt: Date.now(), branch: ""
        }));
        ok++;
      } catch (e) {}
    }
    toast(ok + " thèmes créés");
    await loadThemesList();
  }
// ============================================================
  // HELPERS sous-thème / niveau actifs
  // ============================================================
  function getCurrentSub(theme) {
    if (!theme || !currentSubThemeId) return null;
    return (theme.subThemes || []).find(function(s){ return s.id === currentSubThemeId; });
  }
  function getCurrentLevel(theme) {
    const sub = getCurrentSub(theme);
    if (!sub || !currentCustomLevelId) return null;
    return (sub.customLevels || []).find(function(l){ return l.id === currentCustomLevelId; });
  }

  // ============================================================
  // GESTIONNAIRE SOUS-THÈMES + NIVEAUX (étages 5 et 6)
  // ============================================================
  function renderLevelsManager(theme) {
    const subs = (theme.subThemes || []).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});

    let subsHtml = subs.map(function(st) {
      const lvlCount = (st.customLevels || []).length;
      let wc = 0;
      (st.customLevels || []).forEach(function(l){ wc += (l.words||[]).length; });
      const active = (st.id === currentSubThemeId) ? " admin-level-active" : "";
      return '<div class="admin-level-row' + active + '">' +
        '<div class="admin-level-body" data-pick-sub="' + st.id + '">' +
          '<div class="admin-level-name">' + escapeHTML(st.emoji || "📑") + ' ' + escapeHTML(st.name) + '</div>' +
          '<div class="admin-level-meta">' + lvlCount + ' niveau(x) · ' + wc + ' mots</div>' +
        '</div>' +
        '<div class="admin-level-actions">' +
          '<button class="btn-mini" data-sub-up="' + st.id + '" type="button">↑</button>' +
          '<button class="btn-mini" data-sub-down="' + st.id + '" type="button">↓</button>' +
          '<button class="btn-mini btn-mini-edit" data-sub-edit="' + st.id + '" type="button">✎</button>' +
          '<button class="btn-mini" data-sub-dup="' + st.id + '" type="button" title="Dupliquer">📋</button>' +
          '<button class="btn-mini btn-mini-del" data-sub-del="' + st.id + '" type="button">X</button>' +
        '</div>' +
      '</div>';
    }).join("");
    if (subs.length === 0) subsHtml = '<div class="admin-empty">Aucun sous-thème. Ajoute le premier ci-dessous.</div>';

    // Migration ancien contenu
    let migrateHtml = "";
    const hasOld = theme.levels && ["debutant","intermediaire","avance","expert","mouallim"].some(function(l){
      return Array.isArray(theme.levels[l]) && theme.levels[l].length > 0;
    });
    if (hasOld) {
      migrateHtml =
        '<div class="panel sub-panel mt-12 admin-migrate">' +
          '<div class="panel-title">⚠️ Ancien contenu détecté</div>' +
          '<p class="form-hint">Convertir l\'ancien format en un sous-thème « Général » avec ses niveaux.</p>' +
          '<button class="btn btn-outline mt-8" id="migrateBtn">Convertir</button>' +
        '</div>';
    }

    // Bloc niveaux du sous-thème actif
    let levelsBlock = "";
    const sub = getCurrentSub(theme);
    if (sub) {
      const levels = (sub.customLevels || []).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});
      let levelsHtml = levels.map(function(lvl) {
        const accInfo = ACCESS_TYPES.find(function(a){ return a.id === lvl.access; }) || ACCESS_TYPES[0];
        const accLabel = lvl.access === "xp" ? ("Palier " + (lvl.accessValue||0) + " XP") : accInfo.label;
        const adTag = lvl.adWall ? ' · 📺 pub' : '';
        const wc = (lvl.words || []).length;
        const active = (lvl.id === currentCustomLevelId) ? " admin-level-active" : "";
        return '<div class="admin-level-row' + active + '">' +
          '<div class="admin-level-body" data-pick-level="' + lvl.id + '">' +
            '<div class="admin-level-name">' + escapeHTML(lvl.emoji || "🎯") + ' ' + escapeHTML(lvl.name) + '</div>' +
            '<div class="admin-level-meta">' + wc + ' mots · ' + escapeHTML(accLabel) + adTag + '</div>' +
          '</div>' +
          '<div class="admin-level-actions">' +
            '<button class="btn-mini" data-lvl-up="' + lvl.id + '" type="button">↑</button>' +
            '<button class="btn-mini" data-lvl-down="' + lvl.id + '" type="button">↓</button>' +
            '<button class="btn-mini btn-mini-edit" data-lvl-edit="' + lvl.id + '" type="button">✎</button>' +
            '<button class="btn-mini" data-lvl-dup="' + lvl.id + '" type="button" title="Dupliquer">📋</button>' +
            '<button class="btn-mini btn-mini-del" data-lvl-del="' + lvl.id + '" type="button">X</button>' +
          '</div>' +
        '</div>';
      }).join("");
      if (levels.length === 0) levelsHtml = '<div class="admin-empty">Aucun niveau dans ce sous-thème</div>';

      levelsBlock =
        '<div class="panel mt-12 admin-level-editor">' +
          '<div class="panel-title">🎯 NIVEAUX DE : ' + escapeHTML(sub.emoji||"") + ' ' + escapeHTML(sub.name) + '</div>' +
          '<div class="admin-levels-list">' + levelsHtml + '</div>' +
          '<div class="panel sub-panel mt-12">' +
            '<div class="panel-title">+ AJOUTER UN NIVEAU</div>' +
            '<div class="form-grid">' +
              '<input class="input" id="newLvlName" placeholder="Nom (ex: Niveau 1)"/>' +
              '<input class="input" id="newLvlEmoji" placeholder="Emoji (optionnel)" maxlength="4"/>' +
              '<label class="admin-label">Accès<select class="input" id="newLvlAccess">' +
                ACCESS_TYPES.map(function(a){ return '<option value="' + a.id + '">' + a.label + '</option>'; }).join("") +
              '</select></label>' +
              '<input class="input" id="newLvlXp" type="number" placeholder="XP requis (si palier)"/>' +
              '<label class="toggle-row"><input type="checkbox" id="newLvlAd"/><span>📺 Pub au déblocage</span></label>' +
            '</div>' +
            '<button class="btn btn-gold mt-8" id="addLvlBtn">+ Créer ce niveau</button>' +
          '</div>' +
        '</div>' +
        '<div id="levelWordsEditor"></div>';
    }

    return '<div class="panel mt-12">' +
        '<div class="panel-title">SOUS-THÈMES (étage 5)</div>' +
        '<p class="form-hint">Ex : Purification, Prière, Zakat... Clique un sous-thème pour gérer ses niveaux.</p>' +
        '<div class="admin-levels-list">' + subsHtml + '</div>' +
        '<div class="panel sub-panel mt-12">' +
          '<div class="panel-title">+ AJOUTER UN SOUS-THÈME</div>' +
          '<div class="form-grid">' +
            '<input class="input" id="newSubName" placeholder="Nom (ex: Purification)"/>' +
            '<input class="input" id="newSubEmoji" placeholder="Emoji (optionnel)" maxlength="4"/>' +
          '</div>' +
          '<button class="btn btn-gold mt-8" id="addSubBtn">+ Créer ce sous-thème</button>' +
        '</div>' +
        migrateHtml +
      '</div>' +
      levelsBlock;
  }

  function bindLevelsManager(theme) {
    const addSubBtn = document.getElementById("addSubBtn");
    if (addSubBtn) addSubBtn.onclick = function() { addSubTheme(theme); };
    const migBtn = document.getElementById("migrateBtn");
    if (migBtn) migBtn.onclick = function() { migrateOldLevels(theme); };

    document.querySelectorAll("[data-pick-sub]").forEach(function(el) {
      el.onclick = function() {
        currentSubThemeId = el.getAttribute("data-pick-sub");
        currentCustomLevelId = null;
        showThemeForm(theme);
      };
    });
    document.querySelectorAll("[data-sub-edit]").forEach(function(b) {
      b.onclick = function() { editSubTheme(theme, b.getAttribute("data-sub-edit")); };
    });
    document.querySelectorAll("[data-sub-del]").forEach(function(b) {
      b.onclick = function() { deleteSubTheme(theme, b.getAttribute("data-sub-del")); };
    });
    document.querySelectorAll("[data-sub-up]").forEach(function(b) {
      b.onclick = function() { moveSubTheme(theme, b.getAttribute("data-sub-up"), -1); };
    });
    document.querySelectorAll("[data-sub-down]").forEach(function(b) {
      b.onclick = function() { moveSubTheme(theme, b.getAttribute("data-sub-down"), 1); };
    });
    document.querySelectorAll("[data-sub-dup]").forEach(function(b) {
      b.onclick = function() { duplicateSubTheme(theme, b.getAttribute("data-sub-dup")); };
    });

    const addLvlBtn = document.getElementById("addLvlBtn");
    if (addLvlBtn) addLvlBtn.onclick = function() { addCustomLevel(theme); };
    document.querySelectorAll("[data-pick-level]").forEach(function(el) {
      el.onclick = function() {
        currentCustomLevelId = el.getAttribute("data-pick-level");
        showThemeForm(theme);
        renderLevelWordsEditor(theme);
        const ed = document.getElementById("levelWordsEditor");
        if (ed) ed.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
    document.querySelectorAll("[data-lvl-edit]").forEach(function(b) {
      b.onclick = function() { editCustomLevel(theme, b.getAttribute("data-lvl-edit")); };
    });
    document.querySelectorAll("[data-lvl-del]").forEach(function(b) {
      b.onclick = function() { deleteCustomLevel(theme, b.getAttribute("data-lvl-del")); };
    });
    document.querySelectorAll("[data-lvl-up]").forEach(function(b) {
      b.onclick = function() { moveCustomLevel(theme, b.getAttribute("data-lvl-up"), -1); };
    });
    document.querySelectorAll("[data-lvl-down]").forEach(function(b) {
      b.onclick = function() { moveCustomLevel(theme, b.getAttribute("data-lvl-down"), 1); };
    });
    document.querySelectorAll("[data-lvl-dup]").forEach(function(b) {
      b.onclick = function() { duplicateLevel(theme, b.getAttribute("data-lvl-dup")); };
    });

    if (currentCustomLevelId) renderLevelWordsEditor(theme);
  }

  // ===== ACTIONS SOUS-THÈMES =====
  async function addSubTheme(theme) {
    const name = getVal("newSubName");
    if (!name) { toast("Nom du sous-thème requis"); return; }
    if (!Array.isArray(theme.subThemes)) theme.subThemes = [];
    const newId = "sub_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
    theme.subThemes.push({
      id: newId, name: name, emoji: getVal("newSubEmoji"),
      customLevels: [], order: theme.subThemes.length + 1
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Sous-thème « " + name + " » créé");
      currentSubThemeId = newId;
      currentCustomLevelId = null;
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function editSubTheme(theme, subId) {
    const st = (theme.subThemes||[]).find(function(s){ return s.id === subId; });
    if (!st) return;
    const n = prompt("Nom du sous-thème :", st.name);
    if (n === null) return;
    const em = prompt("Emoji (vide = aucun) :", st.emoji || "");
    if (em === null) return;
    st.name = n.trim() || st.name;
    st.emoji = em.trim();
    window.FB.setDocument("themes", theme._id, theme).then(function(){
      toast("Sous-thème modifié"); showThemeForm(theme);
    }).catch(function(e){ toast("Erreur: " + e.message); });
  }

  async function deleteSubTheme(theme, subId) {
    if (!await confirmAction("Supprimer ce sous-thème et tous ses niveaux ?")) return;
    theme.subThemes = (theme.subThemes||[]).filter(function(s){ return s.id !== subId; });
    if (currentSubThemeId === subId) { currentSubThemeId = null; currentCustomLevelId = null; }
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Sous-thème supprimé"); showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function moveSubTheme(theme, subId, dir) {
    const subs = (theme.subThemes||[]).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});
    const idx = subs.findIndex(function(s){ return s.id === subId; });
    if (idx === -1) return;
    const sw = idx + dir;
    if (sw < 0 || sw >= subs.length) return;
    const t = subs[idx].order; subs[idx].order = subs[sw].order; subs[sw].order = t;
    try { await window.FB.setDocument("themes", theme._id, theme); showThemeForm(theme); }
    catch (e) { toast("Erreur: " + e.message); }
  }

  async function duplicateSubTheme(theme, subId) {
    const orig = (theme.subThemes||[]).find(function(s){ return s.id === subId; });
    if (!orig) return;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = "sub_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
    copy.name = orig.name + " (copie)";
    copy.order = theme.subThemes.length + 1;
    // Régénérer les IDs des niveaux dans la copie
    (copy.customLevels || []).forEach(function(l) {
      l.id = "lvl_" + Date.now() + "_" + Math.random().toString(36).slice(2,4);
    });
    theme.subThemes.push(copy);
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Sous-thème dupliqué");
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ===== ACTIONS NIVEAUX =====
  async function addCustomLevel(theme) {
    const sub = getCurrentSub(theme);
    if (!sub) { toast("Sélectionne un sous-thème d'abord"); return; }
    const name = getVal("newLvlName");
    if (!name) { toast("Nom du niveau requis"); return; }
    if (!Array.isArray(sub.customLevels)) sub.customLevels = [];
    const newId = "lvl_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
    sub.customLevels.push({
      id: newId, name: name, emoji: getVal("newLvlEmoji"),
      access: document.getElementById("newLvlAccess").value,
      accessValue: parseInt(getVal("newLvlXp"), 10) || 0,
      adWall: document.getElementById("newLvlAd").checked,
      words: [], chunks: [], order: sub.customLevels.length + 1
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Niveau « " + name + " » créé");
      currentCustomLevelId = newId;
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function editCustomLevel(theme, lvlId) {
    const sub = getCurrentSub(theme);
    if (!sub) return;
    const lvl = (sub.customLevels||[]).find(function(l){ return l.id === lvlId; });
    if (!lvl) return;
    const n = prompt("Nom du niveau :", lvl.name);
    if (n === null) return;
    const em = prompt("Emoji (vide = aucun) :", lvl.emoji || "");
    if (em === null) return;
    lvl.name = n.trim() || lvl.name;
    lvl.emoji = em.trim();
    window.FB.setDocument("themes", theme._id, theme).then(function(){
      toast("Niveau modifié"); showThemeForm(theme);
    }).catch(function(e){ toast("Erreur: " + e.message); });
  }

  async function deleteCustomLevel(theme, lvlId) {
    const sub = getCurrentSub(theme);
    if (!sub) return;
    if (!await confirmAction("Supprimer ce niveau et tous ses mots ?")) return;
    sub.customLevels = (sub.customLevels||[]).filter(function(l){ return l.id !== lvlId; });
    if (currentCustomLevelId === lvlId) currentCustomLevelId = null;
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Niveau supprimé"); showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function moveCustomLevel(theme, lvlId, dir) {
    const sub = getCurrentSub(theme);
    if (!sub) return;
    const levels = (sub.customLevels||[]).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});
    const idx = levels.findIndex(function(l){ return l.id === lvlId; });
    if (idx === -1) return;
    const sw = idx + dir;
    if (sw < 0 || sw >= levels.length) return;
    const t = levels[idx].order; levels[idx].order = levels[sw].order; levels[sw].order = t;
    try { await window.FB.setDocument("themes", theme._id, theme); showThemeForm(theme); }
    catch (e) { toast("Erreur: " + e.message); }
  }

  async function duplicateLevel(theme, lvlId) {
    const sub = getCurrentSub(theme);
    if (!sub) return;
    const orig = (sub.customLevels||[]).find(function(l){ return l.id === lvlId; });
    if (!orig) return;
    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = "lvl_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
    copy.name = orig.name + " (copie)";
    copy.order = sub.customLevels.length + 1;
    sub.customLevels.push(copy);
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Niveau dupliqué");
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function migrateOldLevels(theme) {
    if (!await confirmAction("Convertir l'ancien contenu en un sous-thème « Général » ?")) return;
    if (!Array.isArray(theme.subThemes)) theme.subThemes = [];
    const map = [
      { key:"debutant", name:"Débutant", emoji:"🌱" },
      { key:"intermediaire", name:"Intermédiaire", emoji:"🌿" },
      { key:"avance", name:"Avancé", emoji:"🌳" },
      { key:"expert", name:"Expert", emoji:"⭐" },
      { key:"mouallim", name:"Mouallim", emoji:"👑" }
    ];
    const migLevels = [];
    let order = 0;
    map.forEach(function(m) {
      const arr = (theme.levels && theme.levels[m.key]) || [];
      if (arr.length > 0) {
        order++;
        migLevels.push({
          id: "lvl_mig_" + m.key + "_" + Date.now(),
          name: m.name, emoji: m.emoji,
          access: m.key === "mouallim" ? "premium" : "free",
          accessValue: 0, adWall: false,
          words: arr.slice(), chunks: [], order: order
        });
      }
    });
    if (migLevels.length === 0) { toast("Rien à migrer"); return; }
    theme.subThemes.push({
      id: "sub_general_" + Date.now(),
      name: "Général", emoji: "📚",
      customLevels: migLevels,
      order: theme.subThemes.length + 1
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Migration réussie ! Sous-thème « Général » créé.");
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============================================================
  // ÉDITEUR DE MOTS (suppression SANS confirmation comme demandé)
  // ============================================================
  function renderLevelWordsEditor(theme) {
    const container = document.getElementById("levelWordsEditor");
    if (!container) return;
    const lvl = getCurrentLevel(theme);
    if (!lvl) { container.innerHTML = ""; return; }

    const words = lvl.words || [];
    let wordsHtml = words.map(function(w, i) {
      return '<div class="word-row admin-word-row">' +
        '<div class="word-body">' +
          '<div class="word-ar">' + escapeHTML(w.ar || "") + '</div>' +
          '<div class="word-fr">' + escapeHTML(w.fr || "") + '</div>' +
          (w.example ? '<div class="admin-meta-tiny">' + escapeHTML(w.example) + '</div>' : '') +
        '</div>' +
        '<div class="admin-item-actions">' +
          '<button class="btn-mini btn-mini-del" data-del-w="' + i + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    if (words.length === 0) wordsHtml = '<div class="admin-empty">Aucun mot dans ce niveau</div>';

    container.innerHTML =
      '<div class="panel mt-12 admin-level-editor">' +
        '<div class="panel-title">📝 MOTS DU NIVEAU : ' + escapeHTML(lvl.emoji || "") + ' ' + escapeHTML(lvl.name) + '</div>' +
        '<div class="admin-count">' + words.length + ' mot' + (words.length>1?"s":"") + '</div>' +
        '<div id="lvlWordsList">' + wordsHtml + '</div>' +
        '<div class="panel sub-panel mt-12">' +
          '<div class="panel-title">+ AJOUTER UN MOT</div>' +
          '<div class="form-grid">' +
            '<input class="input" id="wAr" placeholder="Mot en arabe" dir="rtl"/>' +
            '<input class="input" id="wFr" placeholder="Traduction française"/>' +
            '<input class="input" id="wEx" placeholder="Exemple en arabe (optionnel)" dir="rtl"/>' +
            '<input class="input" id="wExFr" placeholder="Traduction de l\'exemple (optionnel)"/>' +
          '</div>' +
          '<button class="btn btn-gold mt-8" id="addWBtn">+ Ajouter ce mot</button>' +
        '</div>' +
        '<div class="panel sub-panel mt-12">' +
          '<div class="panel-title">IMPORT EN LOT</div>' +
          '<div class="form-hint">Format : <b>arabe = français</b> (un par ligne)</div>' +
          '<textarea class="textarea admin-textarea" id="wBulk" rows="6" placeholder="باب = Porte&#10;ماء = Eau"></textarea>' +
          '<button class="btn btn-outline mt-8" id="bulkWBtn">Importer dans ce niveau</button>' +
        '</div>' +
      '</div>';

    document.getElementById("addWBtn").onclick = function() { addWordToLevel(theme); };
    document.getElementById("bulkWBtn").onclick = function() { bulkImportToLevel(theme); };
    container.querySelectorAll("[data-del-w]").forEach(function(btn) {
      btn.onclick = function() { deleteWordFromLevel(theme, parseInt(btn.getAttribute("data-del-w"), 10)); };
    });
  }

  async function addWordToLevel(theme) {
    const lvl = getCurrentLevel(theme);
    if (!lvl) { toast("Sélectionne un niveau d'abord"); return; }
    const ar = getVal("wAr"), fr = getVal("wFr");
    if (!ar || !fr) { toast("Arabe et français requis"); return; }
    if (!Array.isArray(lvl.words)) lvl.words = [];
    lvl.words.push({
      id: "w_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
      ar: ar, fr: fr,
      example: getVal("wEx"), exFr: getVal("wExFr"),
      tags: []
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      ["wAr","wFr","wEx","wExFr"].forEach(clearVal);
      toast("Mot ajouté");
      renderLevelWordsEditor(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function bulkImportToLevel(theme) {
    const lvl = getCurrentLevel(theme);
    if (!lvl) { toast("Sélectionne un niveau d'abord"); return; }
    const text = getVal("wBulk");
    if (!text) { toast("Colle tes mots d'abord"); return; }
    const lines = text.split("\n").filter(function(l){ return l.trim() && l.indexOf("=") !== -1; });
    if (lines.length === 0) { toast("Format incorrect"); return; }
    if (!Array.isArray(lvl.words)) lvl.words = [];
    lines.forEach(function(line) {
      const parts = line.split("=").map(function(s){ return s.trim(); });
      if (parts.length < 2 || !parts[0] || !parts[1]) return;
      lvl.words.push({
        id: "w_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
        ar: parts[0], fr: parts[1], example: "", exFr: "", tags: []
      });
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      clearVal("wBulk");
      toast(lines.length + " mots importés");
      renderLevelWordsEditor(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // SUPPRESSION SANS CONFIRMATION (comme demandé)
  async function deleteWordFromLevel(theme, index) {
    const lvl = getCurrentLevel(theme);
    if (!lvl) return;
    lvl.words.splice(index, 1);
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      renderLevelWordsEditor(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============================================================
  // ONGLET LETTRES
  // ============================================================
  async function renderLettersTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">GESTION DES LETTRES</div>' +
        '<div id="lettersList" class="admin-list">Chargement...</div>' +
        '<button class="btn btn-outline mt-8" id="initLettersBtn">Initialiser les 28 lettres</button>' +
      '</div>';
    document.getElementById("initLettersBtn").onclick = initDefaultLetters;
    await loadLettersList();
  }

  async function loadLettersList() {
    let letters;
    try { letters = await window.FB.getCollection("letters") || []; }
    catch (e) { document.getElementById("lettersList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const list = document.getElementById("lettersList");
    if (!list) return;
    if (letters.length === 0) { list.innerHTML = '<div class="admin-empty">Aucune lettre. Clique Initialiser.</div>'; return; }
    list.innerHTML = letters.sort(function(a,b){return(a.order||0)-(b.order||0);}).map(function(l) {
      return '<div class="word-row admin-word-row"><div class="word-body">' +
        '<div class="word-ar">' + escapeHTML(l.ar||"") + '</div>' +
        '<div class="word-fr">' + escapeHTML(l.name||"") + ' · ' + escapeHTML(l.sound||"") + '</div></div></div>';
    }).join("");
  }

  async function initDefaultLetters() {
    const letters = [
      {id:"alif",ar:"ا",name:"Alif",sound:"a",order:1},{id:"ba",ar:"ب",name:"Ba",sound:"b",order:2},
      {id:"ta",ar:"ت",name:"Ta",sound:"t",order:3},{id:"tha",ar:"ث",name:"Tha",sound:"th",order:4},
      {id:"jim",ar:"ج",name:"Jim",sound:"j",order:5},{id:"ha",ar:"ح",name:"Ha",sound:"h",order:6},
      {id:"kha",ar:"خ",name:"Kha",sound:"kh",order:7},{id:"dal",ar:"د",name:"Dal",sound:"d",order:8},
      {id:"dhal",ar:"ذ",name:"Dhal",sound:"dh",order:9},{id:"ra",ar:"ر",name:"Ra",sound:"r",order:10},
      {id:"zay",ar:"ز",name:"Zay",sound:"z",order:11},{id:"sin",ar:"س",name:"Sin",sound:"s",order:12},
      {id:"shin",ar:"ش",name:"Shin",sound:"sh",order:13},{id:"sad",ar:"ص",name:"Sad",sound:"s",order:14},
      {id:"dad",ar:"ض",name:"Dad",sound:"d",order:15},{id:"ta2",ar:"ط",name:"Ta",sound:"t",order:16},
      {id:"za",ar:"ظ",name:"Za",sound:"z",order:17},{id:"ayn",ar:"ع",name:"Ayn",sound:"3",order:18},
      {id:"ghayn",ar:"غ",name:"Ghayn",sound:"gh",order:19},{id:"fa",ar:"ف",name:"Fa",sound:"f",order:20},
      {id:"qaf",ar:"ق",name:"Qaf",sound:"q",order:21},{id:"kaf",ar:"ك",name:"Kaf",sound:"k",order:22},
      {id:"lam",ar:"ل",name:"Lam",sound:"l",order:23},{id:"mim",ar:"م",name:"Mim",sound:"m",order:24},
      {id:"nun",ar:"ن",name:"Nun",sound:"n",order:25},{id:"ha2",ar:"ه",name:"Ha",sound:"h",order:26},
      {id:"waw",ar:"و",name:"Waw",sound:"w",order:27},{id:"ya",ar:"ي",name:"Ya",sound:"y",order:28}
    ];
    toast("Init lettres...");
    try {
      for (const l of letters) await window.FB.setDocument("letters", l.id, l);
      toast("28 lettres créées");
      await loadLettersList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============================================================
  // ONGLET DÉFINITIONS
  // ============================================================
  async function renderDefinitionsTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">DÉFINITIONS ÉTYMOLOGIQUES</div>' +
        '<input class="input admin-search" type="search" id="defsSearch" placeholder="Rechercher..."/>' +
        '<div class="admin-count" id="defsCount">0</div>' +
        '<div id="defsList" class="admin-list">Chargement...</div>' +
      '</div>' +
      '<div class="panel mt-12 sub-panel">' +
        '<div class="panel-title">+ NOUVELLE DÉFINITION</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="defAr" placeholder="Mot arabe (ex: كتاب)" dir="rtl"/>' +
          '<input class="input" id="defRoot" placeholder="Racine (ex: ك-ت-ب)" dir="rtl"/>' +
          '<input class="input" id="defFr" placeholder="Traduction française"/>' +
          '<input class="input" id="defShort" placeholder="Définition courte"/>' +
          '<textarea class="textarea admin-textarea" id="defLong" placeholder="Définition longue"></textarea>' +
          '<input class="input" id="defSources" placeholder="Sources (ex: Mufradat p.247)"/>' +
          '<label class="admin-label">Rareté<select class="input" id="defRarity">' +
            '<option value="commune">Commune</option><option value="rare">Rare</option>' +
            '<option value="epique">Épique</option><option value="legendaire">Légendaire</option>' +
          '</select></label>' +
          '<label class="toggle-row"><input type="checkbox" id="defAd"/><span>📺 Pub pour débloquer</span></label>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="addDefBtn">+ Ajouter</button>' +
      '</div>';
    document.getElementById("addDefBtn").onclick = addDefinition;
    const sb = document.getElementById("defsSearch");
    sb.value = searchQueries.defs || "";
    sb.addEventListener("input", function(){ searchQueries.defs = sb.value; loadDefsList(); });
    await loadDefsList();
  }

  async function loadDefsList() {
    let defs;
    try { defs = await window.FB.getCollection("definitions") || []; }
    catch (e) { document.getElementById("defsList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const list = document.getElementById("defsList");
    const count = document.getElementById("defsCount");
    const q = (searchQueries.defs || "").toLowerCase();
    const filtered = defs.filter(function(d){
      if (!q) return true;
      return (d.ar||"").toLowerCase().indexOf(q)!==-1 || (d.fr||"").toLowerCase().indexOf(q)!==-1;
    });
    if (count) count.textContent = filtered.length + " définition" + (filtered.length>1?"s":"");
    if (!list) return;
    if (filtered.length === 0) { list.innerHTML = '<div class="admin-empty">Aucune définition</div>'; return; }
    list.innerHTML = filtered.map(function(d) {
      return '<div class="word-row admin-word-row"><div class="word-body">' +
        '<div class="word-ar">' + escapeHTML(d.ar||"") + '</div>' +
        (d.root ? '<div class="admin-meta-tiny">racine: ' + escapeHTML(d.root) + '</div>' : '') +
        '<div class="word-fr">' + escapeHTML(d.fr||"") + '</div>' +
        '<div class="admin-meta-tiny">[' + escapeHTML(d.rarity||"commune") + ']' + (d.adWall?' · 📺':'') + '</div>' +
        '</div><div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-def="' + d._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-del-def]").forEach(function(btn) {
      btn.onclick = async function() {
        try { await window.FB.deleteDocument("definitions", btn.getAttribute("data-del-def")); toast("Supprimé"); loadDefsList(); }
        catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addDefinition() {
    const data = {
      ar: getVal("defAr"), root: getVal("defRoot"), fr: getVal("defFr"),
      shortDef: getVal("defShort"), longDef: getVal("defLong"), sources: getVal("defSources"),
      rarity: document.getElementById("defRarity").value,
      adWall: document.getElementById("defAd").checked,
      createdAt: Date.now()
    };
    if (!data.ar || !data.fr) { toast("Arabe et français requis"); return; }
    try {
      await window.FB.addDocument("definitions", data);
      ["defAr","defRoot","defFr","defShort","defLong","defSources"].forEach(clearVal);
      toast("Définition ajoutée");
      loadDefsList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============================================================
  // ONGLET NOTIONS
  // ============================================================
  async function renderNotionsTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">NOTIONS ÉTYMOLOGIQUES</div>' +
        '<div class="admin-count" id="notionsCount">0</div>' +
        '<div id="notionsList" class="admin-list">Chargement...</div>' +
      '</div>' +
      '<div class="panel mt-12 sub-panel">' +
        '<div class="panel-title">+ NOUVELLE NOTION</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="notionRoot" placeholder="Racine (ex: ك-ت-ب)" dir="rtl"/>' +
          '<input class="input" id="notionKeywords" placeholder="Mots-clés (écrire, livre, décret)"/>' +
          '<textarea class="textarea admin-textarea" id="notionText" placeholder="Explication courte"></textarea>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="addNotionBtn">+ Ajouter</button>' +
      '</div>';
    document.getElementById("addNotionBtn").onclick = addNotion;
    await loadNotionsList();
  }

  async function loadNotionsList() {
    let notions;
    try { notions = await window.FB.getCollection("notions") || []; }
    catch (e) { document.getElementById("notionsList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const list = document.getElementById("notionsList");
    const count = document.getElementById("notionsCount");
    if (count) count.textContent = notions.length + " notion" + (notions.length>1?"s":"");
    if (!list) return;
    if (notions.length === 0) { list.innerHTML = '<div class="admin-empty">Aucune notion</div>'; return; }
    list.innerHTML = notions.map(function(n) {
      return '<div class="word-row admin-word-row"><div class="word-body">' +
        '<div class="word-ar">' + escapeHTML(n.root||"") + '</div>' +
        '<div class="admin-meta-tiny">' + escapeHTML(n.keywords||"") + '</div>' +
        '<div class="word-fr">' + escapeHTML((n.text||"").substring(0,80)) + '</div>' +
        '</div><div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-n="' + n._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-del-n]").forEach(function(btn) {
      btn.onclick = async function() {
        try { await window.FB.deleteDocument("notions", btn.getAttribute("data-del-n")); toast("Supprimé"); loadNotionsList(); }
        catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addNotion() {
    const data = { root: getVal("notionRoot"), keywords: getVal("notionKeywords"), text: getVal("notionText"), createdAt: Date.now() };
    if (!data.root || !data.text) { toast("Racine et texte requis"); return; }
    try {
      await window.FB.addDocument("notions", data);
      ["notionRoot","notionKeywords","notionText"].forEach(clearVal);
      toast("Notion ajoutée");
      loadNotionsList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============================================================
  // ONGLET DÉBLOCABLES
  // ============================================================
  async function renderUnlocksTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">CONTENUS DÉBLOCABLES</div>' +
        '<div id="unlocksList" class="admin-list">Chargement...</div>' +
      '</div>' +
      '<div class="panel mt-12 sub-panel">' +
        '<div class="panel-title">+ NOUVEAU DÉBLOCABLE</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="unlockName" placeholder="Nom (ex: Boost XP x2)"/>' +
          '<label class="admin-label">Type<select class="input" id="unlockType">' +
            '<option value="boost_xp">Boost XP</option><option value="definition">Définition</option>' +
            '<option value="notion">Notion</option><option value="rare_word">Mot rare</option>' +
          '</select></label>' +
          '<input class="input" id="unlockReward" placeholder="Récompense (ex: x2 XP 1h)"/>' +
          '<label class="admin-label">Pubs pour débloquer<select class="input" id="unlockCost">' +
            '<option value="1">1 pub</option><option value="2">2 pubs</option><option value="3">3 pubs</option>' +
          '</select></label>' +
          '<label class="toggle-row"><input type="checkbox" id="unlockActive" checked/><span>Actif</span></label>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="addUnlockBtn">+ Ajouter</button>' +
      '</div>';
    document.getElementById("addUnlockBtn").onclick = addUnlock;
    await loadUnlocksList();
  }

  async function loadUnlocksList() {
    let unlocks;
    try { unlocks = await window.FB.getCollection("unlocks") || []; }
    catch (e) { document.getElementById("unlocksList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const list = document.getElementById("unlocksList");
    if (!list) return;
    if (unlocks.length === 0) { list.innerHTML = '<div class="admin-empty">Aucun déblocable</div>'; return; }
    list.innerHTML = unlocks.map(function(u) {
      return '<div class="list-item admin-list-item"><div class="admin-item-body">' +
        '<div class="title">' + escapeHTML(u.name||"") + '</div>' +
        '<div class="meta">' + escapeHTML(u.type||"") + ' · ' + (u.cost||1) + ' pub(s) · ' + (u.active!==false?"actif":"inactif") + '</div>' +
        '</div><div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-u="' + u._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-del-u]").forEach(function(btn) {
      btn.onclick = async function() {
        try { await window.FB.deleteDocument("unlocks", btn.getAttribute("data-del-u")); toast("Supprimé"); loadUnlocksList(); }
        catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addUnlock() {
    const data = {
      name: getVal("unlockName"),
      type: document.getElementById("unlockType").value,
      cost: parseInt(document.getElementById("unlockCost").value, 10),
      reward: getVal("unlockReward"),
      active: document.getElementById("unlockActive").checked,
      createdAt: Date.now()
    };
    if (!data.name) { toast("Nom requis"); return; }
    try {
      await window.FB.addDocument("unlocks", data);
      ["unlockName","unlockReward"].forEach(clearVal);
      toast("Déblocable ajouté");
      loadUnlocksList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============================================================
  // ONGLET CONTENUS (Mot du jour + Listes)
  // ============================================================
  function renderContenusTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">CONTENUS DIVERS</div>' +
        '<div class="sub-tabs">' +
          '<button class="filter-chip active" data-sub="wotd">Mot du jour</button>' +
          '<button class="filter-chip" data-sub="lists">Listes officielles</button>' +
        '</div>' +
        '<div id="contenusSub"></div>' +
      '</div>';
    container.querySelectorAll(".sub-tabs .filter-chip").forEach(function(btn) {
      btn.onclick = function() {
        container.querySelectorAll(".sub-tabs .filter-chip").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        const sub = btn.getAttribute("data-sub");
        if (sub === "wotd") renderWotdSub(document.getElementById("contenusSub"));
        else renderListsSub(document.getElementById("contenusSub"));
      };
    });
    renderWotdSub(document.getElementById("contenusSub"));
  }

  async function renderWotdSub(c) {
    c.innerHTML =
      '<div id="wotdList" class="admin-list">Chargement...</div>' +
      '<div class="panel sub-panel mt-12">' +
        '<div class="panel-title">+ MOT DU JOUR</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="wotdAr" placeholder="Mot arabe" dir="rtl"/>' +
          '<input class="input" id="wotdFr" placeholder="Traduction"/>' +
          '<input class="input" id="wotdDef" placeholder="Définition courte"/>' +
          '<input class="input" id="wotdExAr" placeholder="Exemple arabe" dir="rtl"/>' +
          '<input class="input" id="wotdExFr" placeholder="Traduction exemple"/>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="addWotdBtn">+ Ajouter</button>' +
      '</div>';
    document.getElementById("addWotdBtn").onclick = addWotd;
    await loadWotdList();
  }

  async function loadWotdList() {
    let list;
    try { list = await window.FB.getCollection("wotd") || []; }
    catch (e) { document.getElementById("wotdList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const c = document.getElementById("wotdList");
    if (!c) return;
    if (list.length === 0) { c.innerHTML = '<div class="admin-empty">Aucun mot du jour</div>'; return; }
    c.innerHTML = list.map(function(w) {
      return '<div class="word-row admin-word-row"><div class="word-body">' +
        '<div class="word-ar">' + escapeHTML(w.ar||"") + '</div>' +
        '<div class="word-fr">' + escapeHTML(w.fr||"") + '</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-wotd="' + w._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    c.querySelectorAll("[data-del-wotd]").forEach(function(btn) {
      btn.onclick = async function() {
        try { await window.FB.deleteDocument("wotd", btn.getAttribute("data-del-wotd")); toast("Supprimé"); loadWotdList(); }
        catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addWotd() {
    const data = {
      ar: getVal("wotdAr"), fr: getVal("wotdFr"), def: getVal("wotdDef"),
      exAr: getVal("wotdExAr"), exFr: getVal("wotdExFr"), createdAt: Date.now()
    };
    if (!data.ar || !data.fr) { toast("Arabe et français requis"); return; }
    try {
      await window.FB.addDocument("wotd", data);
      ["wotdAr","wotdFr","wotdDef","wotdExAr","wotdExFr"].forEach(clearVal);
      toast("Mot du jour ajouté");
      loadWotdList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function renderListsSub(c) {
    c.innerHTML =
      '<div id="offListsList" class="admin-list">Chargement...</div>' +
      '<div class="panel sub-panel mt-12">' +
        '<div class="panel-title">+ LISTE OFFICIELLE</div>' +
        '<input class="input" id="offListName" placeholder="Nom (ex: Top 100 Coran)"/>' +
        '<button class="btn btn-gold mt-12" id="addOffListBtn">Créer</button>' +
      '</div>';
    document.getElementById("addOffListBtn").onclick = async function() {
      const name = getVal("offListName");
      if (!name) { toast("Nom requis"); return; }
      try {
        await window.FB.addDocument("officialLists", { name: name, words: [], createdAt: Date.now() });
        clearVal("offListName"); toast("Liste créée"); loadOffLists();
      } catch (e) { toast("Erreur: " + e.message); }
    };
    await loadOffLists();
  }

  async function loadOffLists() {
    let lists;
    try { lists = await window.FB.getCollection("officialLists") || []; }
    catch (e) { document.getElementById("offListsList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const c = document.getElementById("offListsList");
    if (!c) return;
    if (lists.length === 0) { c.innerHTML = '<div class="admin-empty">Aucune liste</div>'; return; }
    c.innerHTML = lists.map(function(l) {
      return '<div class="list-item admin-list-item"><div class="admin-item-body">' +
        '<div class="title">' + escapeHTML(l.name||"") + '</div>' +
        '<div class="meta">' + (l.words||[]).length + ' mots</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-ol="' + l._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    c.querySelectorAll("[data-del-ol]").forEach(function(btn) {
      btn.onclick = async function() {
        try { await window.FB.deleteDocument("officialLists", btn.getAttribute("data-del-ol")); toast("Supprimé"); loadOffLists(); }
        catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  // ============================================================
  // ONGLET USERS (comptes + invités)
  // ============================================================
  let usersData = [];
  let usersView = "top";
  let usersFilter = "all";

  async function renderUsersTab(container) {
    container.innerHTML = '<div class="admin-loading">Chargement des utilisateurs...</div>';
    let profiles = [], guests = [];
    try { profiles = await window.FB.getCollection("profiles") || []; }
    catch (e) { try { profiles = await window.FB.getCollection("users") || []; } catch (e2) {} }
    try { guests = await window.FB.getCollection("guests") || []; }
    catch (e) { guests = []; }
    guests.forEach(function(g){ g._isGuest = true; g.auth_method = "guest"; });
    usersData = profiles.concat(guests);

    const now = Date.now();
    const totalAccounts = profiles.length;
    const totalGuests = guests.length;
    const totalAll = totalAccounts + totalGuests;
    const premium = profiles.filter(function(u){ return u.is_premium || u.isPremium; }).length;
    const online = usersData.filter(function(u){ return isOnline(u, now); }).length;
    const activeWeek = usersData.filter(function(u){ return (now - lastSeen(u)) < 7*864e5; }).length;
    const guestsActiveWeek = guests.filter(function(u){ return (now - lastSeen(u)) < 7*864e5; }).length;
    const converted = guests.filter(function(g){ return g.promoted_to_user; }).length;
    const convRate = totalGuests > 0 ? Math.round((converted / totalGuests) * 100) : 0;
    const totalWords = usersData.reduce(function(s,u){ return s + wordsCount(u); }, 0);
    const totalTime = usersData.reduce(function(s,u){ return s + timePart(u,"total"); }, 0);

    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">VUE D\'ENSEMBLE</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + totalAll + '</b><span>Total</span></div>' +
          '<div class="stat"><b>' + totalAccounts + '</b><span>Comptes</span></div>' +
          '<div class="stat"><b>' + totalGuests + '</b><span>👤 Invités</span></div>' +
          '<div class="stat"><b class="admin-online-num">' + online + '</b><span>🟢 En ligne</span></div>' +
          '<div class="stat"><b>' + activeWeek + '</b><span>Actifs (7j)</span></div>' +
          '<div class="stat"><b>' + premium + '</b><span>Premium ⭐</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">CONVERSION INVITÉS</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + converted + '</b><span>Convertis en compte</span></div>' +
          '<div class="stat"><b>' + convRate + '%</b><span>Taux de conversion</span></div>' +
          '<div class="stat"><b>' + guestsActiveWeek + '</b><span>Invités actifs (7j)</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">ENGAGEMENT GLOBAL</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + totalWords + '</b><span>Mots appris</span></div>' +
          '<div class="stat"><b>' + fmtDuration(totalTime) + '</b><span>Temps cumulé</span></div>' +
        '</div>' +
        (isSuper() ? '<button class="btn btn-outline mt-12" id="exportCSVBtn" style="width:100%;">Exporter en CSV</button>' : '') +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">CLASSEMENTS</div>' +
        '<div class="sub-tabs">' +
          '<button class="filter-chip active" data-uv="top">Top XP</button>' +
          '<button class="filter-chip" data-uv="words">Top mots</button>' +
          '<button class="filter-chip" data-uv="time">Top temps</button>' +
          '<button class="filter-chip" data-uv="streak">Top streak</button>' +
        '</div>' +
        '<div id="usersRank" class="admin-list mt-12"></div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">LISTE COMPLÈTE</div>' +
        '<input class="input admin-search" type="search" id="usersSearch" placeholder="Rechercher..."/>' +
        '<div class="sub-tabs">' +
          '<button class="filter-chip active" data-uf="all">Tous</button>' +
          '<button class="filter-chip" data-uf="accounts">Comptes</button>' +
          '<button class="filter-chip" data-uf="guest">👤 Invités</button>' +
          '<button class="filter-chip" data-uf="online">🟢 En ligne</button>' +
          '<button class="filter-chip" data-uf="premium">Premium</button>' +
          '<button class="filter-chip" data-uf="converted">Convertis</button>' +
        '</div>' +
        '<div class="admin-count" id="usersCount">0</div>' +
        '<div id="usersFull" class="admin-list"></div>' +
      '</div>';

    const exp = document.getElementById("exportCSVBtn");
    if (exp) exp.onclick = exportUsersCSV;
    container.querySelectorAll("[data-uv]").forEach(function(btn) {
      btn.onclick = function() {
        usersView = btn.getAttribute("data-uv");
        container.querySelectorAll("[data-uv]").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        renderUsersRank();
      };
    });
    container.querySelectorAll("[data-uf]").forEach(function(btn) {
      btn.onclick = function() {
        usersFilter = btn.getAttribute("data-uf");
        container.querySelectorAll("[data-uf]").forEach(function(b){ b.classList.remove("active"); });
        btn.classList.add("active");
        renderUsersFull();
      };
    });
    const sb = document.getElementById("usersSearch");
    if (sb) sb.addEventListener("input", renderUsersFull);
    renderUsersRank();
    renderUsersFull();
  }

  function lastSeen(u) { return u.last_active_at || u.lastActiveAt || u.last_session || u.lastSession || 0; }
  function isOnline(u, now) { now = now || Date.now(); return (now - lastSeen(u)) < 5*60*1000; }
  function wordsCount(u) {
    if (typeof u.mastered_words === "number") return u.mastered_words;
    if (typeof u.masteredWords === "number") return u.masteredWords;
    if (Array.isArray(u.words_learned)) return u.words_learned.length;
    if (Array.isArray(u.wordsLearned)) return u.wordsLearned.length;
    return 0;
  }
  function timePart(u, part) {
    const t = u.time_spent || u.timeSpent || {};
    if (part === "total") return Number(t.total || u.time_total || 0);
    if (part === "day") return Number(t.day || 0);
    if (part === "week") return Number(t.week || 0);
    if (part === "month") return Number(t.month || 0);
    return 0;
  }
  function isGuestUser(u) { return (u.auth_method || u.authMethod) === "guest" || !(u.email); }
  function fmtDuration(sec) {
    sec = Number(sec) || 0;
    if (sec < 60) return sec + "s";
    const m = Math.floor(sec / 60);
    if (m < 60) return m + "min";
    const h = Math.floor(m / 60); const rm = m % 60;
    return h + "h" + (rm > 0 ? String(rm).padStart(2,"0") : "");
  }

  function renderUsersRank() {
    const list = document.getElementById("usersRank");
    if (!list) return;
    let sorted = usersData.slice();
    if (usersView === "top") sorted.sort(function(a,b){ return (b.xp||0)-(a.xp||0); });
    else if (usersView === "words") sorted.sort(function(a,b){ return wordsCount(b)-wordsCount(a); });
    else if (usersView === "time") sorted.sort(function(a,b){ return timePart(b,"total")-timePart(a,"total"); });
    else if (usersView === "streak") sorted.sort(function(a,b){ return (b.streak||0)-(a.streak||0); });
    const top = sorted.slice(0, 10);
    if (top.length === 0) { list.innerHTML = '<div class="admin-empty">Aucun utilisateur</div>'; return; }
    list.innerHTML = top.map(function(u, i) {
      const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":"#"+(i+1);
      let metric = "";
      if (usersView === "top") metric = (u.xp||0) + " XP";
      else if (usersView === "words") metric = wordsCount(u) + " mots";
      else if (usersView === "time") metric = fmtDuration(timePart(u,"total"));
      else metric = (u.streak||0) + " j de streak";
      return '<div class="list-item admin-list-item"><div class="admin-item-body">' +
        '<div class="title">' + medal + ' ' + escapeHTML(u.pseudo||"Anonyme") + '</div>' +
        '<div class="meta">' + escapeHTML(metric) + '</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-edit" data-view-u="' + (u._id||u.uid||"") + '" type="button">Voir</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-view-u]").forEach(function(btn) {
      btn.onclick = function() { showUserDetail(btn.getAttribute("data-view-u")); };
    });
  }

  function renderUsersFull() {
    const list = document.getElementById("usersFull");
    const count = document.getElementById("usersCount");
    if (!list) return;
    const now = Date.now();
    const sb = document.getElementById("usersSearch");
    const q = (sb ? sb.value : "").toLowerCase();
    let filtered = usersData.slice();
    if (usersFilter === "online") filtered = filtered.filter(function(u){ return isOnline(u, now); });
    else if (usersFilter === "premium") filtered = filtered.filter(function(u){ return u.is_premium || u.isPremium; });
    else if (usersFilter === "guest") filtered = filtered.filter(function(u){ return u._isGuest || isGuestUser(u); });
    else if (usersFilter === "accounts") filtered = filtered.filter(function(u){ return !u._isGuest && !isGuestUser(u); });
    else if (usersFilter === "converted") filtered = filtered.filter(function(u){ return u.promoted_to_user; });
    if (q) filtered = filtered.filter(function(u){
      return (u.pseudo||"").toLowerCase().indexOf(q)!==-1 || (u.email||"").toLowerCase().indexOf(q)!==-1;
    });
    filtered.sort(function(a,b){ return (b.xp||0)-(a.xp||0); });
    if (count) count.textContent = filtered.length + " utilisateur" + (filtered.length>1?"s":"");
    if (filtered.length === 0) { list.innerHTML = '<div class="admin-empty">Aucun résultat</div>'; return; }
    list.innerHTML = filtered.slice(0, 100).map(function(u) {
      const on = isOnline(u, now);
      const seen = lastSeen(u);
      const seenTxt = on ? "🟢 en ligne" : (seen ? "vu " + timeAgo(now - seen) : "jamais");
      const guest = isGuestUser(u) ? " · 👤 invité" : "";
      return '<div class="list-item admin-list-item"><div class="admin-item-body">' +
        '<div class="title">' + escapeHTML(u.pseudo||"Anonyme") + ((u.is_premium||u.isPremium)?" · ⭐":"") + guest + '</div>' +
        '<div class="meta">' + escapeHTML(u.email||"sans email") + '</div>' +
        '<div class="admin-meta-tiny">Niv ' + (u.level||1) + ' · ' + (u.xp||0) + ' XP · ' + wordsCount(u) + ' mots · ' + fmtDuration(timePart(u,"total")) + ' · ' + seenTxt + '</div>' +
        '</div><div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-edit" data-view-u="' + (u._id||u.uid||"") + '" type="button">Voir</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-view-u]").forEach(function(btn) {
      btn.onclick = function() { showUserDetail(btn.getAttribute("data-view-u")); };
    });
  }

  function timeAgo(ms) {
    const min = Math.floor(ms / 60000);
    if (min < 60) return "il y a " + min + " min";
    const h = Math.floor(min / 60);
    if (h < 24) return "il y a " + h + "h";
    const d = Math.floor(h / 24);
    return "il y a " + d + "j";
  }

  function showUserDetail(userId) {
    const u = usersData.find(function(x){ return (x._id===userId)||(x.uid===userId); });
    if (!u) { toast("Introuvable"); return; }
    const now = Date.now();
    const on = isOnline(u, now);
    const seen = lastSeen(u);
    const html =
      '<div style="text-align:left;">' +
        '<h3 style="font-family:Cinzel,serif;color:var(--gold-light);margin:0 0 6px;">' + escapeHTML(u.pseudo||"Anonyme") + '</h3>' +
        '<div class="admin-meta-tiny" style="margin-bottom:12px;">' + escapeHTML(u.email||"sans email") + (isGuestUser(u)?" · invité":"") + '</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + (u.level||1) + '</b><span>Niveau</span></div>' +
          '<div class="stat"><b>' + (u.xp||0) + '</b><span>XP</span></div>' +
          '<div class="stat"><b>' + wordsCount(u) + '</b><span>Mots appris</span></div>' +
          '<div class="stat"><b>' + (u.streak||0) + '</b><span>Streak</span></div>' +
        '</div>' +
        '<div class="stats-grid mt-12">' +
          '<div class="stat"><b>' + fmtDuration(timePart(u,"day")) + '</b><span>/ jour</span></div>' +
          '<div class="stat"><b>' + fmtDuration(timePart(u,"week")) + '</b><span>/ semaine</span></div>' +
          '<div class="stat"><b>' + fmtDuration(timePart(u,"month")) + '</b><span>/ mois</span></div>' +
          '<div class="stat"><b>' + fmtDuration(timePart(u,"total")) + '</b><span>Total</span></div>' +
        '</div>' +
        '<div class="admin-meta-tiny" style="margin-top:12px;line-height:1.7;">' +
          'Statut : ' + (on ? "🟢 en ligne" : "⚫ hors ligne") + '<br>' +
          'Dernière activité : ' + (seen ? new Date(seen).toLocaleString("fr-FR") : "jamais") + '<br>' +
          'Compte : ' + ((u.is_premium||u.isPremium) ? "Premium ⭐" : "Gratuit") +
        '</div>' +
      '</div>';
    if (window.Main && window.Main.showModal) window.Main.showModal("Détail utilisateur", html);
    else alert(u.pseudo + " — " + (u.xp||0) + " XP");
  }

  function exportUsersCSV() {
    if (usersData.length === 0) { toast("Aucun user"); return; }
    const headers = ["pseudo","email","level","xp","words","streak","time_total_sec","is_premium","last_seen"];
    const rows = usersData.map(function(u) {
      return [
        '"' + (u.pseudo||"").replace(/"/g,'""') + '"',
        '"' + (u.email||"") + '"',
        (u.level||1), (u.xp||0), wordsCount(u), (u.streak||0),
        timePart(u,"total"),
        ((u.is_premium||u.isPremium)?"OUI":"NON"),
        (lastSeen(u) ? new Date(lastSeen(u)).toISOString().slice(0,10) : "")
      ].join(",");
    });
    const csv = headers.join(",") + "\n" + rows.join("\n");
    const blob = new Blob(["\ufeff"+csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "users-" + new Date().toISOString().slice(0,10) + ".csv"; a.click();
    URL.revokeObjectURL(url);
    toast(usersData.length + " users exportés");
  }

  // ============================================================
  // ONGLET STATS
  // ============================================================
  async function renderStatsTab(container) {
    container.innerHTML = '<div class="admin-loading">Calcul des stats...</div>';
    let themes, defs, notions, unlocks, wotd, profiles, guests, iaGlobal, cfg;
    try {
      themes = await window.FB.getCollection("themes") || [];
      defs = await window.FB.getCollection("definitions") || [];
      notions = await window.FB.getCollection("notions") || [];
      unlocks = await window.FB.getCollection("unlocks") || [];
      wotd = await window.FB.getCollection("wotd") || [];
      profiles = await window.FB.getCollection("profiles") || [];
      guests = await window.FB.getCollection("guests") || [];
      iaGlobal = await window.FB.getCollection("ia_usage") || [];
      cfg = await window.FB.getDocument("config", "global") || {};
    } catch (e) {
      container.innerHTML = '<div class="panel"><div class="admin-error">Erreur: ' + e.message + '</div></div>';
      return;
    }
    themes.forEach(normalizeTheme);
    const allUsers = profiles.concat(guests);

    let totalWords = 0, totalLevels = 0, totalSubs = 0;
    themes.forEach(function(t){
      totalWords += countWordsInTheme(t);
      totalSubs += (t.subThemes||[]).length;
      (t.subThemes||[]).forEach(function(st){ totalLevels += (st.customLevels||[]).length; });
    });

    const now = Date.now();
    const online = allUsers.filter(function(u){ return isOnline(u, now); }).length;
    const activeWeek = allUsers.filter(function(u){ return (now - lastSeen(u)) < 7*864e5; }).length;
    const activeMonth = allUsers.filter(function(u){ return (now - lastSeen(u)) < 30*864e5; }).length;
    const totalTime = allUsers.reduce(function(s,u){ return s + timePart(u,"total"); }, 0);
    const avgTime = allUsers.length ? Math.round(totalTime / allUsers.length) : 0;
    const totalLearned = allUsers.reduce(function(s,u){ return s + wordsCount(u); }, 0);

    const today = todayKeyAdmin();
    const todayIa = iaGlobal.find(function(d){ return d._id === today; });
    const iaCount = todayIa ? (todayIa.count||0) : 0;
    const iaLimit = cfg.chatGlobalDailyLimit || 5000;
    const iaPct = Math.min(100, Math.round((iaCount/iaLimit)*100));
    const aiOn = cfg.aiEnabled !== false;

    const byCat = {};
    THEME_CATEGORIES.forEach(function(c){ byCat[c.id] = 0; });
    themes.forEach(function(t){ if (byCat[t.category] !== undefined) byCat[t.category]++; });

    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">ACTIVITÉ TEMPS RÉEL</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b class="admin-online-num">' + online + '</b><span>🟢 En ligne</span></div>' +
          '<div class="stat"><b>' + activeWeek + '</b><span>Actifs (7j)</span></div>' +
          '<div class="stat"><b>' + activeMonth + '</b><span>Actifs (30j)</span></div>' +
          '<div class="stat"><b>' + allUsers.length + '</b><span>Total users</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">ENGAGEMENT</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + fmtDuration(avgTime) + '</b><span>Temps moyen / user</span></div>' +
          '<div class="stat"><b>' + fmtDuration(totalTime) + '</b><span>Temps cumulé</span></div>' +
          '<div class="stat"><b>' + totalLearned + '</b><span>Mots appris (tous)</span></div>' +
        '</div>' +
      '</div>' +
      (isSuper() ?
      '<div class="panel mt-12">' +
        '<div class="panel-title">CONTRÔLE IA</div>' +
        '<div class="admin-ai-status ' + (aiOn?"ok":"off") + '"><b>' + (aiOn?"IA ACTIVÉE":"IA DÉSACTIVÉE") + '</b></div>' +
        '<div class="admin-ai-bar mt-12">' +
          '<div class="admin-ai-bar-label">Aujourd\'hui : ' + iaCount + ' / ' + iaLimit + ' messages</div>' +
          '<div class="admin-ai-bar-track"><div class="admin-ai-bar-fill ' + (iaPct>80?"danger":iaPct>50?"warning":"ok") + '" style="width:' + iaPct + '%"></div></div>' +
        '</div>' +
        '<button class="btn btn-outline mt-12" id="resetIaBtn" style="width:100%;">Reset compteurs IA (urgence)</button>' +
      '</div>' : '') +
      '<div class="panel mt-12">' +
        '<div class="panel-title">CONTENU</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + themes.length + '</b><span>Thèmes</span></div>' +
          '<div class="stat"><b>' + totalSubs + '</b><span>Sous-thèmes</span></div>' +
          '<div class="stat"><b>' + totalLevels + '</b><span>Niveaux</span></div>' +
          '<div class="stat"><b>' + totalWords + '</b><span>Mots</span></div>' +
          '<div class="stat"><b>' + defs.length + '</b><span>Définitions</span></div>' +
          '<div class="stat"><b>' + notions.length + '</b><span>Notions</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">THÈMES PAR CATÉGORIE</div>' +
        THEME_CATEGORIES.map(function(c) {
          return '<div class="list-item admin-list-item"><div class="admin-item-body">' +
            '<div class="title">' + c.emoji + ' ' + c.name + '</div>' +
            '<div class="meta">' + (byCat[c.id]||0) + ' thème(s)</div></div></div>';
        }).join("") +
      '</div>';

    const resetBtn = document.getElementById("resetIaBtn");
    if (resetBtn) resetBtn.onclick = async function() {
      if (!await confirmAction("Reset les compteurs IA d'aujourd'hui ?")) return;
      try {
        await window.FB.setDocument("ia_usage", today, { count: 0, date: today, lastUpdated: Date.now() });
        toast("Compteurs reset");
        renderStatsTab(container);
      } catch (e) { toast("Erreur: " + e.message); }
    };
  }

  function todayKeyAdmin() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }

  // ============================================================
  // ONGLET RÉGLAGES
  // ============================================================
  async function renderConfigTab(container) {
    let cfg = {};
    try { cfg = await window.FB.getDocument("config", "global") || {}; } catch (e) {}
    const lvlNames = cfg.levelNames || {
      debutant: "Débutant", intermediaire: "Intermédiaire",
      avance: "Avancé", expert: "Expert", mouallim: "Mouallim"
    };

    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">NIVEAU MOUALLIM (accès)</div>' +
        '<div class="form-grid">' +
          '<label class="admin-label">Condition Mouallim<select class="input" id="cfgMouallimAccess">' +
            '<option value="premium">Premium uniquement</option>' +
            '<option value="xp">Palier XP</option>' +
            '<option value="free">Libre (tout le monde)</option>' +
          '</select></label>' +
          '<label class="admin-label">Seuil XP Mouallim<input class="input" id="cfgMouallimXp" type="number" value="' + (cfg.mouallimThreshold || 12000) + '"/></label>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">NOMS DES NIVEAUX (legacy)</div>' +
        '<p class="form-hint">Renomme les anciens niveaux fixes.</p>' +
        '<div class="form-grid">' +
          '<input class="input" id="lvlN1" placeholder="Débutant" value="' + escapeHTML(lvlNames.debutant) + '"/>' +
          '<input class="input" id="lvlN2" placeholder="Intermédiaire" value="' + escapeHTML(lvlNames.intermediaire) + '"/>' +
          '<input class="input" id="lvlN3" placeholder="Avancé" value="' + escapeHTML(lvlNames.avance) + '"/>' +
          '<input class="input" id="lvlN4" placeholder="Expert" value="' + escapeHTML(lvlNames.expert) + '"/>' +
          '<input class="input" id="lvlN5" placeholder="Mouallim" value="' + escapeHTML(lvlNames.mouallim) + '"/>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">CONTRÔLE IA</div>' +
        '<div class="form-grid">' +
          '<label class="admin-label">IA activée<select class="input" id="cfgAiEnabled">' +
            '<option value="true">OUI</option><option value="false">NON</option>' +
          '</select></label>' +
          '<label class="admin-label">Limite gratuit/jour<input class="input" id="cfgChat" type="number" value="' + (cfg.chatDailyLimit || 10) + '"/></label>' +
          '<label class="admin-label">Limite premium/jour<input class="input" id="cfgChatPrem" type="number" value="' + (cfg.chatDailyLimitPremium || 100) + '"/></label>' +
          '<label class="admin-label">Limite globale/jour<input class="input" id="cfgChatGlobal" type="number" value="' + (cfg.chatGlobalDailyLimit || 5000) + '"/></label>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">XP & RÉCOMPENSES</div>' +
        '<div class="form-grid">' +
          '<label class="admin-label">XP bonne réponse QCM<input class="input" id="cfgXpQcm" type="number" value="' + (cfg.xpQcm || 10) + '"/></label>' +
          '<label class="admin-label">XP par mot maîtrisé<input class="input" id="cfgXpWord" type="number" value="' + (cfg.xpWord || 10) + '"/></label>' +
          '<label class="admin-label">XP par lettre apprise<input class="input" id="cfgXpLetter" type="number" value="' + (cfg.xpLetter || 15) + '"/></label>' +
          '<label class="admin-label">XP base révision rapide<input class="input" id="cfgXpRapid" type="number" value="' + (cfg.xpRapid || 5) + '"/></label>' +
          '<label class="admin-label">Multiplicateur XP Premium<input class="input" id="cfgMult" type="number" step="0.5" value="' + (cfg.premiumMultiplier || 2) + '"/></label>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">APPLICATION</div>' +
        '<div class="form-grid">' +
          '<label class="admin-label">Prix Premium (EUR)<input class="input" id="cfgPrice" type="number" step="0.01" value="' + (cfg.premiumPrice || 7.99) + '"/></label>' +
          '<label class="admin-label">Premium visible<select class="input" id="cfgPremVisible">' +
            '<option value="true">OUI</option><option value="false">NON</option>' +
          '</select></label>' +
          '<label class="admin-label">Pubs activées<select class="input" id="cfgAds">' +
            '<option value="true">OUI</option><option value="false">NON</option>' +
          '</select></label>' +
          '<label class="admin-label">Message d\'accueil<input class="input" id="cfgWelcome" value="' + escapeHTML(cfg.welcomeMessage||"") + '"/></label>' +
          '<label class="admin-label">Texte Notre méthode<textarea class="textarea admin-textarea" id="cfgMethode">' + escapeHTML(cfg.methodeText||"") + '</textarea></label>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-gold mt-12" id="saveCfgBtn" style="width:100%;padding:14px;">ENREGISTRER TOUS LES RÉGLAGES</button>';

    document.getElementById("cfgMouallimAccess").value = cfg.mouallimAccess || "premium";
    document.getElementById("cfgAiEnabled").value = (cfg.aiEnabled === false) ? "false" : "true";
    document.getElementById("cfgPremVisible").value = (cfg.premiumVisible === true) ? "true" : "false";
    document.getElementById("cfgAds").value = (cfg.adsEnabled === true) ? "true" : "false";

    document.getElementById("saveCfgBtn").onclick = async function() {
      try {
        await window.FB.setDocument("config", "global", {
          mouallimAccess: getVal("cfgMouallimAccess"),
          mouallimThreshold: parseInt(getVal("cfgMouallimXp"), 10) || 12000,
          levelNames: {
            debutant: getVal("lvlN1") || "Débutant",
            intermediaire: getVal("lvlN2") || "Intermédiaire",
            avance: getVal("lvlN3") || "Avancé",
            expert: getVal("lvlN4") || "Expert",
            mouallim: getVal("lvlN5") || "Mouallim"
          },
          aiEnabled: getVal("cfgAiEnabled") === "true",
          chatDailyLimit: parseInt(getVal("cfgChat"),10) || 10,
          chatDailyLimitPremium: parseInt(getVal("cfgChatPrem"),10) || 100,
          chatGlobalDailyLimit: parseInt(getVal("cfgChatGlobal"),10) || 5000,
          premiumPrice: parseFloat(getVal("cfgPrice")) || 7.99,
          premiumVisible: getVal("cfgPremVisible") === "true",
          adsEnabled: getVal("cfgAds") === "true",
          xpQcm: parseInt(getVal("cfgXpQcm"),10) || 10,
          xpWord: parseInt(getVal("cfgXpWord"),10) || 10,
          xpLetter: parseInt(getVal("cfgXpLetter"),10) || 15,
          xpRapid: parseInt(getVal("cfgXpRapid"),10) || 5,
          premiumMultiplier: parseFloat(getVal("cfgMult")) || 2,
          welcomeMessage: getVal("cfgWelcome"),
          methodeText: getVal("cfgMethode"),
          updatedAt: Date.now()
        });
        toast("Réglages enregistrés");
      } catch (e) { toast("Erreur: " + e.message); }
    };
  }

  // ============================================================
  // ONGLET OUTILS
  // ============================================================
  function renderToolsTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">EXPORTS / SAUVEGARDE</div>' +
        '<button class="btn btn-outline mt-8" id="exportAllBtn">Exporter toute la base (JSON)</button>' +
        '<button class="btn btn-outline mt-8" id="exportThemesBtn">Exporter les thèmes</button>' +
        '<button class="btn btn-outline mt-8" id="exportDefsBtn">Exporter les définitions</button>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">ACTIONS</div>' +
        '<button class="btn btn-outline mt-8" id="reloadBtn">Recharger l\'application</button>' +
        '<button class="btn btn-outline mt-8" id="announceBtn">Envoyer une annonce</button>' +
      '</div>';
    document.getElementById("exportAllBtn").onclick = exportAll;
    document.getElementById("exportThemesBtn").onclick = function(){ exportCollection("themes"); };
    document.getElementById("exportDefsBtn").onclick = function(){ exportCollection("definitions"); };
    document.getElementById("reloadBtn").onclick = function(){ location.reload(); };
    document.getElementById("announceBtn").onclick = async function() {
      const msg = prompt("Message à envoyer :");
      if (!msg) return;
      try {
        await window.FB.addDocument("announcements", { message: msg, createdAt: Date.now() });
        toast("Annonce envoyée");
      } catch (e) { toast("Erreur: " + e.message); }
    };
  }

  async function exportAll() {
    toast("Export en cours...");
    try {
      const data = {
        themes: await window.FB.getCollection("themes") || [],
        letters: await window.FB.getCollection("letters") || [],
        definitions: await window.FB.getCollection("definitions") || [],
        notions: await window.FB.getCollection("notions") || [],
        unlocks: await window.FB.getCollection("unlocks") || [],
        wotd: await window.FB.getCollection("wotd") || [],
        officialLists: await window.FB.getCollection("officialLists") || [],
        config: await window.FB.getDocument("config", "global") || {},
        exportedAt: Date.now()
      };
      downloadJSON(data, "dar-al-loughah-backup-" + new Date().toISOString().slice(0,10) + ".json");
      toast("Sauvegarde téléchargée");
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function exportCollection(name) {
    try {
      const items = await window.FB.getCollection(name) || [];
      downloadJSON(items, name + "-" + new Date().toISOString().slice(0,10) + ".json");
      toast(items.length + " items exportés");
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function getVal(id) { const el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function clearVal(id) { const el = document.getElementById(id); if (el) el.value = ""; }
  function toast(msg) {
    if (window.Main && window.Main.toast) window.Main.toast(msg);
    else console.log(msg);
  }
  function confirmAction(msg) {
    return new Promise(function(resolve) {
      if (window.Main && window.Main.confirm) {
        window.Main.confirm("Confirmation", msg, function(){ resolve(true); });
        setTimeout(function(){ resolve(false); }, 30000);
      } else {
        resolve(confirm(msg));
      }
    });
  }

  // API publique
  return { show: show };

})();

window.AdminScreen = AdminScreen;
console.log("✓ AdminScreen v5 (5 étages + breadcrumb + dupliquer + aperçu user) chargé");
