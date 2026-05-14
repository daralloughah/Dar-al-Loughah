/* =========================================================
   DAR AL LOUGHAH - ADMIN CONSOLE v3
   12 onglets, recherche live, scroll reset, prep Firebase Storage
   ========================================================= */

const AdminScreen = (function() {

  let currentTab = "themes";
  let currentTheme = null;
  let currentLevel = "debutant";
  let searchQueries = {};

  // ============ ENTREE PRINCIPALE ============
  async function show() {
    let isAdmin = false;
    if (window.FB && window.FB.isCurrentUserAdmin && window.FB.isCurrentUserAdmin()) isAdmin = true;
    if (!isAdmin && window.State && window.State.isAdmin && window.State.isAdmin()) isAdmin = true;
    if (!isAdmin && window.Auth && window.Auth.getUser) {
      const user = window.Auth.getUser();
      if (user && user.email) {
        const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
        const adminsLower = admins.map(function(e) { return e.toLowerCase(); });
        if (adminsLower.indexOf(user.email.toLowerCase()) !== -1) isAdmin = true;
      }
    }
    if (!isAdmin) {
      toast("Acces admin reserve");
      if (window.Main) window.Main.goto("home");
      return;
    }
    renderAdminUI();
    showTab(currentTab || "themes");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  // ============ UI PRINCIPALE ============
  function renderAdminUI() {
    const container = document.getElementById("adminContent");
    if (!container) return;
    container.innerHTML =
      '<div class="admin-tabs-wrap"><div class="admin-tabs">' +
        '<button class="filter-chip active" data-tab="themes">Themes</button>' +
        '<button class="filter-chip" data-tab="letters">Lettres</button>' +
        '<button class="filter-chip" data-tab="definitions">Definitions</button>' +
        '<button class="filter-chip" data-tab="notions">Notions</button>' +
        '<button class="filter-chip" data-tab="unlocks">Deblocables</button>' +
        '<button class="filter-chip" data-tab="contenus">Contenus</button>' +
        '<button class="filter-chip" data-tab="users">Users</button>' +
        '<button class="filter-chip" data-tab="stats">Stats</button>' +
        '<button class="filter-chip" data-tab="config">Reglages</button>' +
        '<button class="filter-chip" data-tab="tools">Outils</button>' +
      '</div></div>' +
      '<div id="adminTabContent"></div>';
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

  // ============ ONGLET 1 : THEMES ============
  async function renderThemesTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">GESTION DES THEMES</div>' +
        '<input class="input admin-search" type="search" id="themesSearch" placeholder="Rechercher un theme..."/>' +
        '<div class="admin-count" id="themesCount">0 themes</div>' +
        '<div id="themesList" class="admin-list">Chargement...</div>' +
        '<button class="btn btn-gold mt-12" id="addThemeBtn">+ Nouveau theme</button>' +
      '</div>' +
      '<div id="themeEditor" hidden></div>';
    document.getElementById("addThemeBtn").onclick = openThemeCreator;
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
    catch (e) { list.innerHTML = '<div class="admin-error">Erreur Firebase: ' + e.message + '</div>'; return; }
    const query = (searchQueries.themes || "").toLowerCase();
    const filtered = themes.filter(function(t) {
      if (!query) return true;
      return (t.name || "").toLowerCase().indexOf(query) !== -1 ||
             (t._id || "").toLowerCase().indexOf(query) !== -1;
    });
    if (count) count.textContent = filtered.length + " theme" + (filtered.length > 1 ? "s" : "") + (query ? " (filtre)" : "");
        if (themes.length === 0) {
      list.innerHTML =
        '<div class="admin-empty">Aucun theme en base.<br>' +
        '<button class="btn btn-outline mt-8" id="initThemesBtn">Initialiser les 12 themes par defaut</button>' +
        '<div class="admin-meta-tiny" style="margin-top:10px; color:#ff9aa5;">Attention : action irreversible. Cree 12 themes vides.</div></div>';
      const ib = document.getElementById("initThemesBtn");
      if (ib) ib.onclick = async function() {
        if (!await confirmAction("ATTENTION : Cette action va creer 12 nouveaux themes vides. Si des themes existent deja, ils seront ecrases. Continuer ?")) return;
        if (!await confirmAction("Derniere chance ! Confirmer l initialisation des 12 themes ?")) return;
        await initDefaultThemes();
      };
      return;
    }
   
    if (filtered.length === 0) {
      list.innerHTML = '<div class="admin-empty">Aucun resultat pour "' + escapeHTML(query) + '"</div>';
      return;
    }
    list.innerHTML = filtered.sort(function(a,b){return(a.order||99)-(b.order||99);}).map(function(t) {
      const wordCount = countWordsInTheme(t);
      const chunkCount = (t.chunks || []).length;
      return '<div class="list-item admin-list-item">' +
        '<div class="admin-item-body"><div class="title">' + escapeHTML(t.icon || "[?]") + ' ' + escapeHTML(t.name || t._id) + '</div>' +
        '<div class="meta">' + wordCount + ' mots - ' + chunkCount + ' phrases</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-edit" data-edit-theme="' + t._id + '" type="button">Gerer</button>' +
        '<button class="btn-mini btn-mini-del" data-del-theme="' + t._id + '" type="button">X</button>' +
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
    if (theme.levels) {
      ["debutant","intermediaire","avance","expert","mouallim"].forEach(function(lvl) {
        if (Array.isArray(theme.levels[lvl])) total += theme.levels[lvl].length;
      });
    }
    if (Array.isArray(theme.words)) total += theme.words.length;
    return total;
  }

  async function initDefaultThemes() {
    const defaults = [
      { id:"quotidien",  name:"Les Mots du Quotidien",   nameAr:"الحياة اليومية",   icon:"💬", description:"Les expressions essentielles", order:1 },
      { id:"creation",   name:"La Creation",             nameAr:"الخلق",            icon:"🌱", description:"Ciel, terre, mer, lumiere",    order:2 },
      { id:"foi",        name:"La Foi",                  nameAr:"الإيمان",          icon:"🕌", description:"Vocabulaire spirituel",        order:3 },
      { id:"famille",    name:"La Famille",              nameAr:"العائلة",          icon:"👨", description:"Pere, mere, frere, soeur",     order:4 },
      { id:"table",      name:"A Table",                 nameAr:"على المائدة",      icon:"🍽", description:"Nourriture, boissons",         order:5 },
      { id:"voyage",     name:"En Voyage",               nameAr:"في السفر",         icon:"✈", description:"Transports, hotels",           order:6 },
      { id:"sentiments", name:"Les Sentiments",          nameAr:"المشاعر",          icon:"🌸", description:"Joie, amour, patience",        order:7 },
      { id:"temps",      name:"Le Temps & le Ciel",      nameAr:"الزمن والسماء",    icon:"🌙", description:"Jour, nuit, saisons",          order:8 },
      { id:"couleurs",   name:"Couleurs & Formes",       nameAr:"الألوان والأشكال", icon:"🎨", description:"Voir le monde en arabe",       order:9 },
      { id:"travail",    name:"Travail & Savoir",        nameAr:"العمل والعلم",     icon:"💼", description:"Metiers, ecole",               order:10 },
      { id:"nature",     name:"La Nature",               nameAr:"الطبيعة",          icon:"🌿", description:"Animaux, plantes",             order:11 }, 
       { id:"coran",      name:"Le Coran",                nameAr:"القرآن",           icon:"📖", description:"Mots sacres",                  order:12 }
    ];
    toast("Initialisation...");
    try {
      for (const t of defaults) {
        await window.FB.setDocument("themes", t.id, Object.assign({}, t, {
          levels:{debutant:[],intermediaire:[],avance:[],expert:[],mouallim:[]},
          chunks:[], imageUrl:"",
          createdAt: Date.now()
        }));
      }

      toast("12 themes crees");
      await loadThemesList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function openThemeCreator() { showThemeForm({}); }

  async function openThemeEditor(themeId) {
    try {
      const theme = await window.FB.getDocument("themes", themeId);
      if (!theme) { toast("Theme introuvable"); return; }
      currentTheme = theme;
      showThemeForm(theme);
      const ed = document.getElementById("themeEditor");
      if (ed) ed.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function showThemeForm(theme) {
    const editor = document.getElementById("themeEditor");
    if (!editor) return;
    editor.hidden = false;
    const isNew = !theme._id;
    editor.innerHTML =
      '<div class="panel theme-editor-panel">' +
        '<div class="panel-title">' + (isNew ? "NOUVEAU THEME" : "EDITER : " + escapeHTML(theme.name || "")) + '</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="thId" placeholder="ID (ex: cuisine)" value="' + escapeHTML(theme._id || theme.id || "") + '"' + (theme._id ? " disabled" : "") + '/>' +
          '<input class="input" id="thName" placeholder="Nom francais" value="' + escapeHTML(theme.name || "") + '"/>' +
          '<input class="input" id="thNameAr" placeholder="Nom arabe" value="' + escapeHTML(theme.nameAr || "") + '" dir="rtl"/>' +
          '<input class="input" id="thIcon" placeholder="Icone (emoji)" value="' + escapeHTML(theme.icon || "📚") + '" maxlength="4"/>' +
          '<input class="input" id="thDesc" placeholder="Description" value="' + escapeHTML(theme.description || "") + '"/>' +
          '<input class="input" id="thOrder" type="number" placeholder="Ordre" value="' + (theme.order || 99) + '"/>' +
          '<input class="input" id="thImage" placeholder="URL image (prepare pour Storage)" value="' + escapeHTML(theme.imageUrl || "") + '" disabled title="Activation des images des activation de Firebase Storage"/>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="saveThBtn">' + (isNew ? "Creer" : "Enregistrer") + '</button>' +
        '<button class="btn btn-outline mt-8" id="cancelThBtn">Annuler</button>' +
      '</div>' +
      (!isNew ? renderThemeContentEditor(theme) : "");
    document.getElementById("saveThBtn").onclick = function() { saveTheme(isNew); };
    document.getElementById("cancelThBtn").onclick = function() { editor.hidden = true; };
    if (!isNew) {
      bindWordEditor(theme);
      bindChunkEditor(theme);
    }
  }

  function renderThemeContentEditor(theme) {
    return '<div class="panel mt-12">' +
        '<div class="panel-title">CONTENU - MOTS</div>' +
        '<div class="level-tabs">' +
          '<button class="filter-chip active" data-level="debutant">Debutant</button>' +
          '<button class="filter-chip" data-level="intermediaire">Inter.</button>' +
          '<button class="filter-chip" data-level="avance">Avance</button>' +
          '<button class="filter-chip" data-level="expert">Expert</button>' +
          '<button class="filter-chip" data-level="mouallim">Mouallim</button>' +
        '</div>' +
        '<div id="wordsContainer"></div>' +
        '<div class="panel sub-panel mt-12">' +
          '<div class="panel-title">+ AJOUTER UN MOT</div>' +
          '<div class="form-grid">' +
            '<input class="input" id="newWordAr" placeholder="Mot en arabe" dir="rtl"/>' +
            '<input class="input" id="newWordTr" placeholder="Translitteration"/>' +
            '<input class="input" id="newWordFr" placeholder="Traduction francaise"/>' +
            '<input class="input" id="newWordEx" placeholder="Exemple en arabe" dir="rtl"/>' +
            '<input class="input" id="newWordExFr" placeholder="Traduction de l exemple"/>' +
          '</div>' +
          '<button class="btn btn-gold mt-8" id="addWordBtn">+ Ajouter ce mot</button>' +
        '</div>' +
        '<div class="panel sub-panel mt-12">' +
          '<div class="panel-title">IMPORT EN LOT</div>' +
          '<div class="form-hint">Format: <b>arabe = francais</b> (un par ligne). Optionnel: ajouter <b>= translit</b></div>' +
          '<textarea class="textarea admin-textarea" id="bulkInput" rows="6" placeholder="بيت = Maison\nماء = Eau"></textarea>' +
          '<button class="btn btn-outline mt-8" id="bulkImportBtn">Importer ces mots</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">CONTENU - PHRASES</div>' +
        '<div id="chunksContainer"></div>' +
        '<div class="panel sub-panel mt-12">' +
          '<div class="panel-title">+ AJOUTER UNE PHRASE</div>' +
          '<div class="form-grid">' +
            '<input class="input" id="newChunkAr" placeholder="Phrase en arabe" dir="rtl"/>' +
            '<input class="input" id="newChunkTr" placeholder="Translitteration"/>' +
            '<input class="input" id="newChunkFr" placeholder="Traduction francaise"/>' +
            '<input class="input" id="newChunkUnlock" placeholder="IDs mots requis (ex: q-001,q-002)"/>' +
            '<select class="input" id="newChunkLevel">' +
              '<option value="debutant">Debutant</option>' +
              '<option value="intermediaire">Intermediaire</option>' +
              '<option value="avance">Avance</option>' +
              '<option value="expert">Expert</option>' +
              '<option value="mouallim">Mouallim</option>' +
            '</select>' +
          '</div>' +
          '<button class="btn btn-gold mt-8" id="addChunkBtn">+ Ajouter cette phrase</button>' +
        '</div>' +
      '</div>';
  }

  function bindWordEditor(theme) {
    document.querySelectorAll(".theme-editor-panel ~ .panel [data-level]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        currentLevel = btn.getAttribute("data-level");
        document.querySelectorAll("[data-level]").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        renderWordsList(theme);
      });
    });
    renderWordsList(theme);
    const addBtn = document.getElementById("addWordBtn");
    if (addBtn) addBtn.onclick = function() { addNewWord(theme); };
    const bulkBtn = document.getElementById("bulkImportBtn");
    if (bulkBtn) bulkBtn.onclick = function() { bulkImportWords(theme); };
  }

  function renderWordsList(theme) {
    const container = document.getElementById("wordsContainer");
    if (!container) return;
    const words = (theme.levels && theme.levels[currentLevel]) || [];
    if (words.length === 0) {
      container.innerHTML = '<div class="admin-empty">Aucun mot a ce niveau</div>';
      return;
    }
    container.innerHTML = words.map(function(w, i) {
      return '<div class="word-row admin-word-row">' +
        '<div class="word-body"><div class="word-ar">' + escapeHTML(w.ar || "") + '</div>' +
        (w.translit ? '<div class="word-translit">' + escapeHTML(w.translit) + '</div>' : '') +
        '<div class="word-fr">' + escapeHTML(w.fr || "") + '</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-word="' + i + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    container.querySelectorAll("[data-del-word]").forEach(function(btn) {
      btn.onclick = function() { deleteWord(theme, parseInt(btn.getAttribute("data-del-word"), 10)); };
    });
  }

  async function addNewWord(theme) {
    const ar = getVal("newWordAr"), translit = getVal("newWordTr"), fr = getVal("newWordFr");
    const example = getVal("newWordEx"), exFr = getVal("newWordExFr");
    if (!ar || !fr) { toast("Arabe et francais requis"); return; }
    if (!theme.levels) theme.levels = { debutant:[],intermediaire:[],avance:[],expert:[],mouallim:[] };
    if (!theme.levels[currentLevel]) theme.levels[currentLevel] = [];
    const prefix = (theme._id || "x").substring(0, 2);
    const newId = prefix + "-" + String(countWordsInTheme(theme) + 1).padStart(3, "0");
    theme.levels[currentLevel].push({ id:newId, ar:ar, translit:translit, fr:fr, example:example, exFr:exFr, tags:[] });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      ["newWordAr","newWordTr","newWordFr","newWordEx","newWordExFr"].forEach(function(id){ clearVal(id); });
      toast("Mot ajoute");
      renderWordsList(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function bulkImportWords(theme) {
    const text = getVal("bulkInput");
    if (!text) { toast("Collez vos mots d abord"); return; }
    const lines = text.split("\n").filter(function(l) { return l.trim() && l.indexOf("=") !== -1; });
    if (lines.length === 0) { toast("Format incorrect"); return; }
    if (!theme.levels) theme.levels = { debutant:[],intermediaire:[],avance:[],expert:[],mouallim:[] };
    if (!theme.levels[currentLevel]) theme.levels[currentLevel] = [];
    const prefix = (theme._id || "x").substring(0, 2);
    let counter = countWordsInTheme(theme);
    lines.forEach(function(line) {
      const parts = line.split("=").map(function(s) { return s.trim(); });
      if (parts.length < 2) return;
      counter++;
      theme.levels[currentLevel].push({
        id: prefix + "-" + String(counter).padStart(3, "0"),
        ar: parts[0], fr: parts[1], translit: parts[2] || "",
        example:"", exFr:"", tags:[]
      });
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      clearVal("bulkInput");
      toast(lines.length + " mots importes");
      renderWordsList(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function deleteWord(theme, index) {
    if (!await confirmAction("Supprimer ce mot ?")) return;
    theme.levels[currentLevel].splice(index, 1);
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Mot supprime");
      renderWordsList(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function bindChunkEditor(theme) {
    renderChunksList(theme);
    const addBtn = document.getElementById("addChunkBtn");
    if (addBtn) addBtn.onclick = function() { addNewChunk(theme); };
  }

  function renderChunksList(theme) {
    const container = document.getElementById("chunksContainer");
    if (!container) return;
    const chunks = theme.chunks || [];
    if (chunks.length === 0) {
      container.innerHTML = '<div class="admin-empty">Aucune phrase</div>';
      return;
    }
    container.innerHTML = chunks.map(function(c, i) {
      return '<div class="word-row admin-word-row">' +
        '<div class="word-body"><div class="word-ar">' + escapeHTML(c.ar || "") + '</div>' +
        (c.translit ? '<div class="word-translit">' + escapeHTML(c.translit) + '</div>' : '') +
        '<div class="word-fr">' + escapeHTML(c.fr || "") + '</div>' +
        '<div class="admin-meta-tiny">[' + escapeHTML(c.level || "") + '] requiert: ' + (c.unlockAfter || []).join(", ") + '</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-chunk="' + i + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    container.querySelectorAll("[data-del-chunk]").forEach(function(btn) {
      btn.onclick = function() { deleteChunk(theme, parseInt(btn.getAttribute("data-del-chunk"), 10)); };
    });
  }

  async function addNewChunk(theme) {
    const ar = getVal("newChunkAr"), tr = getVal("newChunkTr"), fr = getVal("newChunkFr");
    const unlockStr = getVal("newChunkUnlock");
    const level = document.getElementById("newChunkLevel").value;
    if (!ar || !fr) { toast("Arabe et francais requis"); return; }
    if (!theme.chunks) theme.chunks = [];
    const prefix = (theme._id || "x").substring(0, 2);
    const newId = "chunk-" + prefix + "-" + String(theme.chunks.length + 1).padStart(3, "0");
    theme.chunks.push({
      id:newId, ar:ar, translit:tr, fr:fr,
      unlockAfter: unlockStr.split(",").map(function(s){return s.trim();}).filter(Boolean),
      level: level
    });
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      ["newChunkAr","newChunkTr","newChunkFr","newChunkUnlock"].forEach(function(id){ clearVal(id); });
      toast("Phrase ajoutee");
      renderChunksList(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function deleteChunk(theme, index) {
    if (!await confirmAction("Supprimer cette phrase ?")) return;
    theme.chunks.splice(index, 1);
    try {
      await window.FB.setDocument("themes", theme._id, theme);
      toast("Phrase supprimee");
      renderChunksList(theme);
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function saveTheme(isNew) {
    const id = getVal("thId"), name = getVal("thName"), nameAr = getVal("thNameAr");
    const icon = getVal("thIcon") || "📚", desc = getVal("thDesc");
    const order = parseInt(getVal("thOrder"), 10) || 99;
    if (!id || !name) { toast("ID et nom requis"); return; }
    const data = { id:id, name:name, nameAr:nameAr, icon:icon, description:desc, order:order, imageUrl:"" };
    if (isNew) {
      data.levels = {debutant:[],intermediaire:[],avance:[],expert:[],mouallim:[]};
      data.chunks = []; data.createdAt = Date.now();
    }
    try {
      await window.FB.setDocument("themes", id, data);
      toast("Theme enregistre");
      document.getElementById("themeEditor").hidden = true;
      await loadThemesList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function deleteTheme(themeId) {
    if (!await confirmAction("Supprimer ce theme et tout son contenu ?")) return;
    try {
      await window.FB.deleteDocument("themes", themeId);
      toast("Theme supprime");
      await loadThemesList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============ ONGLET 2 : LETTRES ============
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
    if (letters.length === 0) {
      list.innerHTML = '<div class="admin-empty">Aucune lettre. Cliquez Initialiser.</div>';
      return;
    }
    list.innerHTML = letters.sort(function(a,b){return(a.order||0)-(b.order||0);}).map(function(l) {
      return '<div class="word-row admin-word-row"><div class="word-body">' +
        '<div class="word-ar">' + escapeHTML(l.ar||"") + '</div>' +
        '<div class="word-fr">' + escapeHTML(l.name||"") + ' - ' + escapeHTML(l.sound||"") + '</div></div></div>';
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
      {id:"dad",ar:"ض",name:"Dad",sound:"d",order:15},{id:"ta2",ar:"ط",name:"Ta2",sound:"t",order:16},
      {id:"za",ar:"ظ",name:"Za",sound:"z",order:17},{id:"ayn",ar:"ع",name:"Ayn",sound:"a",order:18},
      {id:"ghayn",ar:"غ",name:"Ghayn",sound:"gh",order:19},{id:"fa",ar:"ف",name:"Fa",sound:"f",order:20},
      {id:"qaf",ar:"ق",name:"Qaf",sound:"q",order:21},{id:"kaf",ar:"ك",name:"Kaf",sound:"k",order:22},
      {id:"lam",ar:"ل",name:"Lam",sound:"l",order:23},{id:"mim",ar:"م",name:"Mim",sound:"m",order:24},
      {id:"nun",ar:"ن",name:"Nun",sound:"n",order:25},{id:"ha2",ar:"ه",name:"Ha2",sound:"h",order:26},
      {id:"waw",ar:"و",name:"Waw",sound:"w",order:27},{id:"ya",ar:"ي",name:"Ya",sound:"y",order:28}
    ];
    toast("Init lettres...");
    try {
      for (const l of letters) await window.FB.setDocument("letters", l.id, l);
      toast("28 lettres creees");
      await loadLettersList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============ ONGLET 3 : DEFINITIONS ETYMOLOGIQUES ============
  async function renderDefinitionsTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">DEFINITIONS ETYMOLOGIQUES</div>' +
        '<p class="admin-hint">Tirees de Mufradat al-Faz al-Quran (al-Isfahani) et Maqayis al-Lugha (Ibn Faris).</p>' +
        '<input class="input admin-search" type="search" id="defsSearch" placeholder="Rechercher..."/>' +
        '<div class="admin-count" id="defsCount">0 definitions</div>' +
        '<div id="defsList" class="admin-list">Chargement...</div>' +
      '</div>' +
      '<div class="panel mt-12 sub-panel">' +
        '<div class="panel-title">+ NOUVELLE DEFINITION</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="defAr" placeholder="Mot en arabe (ex: كتاب)" dir="rtl"/>' +
          '<input class="input" id="defRoot" placeholder="Racine (ex: ك-ت-ب)" dir="rtl"/>' +
          '<input class="input" id="defTranslit" placeholder="Translitteration (ex: KITAB)"/>' +
          '<input class="input" id="defFr" placeholder="Traduction francaise"/>' +
          '<input class="input" id="defKeywords" placeholder="Mots-cles (separes par virgule)"/>' +
          '<input class="input" id="defShort" placeholder="Definition courte"/>' +
          '<textarea class="textarea admin-textarea" id="defLong" placeholder="Definition longue (developpement)"></textarea>' +
          '<input class="input" id="defSources" placeholder="Sources (ex: Mufradat p.247)"/>' +
          '<input class="input" id="defExample" placeholder="Exemple coranique (optionnel)" dir="rtl"/>' +
          '<input class="input" id="defExampleFr" placeholder="Traduction de l exemple"/>' +
          '<select class="input" id="defRarity">' +
            '<option value="commune">Commune</option>' +
            '<option value="rare">Rare</option>' +
            '<option value="epique">Epique</option>' +
            '<option value="legendaire">Legendaire</option>' +
          '</select>' +
          '<input class="input" id="defImage" placeholder="URL image (prepare pour Storage)" disabled/>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="addDefBtn">+ Ajouter cette definition</button>' +
      '</div>';
    document.getElementById("addDefBtn").onclick = addDefinition;
    const sb = document.getElementById("defsSearch");
    sb.value = searchQueries.defs || "";
    sb.addEventListener("input", function() { searchQueries.defs = sb.value; loadDefsList(); });
    await loadDefsList();
  }

  async function loadDefsList() {
    let defs;
    try { defs = await window.FB.getCollection("definitions") || []; }
    catch (e) { document.getElementById("defsList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const list = document.getElementById("defsList");
    const count = document.getElementById("defsCount");
    const query = (searchQueries.defs || "").toLowerCase();
    const filtered = defs.filter(function(d) {
      if (!query) return true;
      return (d.ar||"").toLowerCase().indexOf(query) !== -1 ||
             (d.fr||"").toLowerCase().indexOf(query) !== -1 ||
             (d.root||"").toLowerCase().indexOf(query) !== -1;
    });
    if (count) count.textContent = filtered.length + " definition" + (filtered.length>1?"s":"");
    if (!list) return;
    if (filtered.length === 0) {
      list.innerHTML = '<div class="admin-empty">' + (query ? "Aucun resultat" : "Aucune definition encore") + '</div>';
      return;
    }
    list.innerHTML = filtered.map(function(d) {
      return '<div class="word-row admin-word-row">' +
        '<div class="word-body"><div class="word-ar">' + escapeHTML(d.ar||"") + '</div>' +
        (d.root ? '<div class="word-translit">racine: ' + escapeHTML(d.root) + '</div>' : '') +
        '<div class="word-fr">' + escapeHTML(d.fr||"") + '</div>' +
        '<div class="admin-meta-tiny">[' + escapeHTML(d.rarity||"commune") + ']</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-def="' + d._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-del-def]").forEach(function(btn) {
      btn.onclick = async function() {
        if (!await confirmAction("Supprimer cette definition ?")) return;
        try { await window.FB.deleteDocument("definitions", btn.getAttribute("data-del-def"));
          toast("Supprime"); loadDefsList();
        } catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addDefinition() {
    const data = {
      ar: getVal("defAr"), root: getVal("defRoot"), translit: getVal("defTranslit"),
      fr: getVal("defFr"),
      keywords: getVal("defKeywords").split(",").map(function(s){return s.trim();}).filter(Boolean),
      shortDef: getVal("defShort"), longDef: getVal("defLong"),
      sources: getVal("defSources"),
      example: getVal("defExample"), exampleFr: getVal("defExampleFr"),
      rarity: document.getElementById("defRarity").value,
      imageUrl: "", createdAt: Date.now()
    };
    if (!data.ar || !data.fr) { toast("Arabe et francais requis"); return; }
    try {
      await window.FB.addDocument("definitions", data);
      ["defAr","defRoot","defTranslit","defFr","defKeywords","defShort","defLong","defSources","defExample","defExampleFr"].forEach(function(id){ clearVal(id); });
      toast("Definition ajoutee");
      loadDefsList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============ ONGLET 4 : NOTIONS (texte libre) ============
  async function renderNotionsTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">NOTIONS ETYMOLOGIQUES</div>' +
        '<p class="admin-hint">Resumes courts (2-4 mots-cles) pour memoriser facilement une racine.</p>' +
        '<input class="input admin-search" type="search" id="notionsSearch" placeholder="Rechercher..."/>' +
        '<div class="admin-count" id="notionsCount">0 notions</div>' +
        '<div id="notionsList" class="admin-list">Chargement...</div>' +
      '</div>' +
      '<div class="panel mt-12 sub-panel">' +
        '<div class="panel-title">+ NOUVELLE NOTION</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="notionRoot" placeholder="Racine (ex: ك-ت-ب)" dir="rtl"/>' +
          '<input class="input" id="notionKeywords" placeholder="Mots-cles (ex: ecrire, livre, decret)"/>' +
          '<textarea class="textarea admin-textarea" id="notionText" placeholder="Notion (texte libre, explication courte)"></textarea>' +
          '<input class="input" id="notionImage" placeholder="URL image (prepare pour Storage)" disabled/>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="addNotionBtn">+ Ajouter cette notion</button>' +
      '</div>';
    document.getElementById("addNotionBtn").onclick = addNotion;
    const sb = document.getElementById("notionsSearch");
    sb.value = searchQueries.notions || "";
    sb.addEventListener("input", function() { searchQueries.notions = sb.value; loadNotionsList(); });
    await loadNotionsList();
  }

  async function loadNotionsList() {
    let notions;
    try { notions = await window.FB.getCollection("notions") || []; }
    catch (e) { document.getElementById("notionsList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const list = document.getElementById("notionsList");
    const count = document.getElementById("notionsCount");
    const query = (searchQueries.notions || "").toLowerCase();
    const filtered = notions.filter(function(n) {
      if (!query) return true;
      return (n.root||"").toLowerCase().indexOf(query) !== -1 ||
             (n.keywords||"").toLowerCase().indexOf(query) !== -1 ||
             (n.text||"").toLowerCase().indexOf(query) !== -1;
    });
    if (count) count.textContent = filtered.length + " notion" + (filtered.length>1?"s":"");
    if (!list) return;
    if (filtered.length === 0) {
      list.innerHTML = '<div class="admin-empty">' + (query ? "Aucun resultat" : "Aucune notion encore") + '</div>';
      return;
    }
    list.innerHTML = filtered.map(function(n) {
      return '<div class="word-row admin-word-row">' +
        '<div class="word-body"><div class="word-ar">' + escapeHTML(n.root||"") + '</div>' +
        '<div class="word-translit">' + escapeHTML(n.keywords||"") + '</div>' +
        '<div class="word-fr">' + escapeHTML((n.text||"").substring(0,80)) + (n.text && n.text.length>80?"...":"") + '</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-notion="' + n._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-del-notion]").forEach(function(btn) {
      btn.onclick = async function() {
        if (!await confirmAction("Supprimer cette notion ?")) return;
        try { await window.FB.deleteDocument("notions", btn.getAttribute("data-del-notion"));
          toast("Supprime"); loadNotionsList();
        } catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addNotion() {
    const data = {
      root: getVal("notionRoot"),
      keywords: getVal("notionKeywords"),
      text: getVal("notionText"),
      imageUrl: "", createdAt: Date.now()
    };
    if (!data.root || !data.text) { toast("Racine et texte requis"); return; }
    try {
      await window.FB.addDocument("notions", data);
      ["notionRoot","notionKeywords","notionText"].forEach(function(id){ clearVal(id); });
      toast("Notion ajoutee");
      loadNotionsList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============ ONGLET 5 : DEBLOCABLES ============
  async function renderUnlocksTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">CONTENUS DEBLOCABLES</div>' +
        '<p class="admin-hint">Contenus que l utilisateur debloque en regardant des pubs.</p>' +
        '<input class="input admin-search" type="search" id="unlocksSearch" placeholder="Rechercher..."/>' +
        '<div class="admin-count" id="unlocksCount">0 deblocables</div>' +
        '<div id="unlocksList" class="admin-list">Chargement...</div>' +
      '</div>' +
      '<div class="panel mt-12 sub-panel">' +
        '<div class="panel-title">+ NOUVEAU DEBLOCABLE</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="unlockName" placeholder="Nom (ex: Boost XP x2)"/>' +
          '<select class="input" id="unlockType">' +
            '<option value="boost_xp">Boost XP</option>' +
            '<option value="definition">Definition</option>' +
            '<option value="notion">Notion</option>' +
            '<option value="rare_word">Mot rare</option>' +
          '</select>' +
          '<select class="input" id="unlockCost">' +
            '<option value="1">1 pub</option>' +
            '<option value="2">2 pubs</option>' +
            '<option value="3">3 pubs</option>' +
          '</select>' +
          '<input class="input" id="unlockReward" placeholder="Recompense (ex: x2 XP pendant 1h)"/>' +
          '<input class="input" id="unlockCategory" placeholder="Categorie (ex: boost, etymo)"/>' +
          '<textarea class="textarea admin-textarea" id="unlockDesc" placeholder="Description"></textarea>' +
          '<input class="input" id="unlockImage" placeholder="URL image (prepare pour Storage)" disabled/>' +
          '<label class="toggle-row"><input type="checkbox" id="unlockActive" checked/><span>Actif</span></label>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="addUnlockBtn">+ Ajouter</button>' +
      '</div>';
    document.getElementById("addUnlockBtn").onclick = addUnlock;
    const sb = document.getElementById("unlocksSearch");
    sb.value = searchQueries.unlocks || "";
    sb.addEventListener("input", function() { searchQueries.unlocks = sb.value; loadUnlocksList(); });
    await loadUnlocksList();
  }

  async function loadUnlocksList() {
    let unlocks;
    try { unlocks = await window.FB.getCollection("unlocks") || []; }
    catch (e) { document.getElementById("unlocksList").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const list = document.getElementById("unlocksList");
    const count = document.getElementById("unlocksCount");
    const query = (searchQueries.unlocks || "").toLowerCase();
    const filtered = unlocks.filter(function(u) {
      if (!query) return true;
      return (u.name||"").toLowerCase().indexOf(query) !== -1 ||
             (u.type||"").toLowerCase().indexOf(query) !== -1;
    });
    if (count) count.textContent = filtered.length + " deblocable" + (filtered.length>1?"s":"");
    if (!list) return;
    if (filtered.length === 0) {
      list.innerHTML = '<div class="admin-empty">' + (query ? "Aucun resultat" : "Aucun deblocable encore") + '</div>';
      return;
    }
    list.innerHTML = filtered.map(function(u) {
      return '<div class="list-item admin-list-item">' +
        '<div class="admin-item-body"><div class="title">' + escapeHTML(u.name||"") + '</div>' +
        '<div class="meta">' + escapeHTML(u.type||"") + ' - ' + (u.cost||1) + ' pub(s) - ' + (u.active!==false?"actif":"inactif") + '</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-unlock="' + u._id + '" type="button">X</button>' +
        '</div></div>';
    }).join("");
    list.querySelectorAll("[data-del-unlock]").forEach(function(btn) {
      btn.onclick = async function() {
        if (!await confirmAction("Supprimer ?")) return;
        try { await window.FB.deleteDocument("unlocks", btn.getAttribute("data-del-unlock"));
          toast("Supprime"); loadUnlocksList();
        } catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addUnlock() {
    const data = {
      name: getVal("unlockName"),
      type: document.getElementById("unlockType").value,
      cost: parseInt(document.getElementById("unlockCost").value, 10),
      reward: getVal("unlockReward"),
      category: getVal("unlockCategory"),
      description: getVal("unlockDesc"),
      imageUrl: "",
      active: document.getElementById("unlockActive").checked,
      createdAt: Date.now()
    };
    if (!data.name) { toast("Nom requis"); return; }
    try {
      await window.FB.addDocument("unlocks", data);
      ["unlockName","unlockReward","unlockCategory","unlockDesc"].forEach(function(id){ clearVal(id); });
      toast("Deblocable ajoute");
      loadUnlocksList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  // ============ ONGLET 6 : CONTENUS (Badges + Wotd + Listes) ============
  function renderContenusTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">CONTENUS DIVERS</div>' +
        '<div class="sub-tabs">' +
          '<button class="filter-chip active" data-subtab="wotd">Mot du jour</button>' +
          '<button class="filter-chip" data-subtab="lists">Listes officielles</button>' +
          '<button class="filter-chip" data-subtab="badges">Badges</button>' +
        '</div>' +
        '<div id="contenusSubContent"></div>' +
      '</div>';
    container.querySelectorAll(".sub-tabs .filter-chip").forEach(function(btn) {
      btn.addEventListener("click", function() {
        container.querySelectorAll(".sub-tabs .filter-chip").forEach(function(b){b.classList.remove("active");});
        btn.classList.add("active");
        const sub = btn.getAttribute("data-subtab");
        const sc = document.getElementById("contenusSubContent");
        if (sub === "wotd") renderWotdSubTab(sc);
        else if (sub === "lists") renderListsSubTab(sc);
        else if (sub === "badges") renderBadgesSubTab(sc);
      });
    });
    renderWotdSubTab(document.getElementById("contenusSubContent"));
  }

  async function renderWotdSubTab(container) {
    container.innerHTML =
      '<div id="wotdList" class="admin-list">Chargement...</div>' +
      '<div class="panel sub-panel mt-12">' +
        '<div class="panel-title">+ AJOUTER UN MOT DU JOUR</div>' +
        '<div class="form-grid">' +
          '<input class="input" id="wotdAr" placeholder="Mot arabe" dir="rtl"/>' +
          '<input class="input" id="wotdTr" placeholder="Translitteration"/>' +
          '<input class="input" id="wotdFr" placeholder="Traduction"/>' +
          '<input class="input" id="wotdDef" placeholder="Definition courte"/>' +
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
        '<button class="btn-mini btn-mini-del" data-del-wotd="' + w._id + '">X</button>' +
        '</div></div>';
    }).join("");
    c.querySelectorAll("[data-del-wotd]").forEach(function(btn) {
      btn.onclick = async function() {
        if (!await confirmAction("Supprimer ?")) return;
        try { await window.FB.deleteDocument("wotd", btn.getAttribute("data-del-wotd"));
          toast("Supprime"); loadWotdList();
        } catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function addWotd() {
    const data = {
      ar: getVal("wotdAr"), translit: getVal("wotdTr"), fr: getVal("wotdFr"),
      def: getVal("wotdDef"), exAr: getVal("wotdExAr"), exFr: getVal("wotdExFr"),
      createdAt: Date.now()
    };
    if (!data.ar || !data.fr) { toast("Arabe et francais requis"); return; }
    try {
      await window.FB.addDocument("wotd", data);
      ["wotdAr","wotdTr","wotdFr","wotdDef","wotdExAr","wotdExFr"].forEach(function(id){ clearVal(id); });
      toast("Mot du jour ajoute");
      loadWotdList();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function renderListsSubTab(container) {
    container.innerHTML =
      '<div id="officialListsContainer" class="admin-list">Chargement...</div>' +
      '<div class="panel sub-panel mt-12">' +
        '<div class="panel-title">+ NOUVELLE LISTE OFFICIELLE</div>' +
        '<input class="input" id="newOfficialListName" placeholder="Nom (ex: Top 100 Coran)"/>' +
        '<input class="input mt-8" id="newOfficialListDesc" placeholder="Description"/>' +
        '<button class="btn btn-gold mt-12" id="createOfficialListBtn">Creer</button>' +
      '</div>';
    document.getElementById("createOfficialListBtn").onclick = createOfficialList;
    await loadOfficialLists();
  }

  async function loadOfficialLists() {
    let lists;
    try { lists = await window.FB.getCollection("officialLists") || []; }
    catch (e) { document.getElementById("officialListsContainer").innerHTML = '<div class="admin-error">Erreur: ' + e.message + '</div>'; return; }
    const c = document.getElementById("officialListsContainer");
    if (!c) return;
    if (lists.length === 0) { c.innerHTML = '<div class="admin-empty">Aucune liste</div>'; return; }
    c.innerHTML = lists.map(function(l) {
      return '<div class="list-item admin-list-item">' +
        '<div class="admin-item-body"><div class="title">' + escapeHTML(l.name||"") + '</div>' +
        '<div class="meta">' + (l.words||[]).length + ' mots</div></div>' +
        '<div class="admin-item-actions">' +
        '<button class="btn-mini btn-mini-del" data-del-list="' + l._id + '">X</button>' +
        '</div></div>';
    }).join("");
    c.querySelectorAll("[data-del-list]").forEach(function(btn) {
      btn.onclick = async function() {
        if (!await confirmAction("Supprimer ?")) return;
        try { await window.FB.deleteDocument("officialLists", btn.getAttribute("data-del-list"));
          toast("Supprime"); loadOfficialLists();
        } catch (e) { toast("Erreur: " + e.message); }
      };
    });
  }

  async function createOfficialList() {
    const name = getVal("newOfficialListName"), desc = getVal("newOfficialListDesc");
    if (!name) { toast("Nom requis"); return; }
    try {
      await window.FB.addDocument("officialLists", {
        name:name, description:desc, words:[], featured:false, createdAt:Date.now()
      });
      clearVal("newOfficialListName"); clearVal("newOfficialListDesc");
      toast("Liste creee");
      loadOfficialLists();
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function renderBadgesSubTab(container) {
    container.innerHTML =
      '<div class="admin-empty">Les 30 badges sont definis dans xp.js. Edition des metadonnees a venir.</div>';
  }

  // ============ ONGLET 7 : USERS ============
  async function renderUsersTab(container) {
    container.innerHTML = '<div class="admin-loading">Chargement users...</div>';
    let users;
    try { users = await window.FB.getCollection("users") || []; }
    catch (e) { container.innerHTML = '<div class="panel"><div class="admin-error">Erreur: ' + e.message + '</div></div>'; return; }
    const total = users.length;
    const premium = users.filter(function(u) { return u.isPremium; }).length;
    const totalXP = users.reduce(function(s, u) { return s + (u.xp || 0); }, 0);
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">STATISTIQUES USERS</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + total + '</b><span>Inscrits</span></div>' +
          '<div class="stat"><b>' + premium + '</b><span>Premium</span></div>' +
          '<div class="stat"><b>' + totalXP + '</b><span>XP total</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">TOP 10 UTILISATEURS</div>' +
        (users.sort(function(a,b){return(b.xp||0)-(a.xp||0);}).slice(0,10).map(function(u, i) {
          return '<div class="list-item admin-list-item"><div class="admin-item-body">' +
            '<div class="title">#' + (i+1) + ' ' + escapeHTML(u.pseudo||"Anonyme") + '</div>' +
            '<div class="meta">XP: ' + (u.xp||0) + ' - Niveau ' + (u.level||1) + (u.isPremium?" - premium":"") + '</div></div></div>';
        }).join("") || '<div class="admin-empty">Aucun utilisateur</div>') +
      '</div>';
  }

  // ============ ONGLET 8 : STATS ============
  async function renderStatsTab(container) {
    container.innerHTML = '<div class="admin-loading">Calcul des stats...</div>';
    let themes, defs, notions, unlocks, wotd, lists, users;
    try {
      themes = await window.FB.getCollection("themes") || [];
      defs = await window.FB.getCollection("definitions") || [];
      notions = await window.FB.getCollection("notions") || [];
      unlocks = await window.FB.getCollection("unlocks") || [];
      wotd = await window.FB.getCollection("wotd") || [];
      lists = await window.FB.getCollection("officialLists") || [];
      users = await window.FB.getCollection("users") || [];
    } catch (e) { container.innerHTML = '<div class="panel"><div class="admin-error">Erreur: ' + e.message + '</div></div>'; return; }
    let totalWords = 0;
    themes.forEach(function(t) { totalWords += countWordsInTheme(t); });
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">VUE D ENSEMBLE</div>' +
        '<div class="stats-grid">' +
          '<div class="stat"><b>' + themes.length + '</b><span>Themes</span></div>' +
          '<div class="stat"><b>' + totalWords + '</b><span>Mots</span></div>' +
          '<div class="stat"><b>' + defs.length + '</b><span>Definitions</span></div>' +
          '<div class="stat"><b>' + notions.length + '</b><span>Notions</span></div>' +
          '<div class="stat"><b>' + unlocks.length + '</b><span>Deblocables</span></div>' +
          '<div class="stat"><b>' + wotd.length + '</b><span>Mots du jour</span></div>' +
          '<div class="stat"><b>' + lists.length + '</b><span>Listes off.</span></div>' +
          '<div class="stat"><b>' + users.length + '</b><span>Utilisateurs</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">REPARTITION PAR THEME</div>' +
        (themes.sort(function(a,b){return countWordsInTheme(b)-countWordsInTheme(a);}).slice(0,10).map(function(t) {
          return '<div class="list-item admin-list-item"><div class="admin-item-body">' +
            '<div class="title">' + escapeHTML(t.icon||"[?]") + ' ' + escapeHTML(t.name||"") + '</div>' +
            '<div class="meta">' + countWordsInTheme(t) + ' mots</div></div></div>';
        }).join("") || '<div class="admin-empty">Aucun theme</div>') +
      '</div>';
  }

  // ============ ONGLET 9 : REGLAGES ============
  async function renderConfigTab(container) {
    let cfg = {};
    try { cfg = await window.FB.getDocument("config", "global") || {}; }
    catch (e) {}
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">REGLAGES GLOBAUX</div>' +
        '<div class="form-grid">' +
          '<label class="admin-label">Prix Premium (EUR)<input class="input" id="cfgPrice" type="number" step="0.01" value="' + (cfg.premiumPrice || 7.99) + '"/></label>' +
          '<label class="admin-label">Limite chat IA / jour<input class="input" id="cfgChat" type="number" value="' + (cfg.chatDailyLimit || 10) + '"/></label>' +
          '<label class="admin-label">XP par bonne reponse QCM<input class="input" id="cfgQcm" type="number" value="' + (cfg.xpQcm || 10) + '"/></label>' +
          '<label class="admin-label">Multiplicateur XP Premium<input class="input" id="cfgMult" type="number" step="0.5" value="' + (cfg.premiumMultiplier || 2) + '"/></label>' +
          '<label class="admin-label">Message accueil (Home)<input class="input" id="cfgWelcome" placeholder="ex: Bienvenue" value="' + escapeHTML(cfg.welcomeMessage||"") + '"/></label>' +
          '<label class="admin-label">Texte methode (longue page)<textarea class="textarea admin-textarea" id="cfgMethode" placeholder="Texte affiche dans A propos de notre methode">' + escapeHTML(cfg.methodeText||"") + '</textarea></label>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="saveCfgBtn">Enregistrer</button>' +
      '</div>';
    document.getElementById("saveCfgBtn").onclick = async function() {
      try {
        await window.FB.setDocument("config", "global", {
          premiumPrice: parseFloat(getVal("cfgPrice")),
          chatDailyLimit: parseInt(getVal("cfgChat"), 10),
          xpQcm: parseInt(getVal("cfgQcm"), 10),
          premiumMultiplier: parseFloat(getVal("cfgMult")),
          welcomeMessage: getVal("cfgWelcome"),
          methodeText: getVal("cfgMethode")
        });
        toast("Reglages sauvegardes");
      } catch (e) { toast("Erreur: " + e.message); }
    };
  }

  // ============ ONGLET 10 : OUTILS ============
  function renderToolsTab(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">EXPORTS</div>' +
        '<button class="btn btn-outline mt-8" id="exportAllBtn">Exporter toute la base (JSON)</button>' +
        '<button class="btn btn-outline mt-8" id="exportDefsBtn">Exporter les definitions</button>' +
        '<button class="btn btn-outline mt-8" id="exportNotionsBtn">Exporter les notions</button>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">ACTIONS</div>' +
        '<button class="btn btn-outline mt-8" id="reloadBtn">Recharger l app</button>' +
        '<button class="btn btn-outline mt-8" id="announceBtn">Envoyer une annonce</button>' +
      '</div>';
    document.getElementById("exportAllBtn").onclick = exportAll;
    document.getElementById("exportDefsBtn").onclick = function() { exportCollection("definitions"); };
    document.getElementById("exportNotionsBtn").onclick = function() { exportCollection("notions"); };
    document.getElementById("reloadBtn").onclick = function() { location.reload(); };
    document.getElementById("announceBtn").onclick = async function() {
      const msg = prompt("Message a envoyer aux utilisateurs :");
      if (!msg) return;
      try {
        await window.FB.addDocument("announcements", { message:msg, createdAt:Date.now() });
        toast("Annonce envoyee");
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
      toast("Export telecharge");
    } catch (e) { toast("Erreur: " + e.message); }
  }

  async function exportCollection(name) {
    try {
      const items = await window.FB.getCollection(name) || [];
      downloadJSON(items, name + "-" + new Date().toISOString().slice(0,10) + ".json");
      toast(items.length + " items exportes");
    } catch (e) { toast("Erreur: " + e.message); }
  }

  function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  // ============ UTILS ============
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
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
        window.Main.confirm("Confirmation", msg, function() { resolve(true); });
        setTimeout(function() { resolve(false); }, 30000);
      } else {
        resolve(confirm(msg));
      }
    });
  }

  return { show: show };
})();

window.AdminScreen = AdminScreen;
