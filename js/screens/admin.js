/* =========================================================
   DAR AL LOUGHAH - ADMIN CONSOLE v4 (CMS PRO)
   - Catégories de thèmes (familles)
   - Niveaux flexibles (nom, emoji, accès, illimités)
   - Mode super-admin + mode prof/institut (restreint)
   - Stats avancées : temps passé, online, mots exacts
   - Auto-création des champs manquants (zéro SQL)
   ========================================================= */

const AdminScreen = (function() {

  let currentTab = "themes";
  let currentTheme = null;
  let currentCustomLevelId = null;   // FIX: niveau actif fiable (plus de sélecteur ~)
  let searchQueries = {};
  let myRole = "none";               // "super" | "teacher" | "none"

  // ===== CATÉGORIES DE THÈMES (familles) =====
  const THEME_CATEGORIES = [
    { id: "religieux",  name: "Sciences Religieuses", emoji: "🕌", color: "#c89a3a" },
    { id: "quotidien",  name: "Vie Quotidienne",      emoji: "💬", color: "#5EE0A5" },
    { id: "classique",  name: "Langue Classique",     emoji: "📜", color: "#f0c860" },
    { id: "academique", name: "Académique",           emoji: "🎓", color: "#3a6fc4" },
    { id: "monde",      name: "Monde & Société",       emoji: "🌍", color: "#FF7A9A" },
    { id: "institut",   name: "Programmes Instituts",  emoji: "⭐", color: "#fdeec3" }
  ];

  // ===== TYPES D'ACCÈS À UN NIVEAU =====
  const ACCESS_TYPES = [
    { id: "free",    label: "Gratuit (débloqué)" },
    { id: "premium", label: "Premium uniquement" },
    { id: "xp",      label: "Palier XP (atteindre X XP)" },
    { id: "locked",  label: "Verrouillé (caché)" }
  ];

  // ===== ENTRÉE PRINCIPALE =====
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

  // ===== DÉTECTION DU RÔLE =====
  function detectRole() {
    // Super admin = email dans CONFIG.ADMIN_EMAILS
    try {
      const user = (window.Auth && window.Auth.getUser) ? window.Auth.getUser() : null;
      if (user && user.email) {
        const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
        const isSuper = admins.map(function(e){ return (e||"").toLowerCase(); })
                              .indexOf(user.email.toLowerCase()) !== -1;
        if (isSuper) return "super";
        // Prof = champ role dans le state (sera défini via Supabase plus tard)
        const role = window.State && window.State.get ? window.State.get("role") : null;
        if (role === "teacher" || role === "institute_admin") return "teacher";
      }
    } catch (e) {}
    // Fallback : super admin via State.isAdmin()
    if (window.State && window.State.isAdmin && window.State.isAdmin()) return "super";
    return "none";
  }

  function isSuper() { return myRole === "super"; }

  // ===== UI PRINCIPALE (onglets adaptés au rôle) =====
  function renderAdminUI() {
    const container = document.getElementById("adminContent");
    if (!container) return;

    // Onglets pour super admin (tout)
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

    // Onglets pour prof/institut (restreint : son contenu + ses élèves)
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

  // ===== HELPER : normalise un thème (auto-création des champs manquants) =====
  function normalizeTheme(theme) {
    if (!theme) return theme;
    // Catégorie par défaut
    if (!theme.category) theme.category = "quotidien";
    // customLevels : si absent, on initialise vide
    if (!Array.isArray(theme.customLevels)) theme.customLevels = [];
    return theme;
  }
  // ============================================================
  // ONGLET THÈMES — Catégories + Niveaux flexibles
  // ============================================================
  async function renderThemesTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">GESTION DES THÈMES</div>' +
        '<input class="input admin-search" type="search" id="themesSearch" placeholder="Rechercher un thème..."/>' +
        '<div class="admin-cat-filter" id="catFilter"></div>' +
        '<div class="admin-count" id="themesCount">0 thèmes</div>' +
        '<div id="themesList" class="admin-list">Chargement...</div>' +
        (isSuper() ? '<button class="btn btn-gold mt-12" id="addThemeBtn">+ Nouveau thème</button>' : '') +
      '</div>' +
      '<div id="themeEditor" hidden></div>';

    // Filtres par catégorie
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

    const query = (searchQueries.themes || "").toLowerCase();
    const cat = searchQueries.themeCat || "all";

    let filtered = themes.filter(function(t) {
      if (cat !== "all" && t.category !== cat) return false;
      if (!query) return true;
      return (t.name || "").toLowerCase().indexOf(query) !== -1 ||
             (t._id || "").toLowerCase().indexOf(query) !== -1;
    });

    if (count) count.textContent = filtered.length + " thème" + (filtered.length > 1 ? "s" : "");

    if (themes.length === 0) {
      list.innerHTML =
        '<div class="admin-empty">Aucun thème en base.<br>' +
        (isSuper() ? '<button class="btn btn-outline mt-8" id="initThemesBtn">Initialiser les thèmes par défaut</button>' : '') +
        '</div>';
      const ib = document.getElementById("initThemesBtn");
      if (ib) ib.onclick = async function() {
        if (!await confirmAction("Créer les 12 thèmes par défaut ?")) return;
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
      const lvlCount = (t.customLevels || []).length;
      const wordCount = countWordsInTheme(t);
      return '<div class="list-item admin-list-item">' +
        '<div class="admin-item-body">' +
          '<div class="title">' + escapeHTML(t.icon || catInfo.emoji) + ' ' + escapeHTML(t.name || t._id) + '</div>' +
          '<div class="meta">' + catInfo.emoji + ' ' + catInfo.name + ' · ' + lvlCount + ' niveaux · ' + wordCount + ' mots</div>' +
        '</div>' +
        '<div class="admin-item-actions">' +
          '<button class="btn-mini btn-mini-edit" data-edit-theme="' + t._id + '" type="button">Gérer</button>' +
          (isSuper() ? '<button class="btn-mini btn-mini-del" data-del-theme="' + t._id + '" type="button">X</button>' : '') +
        '</div></div>';
    }).join("");

    list.querySelectorAll("[data-edit-theme]").forEach(function(btn) {
      btn.onclick = function() { openThemeEditor(btn.getAttribute("data-edit-theme")); };
    });
    list.querySelectorAll("[data-del-theme]").forEach(function(btn) {
      btn.onclick = function() { deleteTheme(btn.getAttribute("data-del-theme")); };
    });
  }

  function countWordsInTheme(theme) {
    let total = 0;
    // Nouveau format : customLevels
    if (Array.isArray(theme.customLevels)) {
      theme.customLevels.forEach(function(lvl) {
        if (Array.isArray(lvl.words)) total += lvl.words.length;
      });
    }
    // Ancien format : levels.{debutant..}
    if (theme.levels) {
      ["debutant","intermediaire","avance","expert","mouallim"].forEach(function(l) {
        if (Array.isArray(theme.levels[l])) total += theme.levels[l].length;
      });
    }
    return total;
  }
  // ============================================================
  // FORMULAIRE THÈME + ÉDITEUR DE NIVEAUX FLEXIBLES
  // ============================================================
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

    editor.innerHTML =
      '<div class="panel theme-editor-panel">' +
        '<div class="panel-title">' + (isNew ? "NOUVEAU THÈME" : "ÉDITER : " + escapeHTML(theme.name || "")) + '</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="thId" placeholder="ID (ex: salat)" value="' + escapeHTML(theme._id || theme.id || "") + '"' + (theme._id ? " disabled" : "") + '/>' +
          '<input class="input" id="thName" placeholder="Nom français" value="' + escapeHTML(theme.name || "") + '"/>' +
          '<input class="input" id="thNameAr" placeholder="Nom arabe" value="' + escapeHTML(theme.nameAr || "") + '" dir="rtl"/>' +
          '<input class="input" id="thIcon" placeholder="Emoji illustration" value="' + escapeHTML(theme.icon || "") + '" maxlength="4"/>' +
          '<label class="admin-label">Catégorie<select class="input" id="thCategory">' + catOptions + '</select></label>' +
          '<input class="input" id="thDesc" placeholder="Description" value="' + escapeHTML(theme.description || "") + '"/>' +
          '<input class="input" id="thOrder" type="number" placeholder="Ordre" value="' + (theme.order || 99) + '"/>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="saveThBtn">' + (isNew ? "Créer" : "Enregistrer les infos") + '</button>' +
        '<button class="btn btn-outline mt-8" id="cancelThBtn">Fermer</button>' +
      '</div>' +
      (!isNew ? renderLevelsManager(theme) : '<div class="panel mt-12"><div class="admin-empty">Crée le thème d\'abord, puis ajoute des niveaux.</div></div>');

    document.getElementById("saveThBtn").onclick = function() { saveTheme(isNew); };
    document.getElementById("cancelThBtn").onclick = function() { editor.hidden = true; };

    if (!isNew) bindLevelsManager(theme);
  }

  // ===== GESTIONNAIRE DE NIVEAUX FLEXIBLES =====
  function renderLevelsManager(theme) {
    const levels = (theme.customLevels || []).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});

    let levelsHtml = levels.map(function(lvl, i) {
      const accInfo = ACCESS_TYPES.find(function(a){ return a.id === lvl.access; }) || ACCESS_TYPES[0];
      const accLabel = lvl.access === "xp" ? ("Palier " + (lvl.accessValue||0) + " XP") : accInfo.label;
      const adTag = lvl.adWall ? ' · 📺 pub' : '';
      const wc = (lvl.words || []).length;
      const active = (lvl.id === currentCustomLevelId) ? " admin-level-active" : "";
      return '<div class="admin-level-row' + active + '" data-lvl="' + lvl.id + '">' +
        '<div class="admin-level-body" data-pick-level="' + lvl.id + '">' +
          '<div class="admin-level-name">' + escapeHTML(lvl.emoji || "📚") + ' ' + escapeHTML(lvl.name) + '</div>' +
          '<div class="admin-level-meta">' + wc + ' mots · ' + escapeHTML(accLabel) + adTag + '</div>' +
        '</div>' +
        '<div class="admin-level-actions">' +
          '<button class="btn-mini" data-lvl-up="' + lvl.id + '" type="button">↑</button>' +
          '<button class="btn-mini" data-lvl-down="' + lvl.id + '" type="button">↓</button>' +
          '<button class="btn-mini btn-mini-edit" data-lvl-edit="' + lvl.id + '" type="button">✎</button>' +
          '<button class="btn-mini btn-mini-del" data-lvl-del="' + lvl.id + '" type="button">X</button>' +
        '</div>' +
      '</div>';
    }).join("");

    if (levels.length === 0) {
      levelsHtml = '<div class="admin-empty">Aucun niveau. Ajoute le premier ci-dessous.</div>';
    }

    // Section migration (si ancien contenu présent)
    let migrateHtml = "";
    const hasOld = theme.levels && ["debutant","intermediaire","avance","expert","mouallim"].some(function(l){
      return Array.isArray(theme.levels[l]) && theme.levels[l].length > 0;
    });
    if (hasOld) {
      migrateHtml =
        '<div class="panel sub-panel mt-12 admin-migrate">' +
          '<div class="panel-title">⚠️ Ancien contenu détecté</div>' +
          '<p class="form-hint">Ce thème a des mots dans l\'ancien format (débutant, intermédiaire...). ' +
          'Tu peux les convertir en niveaux flexibles d\'un clic.</p>' +
          '<button class="btn btn-outline mt-8" id="migrateBtn">Convertir en niveaux flexibles</button>' +
        '</div>';
    }

    return '<div class="panel mt-12">' +
        '<div class="panel-title">NIVEAUX DU THÈME</div>' +
        '<p class="form-hint">Crée autant de niveaux que tu veux. Glisse avec ↑↓ pour réordonner. Clique un niveau pour éditer ses mots.</p>' +
        '<div id="levelsList" class="admin-levels-list">' + levelsHtml + '</div>' +
        '<div class="panel sub-panel mt-12">' +
          '<div class="panel-title">+ AJOUTER UN NIVEAU</div>' +
          '<div class="form-grid">' +
            '<input class="input" id="newLvlName" placeholder="Nom du niveau (ex: Salutations)"/>' +
            '<input class="input" id="newLvlEmoji" placeholder="Emoji (optionnel, ex: 👋)" maxlength="4"/>' +
            '<label class="admin-label">Accès<select class="input" id="newLvlAccess">' +
              ACCESS_TYPES.map(function(a){ return '<option value="' + a.id + '">' + a.label + '</option>'; }).join("") +
            '</select></label>' +
            '<input class="input" id="newLvlXp" type="number" placeholder="XP requis (si palier XP)"/>' +
            '<label class="toggle-row"><input type="checkbox" id="newLvlAd"/><span>📺 Pub au déblocage de ce niveau</span></label>' +
          '</div>' +
          '<button class="btn btn-gold mt-8" id="addLvlBtn">+ Créer ce niveau</button>' +
        '</div>' +
        migrateHtml +
      '</div>' +
      '<div id="levelWordsEditor"></div>';
  }

  function bindLevelsManager(theme) {
    // Ajouter un niveau
    const addBtn = document.getElementById("addLvlBtn");
    if (addBtn) addBtn.onclick = function() { addCustomLevel(theme); };

    // Migration
    const migBtn = document.getElementById("migrateBtn");
    if (migBtn) migBtn.onclick = function() { migrateOldLevels(theme); };

    // Actions sur chaque niveau
    document.querySelectorAll("[data-pick-level]").forEach(function(el) {
      el.onclick = function() {
        currentCustomLevelId = el.getAttribute("data-pick-level");
        showThemeForm(theme); // re-render pour marquer actif
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

    // Si un niveau était actif, on ré-affiche son éditeur de mots
    if (currentCustomLevelId) renderLevelWordsEditor(theme);
  }

  async function addCustomLevel(theme) {
    const name = getVal("newLvlName");
    if (!name) { toast("Nom du niveau requis"); return; }
    const emoji = getVal("newLvlEmoji");
    const access = document.getElementById("newLvlAccess").value;
    const xp = parseInt(getVal("newLvlXp"), 10) || 0;
    const adWall = document.getElementById("newLvlAd").checked;

    if (!Array.isArray(theme.customLevels)) theme.customLevels = [];
    const newId = "lvl_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    theme.customLevels.push({
      id: newId, name: name, emoji: emoji, access: access,
      accessValue: xp, adWall: adWall, words: [], chunks: [],
      order: theme.customLevels.length + 1
    });

    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Niveau « " + name + " » créé");
      currentCustomLevelId = newId;
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function editCustomLevel(theme, lvlId) {
    const lvl = (theme.customLevels || []).find(function(l){ return l.id === lvlId; });
    if (!lvl) return;
    const newName = prompt("Nom du niveau :", lvl.name);
    if (newName === null) return;
    const newEmoji = prompt("Emoji (laisse vide pour aucun) :", lvl.emoji || "");
    if (newEmoji === null) return;
    lvl.name = newName.trim() || lvl.name;
    lvl.emoji = newEmoji.trim();
    window.FB.setDocument("themes", theme._id, theme).then(function() {
      toast("Niveau modifié");
      showThemeForm(theme);
    }).catch(function(e){ toast("Erreur: " + e.message); });
  }

  async function deleteCustomLevel(theme, lvlId) {
    if (!await confirmAction("Supprimer ce niveau et tous ses mots ?")) return;
    theme.customLevels = (theme.customLevels || []).filter(function(l){ return l.id !== lvlId; });
    if (currentCustomLevelId === lvlId) currentCustomLevelId = null;
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Niveau supprimé");
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function moveCustomLevel(theme, lvlId, dir) {
    const levels = (theme.customLevels || []).slice().sort(function(a,b){return(a.order||0)-(b.order||0);});
    const idx = levels.findIndex(function(l){ return l.id === lvlId; });
    if (idx === -1) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= levels.length) return;
    const tmp = levels[idx].order;
    levels[idx].order = levels[swap].order;
    levels[swap].order = tmp;
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function migrateOldLevels(theme) {
    if (!await confirmAction("Convertir l'ancien contenu en niveaux flexibles ? (l'ancien reste intact en secours)")) return;
    if (!Array.isArray(theme.customLevels)) theme.customLevels = [];
    const map = [
      { key: "debutant",      name: "Débutant",      emoji: "🌱" },
      { key: "intermediaire", name: "Intermédiaire", emoji: "🌿" },
      { key: "avance",        name: "Avancé",        emoji: "🌳" },
      { key: "expert",        name: "Expert",        emoji: "⭐" },
      { key: "mouallim",      name: "Mouallim",      emoji: "👑" }
    ];
    let order = theme.customLevels.length;
    map.forEach(function(m) {
      const arr = (theme.levels && theme.levels[m.key]) || [];
      if (arr.length > 0) {
        order++;
        theme.customLevels.push({
          id: "lvl_mig_" + m.key + "_" + Date.now(),
          name: m.name, emoji: m.emoji,
          access: m.key === "mouallim" ? "premium" : "free",
          accessValue: 0, adWall: false,
          words: arr.slice(), chunks: [],
          order: order
        });
      }
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Migration réussie !");
      showThemeForm(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function openThemeCreator() { showThemeForm({}); }

  async function openThemeEditor(themeId) {
    try {
      const theme = await window.FB.getDocument("themes", themeId);
      if (!theme) { toast("Thème introuvable"); return; }
      normalizeTheme(theme);
      currentTheme = theme;
      currentCustomLevelId = null;
      showThemeForm(theme);
      const ed = document.getElementById("themeEditor");
      if (ed) ed.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { toast("Erreur: " + e.message); }
  }
  // ============================================================
  // ÉDITEUR DE MOTS D'UN NIVEAU (fix: currentCustomLevelId fiable)
  // ============================================================
  function getCurrentLevel(theme) {
    if (!currentCustomLevelId) return null;
    return (theme.customLevels || []).find(function(l){ return l.id === currentCustomLevelId; });
  }

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

    // Ajouter un mot — DANS LE BON NIVEAU (fix)
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
      toast("Mot ajouté dans « " + lvl.name + " »");
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
      toast(lines.length + " mots importés dans « " + lvl.name + " »");
      renderLevelWordsEditor(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function deleteWordFromLevel(theme, index) {
    const lvl = getCurrentLevel(theme);
    if (!lvl) return;
    if (!await confirmAction("Supprimer ce mot ?")) return;
    lvl.words.splice(index, 1);
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Mot supprimé");
      renderLevelWordsEditor(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ===== SAUVEGARDE / SUPPRESSION THÈME =====
  async function saveTheme(isNew) {
    const id = getVal("thId"), name = getVal("thName");
    if (!id || !name) { toast("ID et nom requis"); return; }
    const data = {
      id: id, name: name,
      nameAr: getVal("thNameAr"),
      icon: getVal("thIcon"),
      category: document.getElementById("thCategory").value,
      description: getVal("thDesc"),
      order: parseInt(getVal("thOrder"), 10) || 99
    };
    if (isNew) {
      data.customLevels = [];
      data.createdAt = Date.now();
    } else if (currentTheme) {
      // On préserve les niveaux existants
      data.customLevels = currentTheme.customLevels || [];
      data.levels = currentTheme.levels; // ancien format en secours
    }
    try {
      await window.FB.setDocument("themes", id, data);
      toast("Thème enregistré");
      if (isNew) {
        currentTheme = await window.FB.getDocument("themes", id);
        normalizeTheme(currentTheme);
        showThemeForm(currentTheme);
      } else {
        await loadThemesList();
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
      { id:"quotidien", name:"Les Mots du Quotidien", nameAr:"الحياة اليومية", icon:"💬", category:"quotidien", order:1 },
      { id:"foi",       name:"La Foi",                nameAr:"الإيمان",        icon:"🕌", category:"religieux", order:2 },
      { id:"coran",     name:"Le Coran",              nameAr:"القرآن",         icon:"📖", category:"religieux", order:3 },
      { id:"famille",   name:"La Famille",            nameAr:"العائلة",        icon:"👨", category:"quotidien", order:4 },
      { id:"voyage",    name:"En Voyage",             nameAr:"في السفر",       icon:"✈️", category:"quotidien", order:5 }
    ];
    const listEl = document.getElementById("themesList");
    if (listEl) listEl.innerHTML = '<div class="admin-loading">Initialisation...</div>';
    let ok = 0;
    for (let i = 0; i < defaults.length; i++) {
      try {
        await window.FB.setDocument("themes", defaults[i].id, Object.assign({}, defaults[i], {
          customLevels: [], createdAt: Date.now()
        }));
        ok++;
      } catch (e) {}
    }
    toast(ok + " thèmes créés");
    await loadThemesList();
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
  // ONGLET DÉFINITIONS ÉTYMOLOGIQUES
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
        if (!await confirmAction("Supprimer ?")) return;
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
        if (!await confirmAction("Supprimer ?")) return;
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
        if (!await confirmAction("Supprimer ?")) return;
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
  // ONGLET CONTENUS (Mot du jour + Listes officielles)
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
        if (!await confirmAction("Supprimer ?")) return;
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
        if (!await confirmAction("Supprimer ?")) return;
        try { await window.FB.deleteDocument("officialLists", btn.getAttribute("data-del-ol")); toast("Supprimé"); loadOffLists(); }
        catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  // ============================================================
  // ONGLET USERS — Temps passé, Online, Dernière co, Mots exacts
  // ============================================================
  let usersData = [];
  let usersView = "top";
  let usersFilter = "all";

  async function renderUsersTab(container) {
    container.innerHTML = '<div class="admin-loading">Chargement des utilisateurs...</div>';
    let users;
    try { users = await window.FB.getCollection("users") || []; }
    catch (e) { container.innerHTML = '<div class="panel"><div class="admin-error">Erreur: ' + e.message + '</div></div>'; return; }
    usersData = users;

    const now = Date.now();
    const total = users.length;
    const premium = users.filter(function(u){ return u.is_premium || u.isPremium; }).length;
    const online = users.filter(function(u){ return isOnline(u, now); }).length;
    const activeWeek = users.filter(function(u){ return (now - lastSeen(u)) < 7*864e5; }).length;
    const totalWords = users.reduce(function(s,u){ return s + wordsCount(u); }, 0);
    const totalTime = users.reduce(function(s,u){ return s + (timePart(u,"total")); }, 0);

    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">VUE D\'ENSEMBLE</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + total + '</b><span>Inscrits</span></div>' +
          '<div class="stat"><b class="admin-online-num">' + online + '</b><span>🟢 En ligne</span></div>' +
          '<div class="stat"><b>' + activeWeek + '</b><span>Actifs (7j)</span></div>' +
          '<div class="stat"><b>' + premium + '</b><span>Premium</span></div>' +
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
        '<input class="input admin-search" type="search" id="usersSearch" placeholder="Rechercher pseudo ou email..."/>' +
        '<div class="sub-tabs">' +
          '<button class="filter-chip active" data-uf="all">Tous</button>' +
          '<button class="filter-chip" data-uf="online">🟢 En ligne</button>' +
          '<button class="filter-chip" data-uf="premium">Premium</button>' +
          '<button class="filter-chip" data-uf="guest">Invités</button>' +
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

  // ---- Helpers données user (gèrent les 2 formats : snake_case DB / camelCase) ----
  function lastSeen(u) {
    return u.last_active_at || u.lastActiveAt || u.last_session || u.lastSession || 0;
  }
  function isOnline(u, now) {
    now = now || Date.now();
    return (now - lastSeen(u)) < 5 * 60 * 1000; // actif dans les 5 dernières minutes
  }
  function wordsCount(u) {
    if (typeof u.mastered_words === "number") return u.mastered_words;
    if (typeof u.masteredWords === "number") return u.masteredWords;
    if (Array.isArray(u.words_learned)) return u.words_learned.length;
    if (Array.isArray(u.wordsLearned)) return u.wordsLearned.length;
    return 0;
  }
  function timePart(u, part) {
    // temps en secondes ; champs créés par le futur tracker
    const t = u.time_spent || u.timeSpent || {};
    if (part === "total") return Number(t.total || u.time_total || 0);
    if (part === "day")   return Number(t.day || 0);
    if (part === "week")  return Number(t.week || 0);
    if (part === "month") return Number(t.month || 0);
    return 0;
  }
  function isGuestUser(u) {
    return (u.auth_method || u.authMethod) === "guest" || !(u.email);
  }
  function fmtDuration(sec) {
    sec = Number(sec) || 0;
    if (sec < 60) return sec + "s";
    const m = Math.floor(sec / 60);
    if (m < 60) return m + "min";
    const h = Math.floor(m / 60);
    const rm = m % 60;
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
    else if (usersFilter === "guest") filtered = filtered.filter(isGuestUser);

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
          '<div class="stat"><b>' + fmtDuration(timePart(u,"day")) + '</b><span>Temps / jour</span></div>' +
          '<div class="stat"><b>' + fmtDuration(timePart(u,"week")) + '</b><span>Temps / semaine</span></div>' +
          '<div class="stat"><b>' + fmtDuration(timePart(u,"month")) + '</b><span>Temps / mois</span></div>' +
          '<div class="stat"><b>' + fmtDuration(timePart(u,"total")) + '</b><span>Temps total</span></div>' +
        '</div>' +
        '<div class="admin-meta-tiny" style="margin-top:12px;line-height:1.7;">' +
          'Statut : ' + (on ? "🟢 en ligne maintenant" : "⚫ hors ligne") + '<br>' +
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
  // ONGLET STATS — Vue d'ensemble + IA + temps + contenu
  // ============================================================
  async function renderStatsTab(container) {
    container.innerHTML = '<div class="admin-loading">Calcul des stats...</div>';
    let themes, defs, notions, unlocks, wotd, users, iaGlobal, cfg;
    try {
      themes  = await window.FB.getCollection("themes") || [];
      defs    = await window.FB.getCollection("definitions") || [];
      notions = await window.FB.getCollection("notions") || [];
      unlocks = await window.FB.getCollection("unlocks") || [];
      wotd    = await window.FB.getCollection("wotd") || [];
      users   = await window.FB.getCollection("users") || [];
      iaGlobal= await window.FB.getCollection("ia_usage") || [];
      cfg     = await window.FB.getDocument("config", "global") || {};
    } catch (e) {
      container.innerHTML = '<div class="panel"><div class="admin-error">Erreur: ' + e.message + '</div></div>';
      return;
    }

    themes.forEach(normalizeTheme);
    let totalWords = 0, totalLevels = 0;
    themes.forEach(function(t){ totalWords += countWordsInTheme(t); totalLevels += (t.customLevels||[]).length; });

    const now = Date.now();
    const online = users.filter(function(u){ return isOnline(u, now); }).length;
    const activeWeek = users.filter(function(u){ return (now - lastSeen(u)) < 7*864e5; }).length;
    const activeMonth = users.filter(function(u){ return (now - lastSeen(u)) < 30*864e5; }).length;
    const totalTime = users.reduce(function(s,u){ return s + timePart(u,"total"); }, 0);
    const avgTime = users.length ? Math.round(totalTime / users.length) : 0;
    const totalLearned = users.reduce(function(s,u){ return s + wordsCount(u); }, 0);

    const today = todayKeyAdmin();
    const todayIa = iaGlobal.find(function(d){ return d._id === today; });
    const iaCount = todayIa ? (todayIa.count||0) : 0;
    const iaLimit = cfg.chatGlobalDailyLimit || 5000;
    const iaPct = Math.min(100, Math.round((iaCount/iaLimit)*100));
    const aiOn = cfg.aiEnabled !== false;

    // Répartition par catégorie
    const byCat = {};
    THEME_CATEGORIES.forEach(function(c){ byCat[c.id] = 0; });
    themes.forEach(function(t){ if (byCat[t.category] !== undefined) byCat[t.category]++; });

    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">ACTIVITÉ EN TEMPS RÉEL</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b class="admin-online-num">' + online + '</b><span>🟢 En ligne</span></div>' +
          '<div class="stat"><b>' + activeWeek + '</b><span>Actifs (7j)</span></div>' +
          '<div class="stat"><b>' + activeMonth + '</b><span>Actifs (30j)</span></div>' +
          '<div class="stat"><b>' + users.length + '</b><span>Inscrits</span></div>' +
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
          '<div class="stat"><b>' + totalLevels + '</b><span>Niveaux</span></div>' +
          '<div class="stat"><b>' + totalWords + '</b><span>Mots</span></div>' +
          '<div class="stat"><b>' + defs.length + '</b><span>Définitions</span></div>' +
          '<div class="stat"><b>' + notions.length + '</b><span>Notions</span></div>' +
          '<div class="stat"><b>' + wotd.length + '</b><span>Mots du jour</span></div>' +
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
      if (!await confirmAction("Reset les compteurs IA d'aujourd'hui ? (urgence uniquement)")) return;
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
  // ONGLET RÉGLAGES — Noms niveaux, seuils, premium, IA
  // ============================================================
  async function renderConfigTab(container) {
    let cfg = {};
    try { cfg = await window.FB.getDocument("config", "global") || {}; } catch (e) {}

    // Noms de niveaux globaux par défaut (legacy) — éditables
    const lvlNames = cfg.levelNames || {
      debutant: "Débutant", intermediaire: "Intermédiaire",
      avance: "Avancé", expert: "Expert", mouallim: "Mouallim"
    };

    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">NIVEAU MOUALLIM (accès)</div>' +
        '<div class="form-grid">' +
          '<label class="admin-label">Condition d\'accès Mouallim<select class="input" id="cfgMouallimAccess">' +
            '<option value="premium">Premium uniquement</option>' +
            '<option value="xp">Palier XP</option>' +
            '<option value="free">Libre (tout le monde)</option>' +
          '</select></label>' +
          '<label class="admin-label">Seuil XP Mouallim (si palier XP)<input class="input" id="cfgMouallimXp" type="number" value="' + (cfg.mouallimThreshold || 12000) + '"/></label>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">NOMS DES NIVEAUX (legacy)</div>' +
        '<p class="form-hint">Renomme les anciens niveaux fixes. (Les nouveaux niveaux flexibles ont déjà leur propre nom.)</p>' +
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
          '<label class="admin-label">IA activée (kill switch)<select class="input" id="cfgAiEnabled">' +
            '<option value="true">OUI — active</option><option value="false">NON — désactivée</option>' +
          '</select></label>' +
          '<label class="admin-label">Limite msg / gratuit / jour<input class="input" id="cfgChat" type="number" value="' + (cfg.chatDailyLimit || 10) + '"/></label>' +
          '<label class="admin-label">Limite msg / premium / jour<input class="input" id="cfgChatPrem" type="number" value="' + (cfg.chatDailyLimitPremium || 100) + '"/></label>' +
          '<label class="admin-label">Limite globale / jour<input class="input" id="cfgChatGlobal" type="number" value="' + (cfg.chatGlobalDailyLimit || 5000) + '"/></label>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">APPLICATION</div>' +
        '<div class="form-grid">' +
          '<label class="admin-label">Prix Premium (EUR)<input class="input" id="cfgPrice" type="number" step="0.01" value="' + (cfg.premiumPrice || 7.99) + '"/></label>' +
          '<label class="admin-label">Premium visible<select class="input" id="cfgPremVisible">' +
            '<option value="true">OUI</option><option value="false">NON (caché)</option>' +
          '</select></label>' +
          '<label class="admin-label">Pubs activées<select class="input" id="cfgAds">' +
            '<option value="true">OUI</option><option value="false">NON</option>' +
          '</select></label>' +
          '<label class="admin-label">XP par bonne réponse<input class="input" id="cfgXpQcm" type="number" value="' + (cfg.xpQcm || 10) + '"/></label>' +
          '<label class="admin-label">Multiplicateur XP Premium<input class="input" id="cfgMult" type="number" step="0.5" value="' + (cfg.premiumMultiplier || 2) + '"/></label>' +
          '<label class="admin-label">Message d\'accueil<input class="input" id="cfgWelcome" value="' + escapeHTML(cfg.welcomeMessage||"") + '"/></label>' +
          '<label class="admin-label">Texte « Notre méthode »<textarea class="textarea admin-textarea" id="cfgMethode">' + escapeHTML(cfg.methodeText||"") + '</textarea></label>' +
        '</div>' +
      '</div>' +
      '<button class="btn btn-gold mt-12" id="saveCfgBtn" style="width:100%;padding:14px;">ENREGISTRER TOUS LES RÉGLAGES</button>';

    // Pré-sélection des selects
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
          premiumMultiplier: parseFloat(getVal("cfgMult")) || 2,
          welcomeMessage: getVal("cfgWelcome"),
          methodeText: getVal("cfgMethode")
        });
        toast("Réglages enregistrés");
      } catch (e) { toast("Erreur: " + e.message); }
    };
  }
