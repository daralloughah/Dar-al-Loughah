/* =========================================================
   DAR AL LOUGHAH — ADMIN CONSOLE
   Console complète d'administration du contenu
   ========================================================= */

const AdminScreen = (function() {

  let currentTab = "themes";
  let currentTheme = null;
  let currentLevel = "debutant";

  /* =========================================================
     ENTRÉE PRINCIPALE
     ========================================================= */
   /* =========================================================
     ENTRÉE PRINCIPALE
     ========================================================= */

   async function show() {
    // Vérifier si l'utilisateur est admin (Firebase OU local via Auth)
    let isAdmin = false;

    // Check 1 : Firebase
    if (window.FB && window.FB.isCurrentUserAdmin && window.FB.isCurrentUserAdmin()) {
      isAdmin = true;
    }

    // Check 2 : Auth local (basé sur l'email + ADMIN_EMAILS)
    if (!isAdmin && window.Auth && window.Auth.getUser) {
      const user = window.Auth.getUser();
      if (user && user.email) {
        const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
        const adminsLower = admins.map(function(e) { return e.toLowerCase(); });
        if (adminsLower.indexOf(user.email.toLowerCase()) !== -1) {
          isAdmin = true;
        }
      }
    }

    // Si pas admin → refus
    if (!isAdmin) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Accès admin réservé");
      }
      if (window.Main) window.Main.goto("home");
      return;
    }

    // Sinon → afficher la console
    renderAdminUI();
    showTab("themes");
  }


  /* =========================================================
     UI PRINCIPALE
     ========================================================= */
  function renderAdminUI() {
    const container = document.getElementById("adminContent");
    if (!container) return;

    container.innerHTML = `
      <div class="admin-tabs" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;">
        <button class="filter-chip active" data-tab="themes">📚 Thèmes</button>
        <button class="filter-chip" data-tab="letters">🔤 Lettres</button>
        <button class="filter-chip" data-tab="badges">🏆 Badges</button>
        <button class="filter-chip" data-tab="wotd">📅 Mot du jour</button>
        <button class="filter-chip" data-tab="lists">📋 Listes officielles</button>
        <button class="filter-chip" data-tab="users">👥 Utilisateurs</button>
        <button class="filter-chip" data-tab="config">⚙️ Réglages</button>
        <button class="filter-chip" data-tab="tools">🛠️ Outils</button>
      </div>
      <div id="adminTabContent"></div>
    `;

    container.querySelectorAll(".admin-tabs .filter-chip").forEach(function(btn) {
      btn.addEventListener("click", function() {
        showTab(btn.getAttribute("data-tab"));
      });
    });
  }

  function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll(".admin-tabs .filter-chip").forEach(function(b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === tab);
    });

    const content = document.getElementById("adminTabContent");
    if (!content) return;

    switch (tab) {
      case "themes":  renderThemesTab(content); break;
      case "letters": renderLettersTab(content); break;
      case "badges":  renderBadgesTab(content); break;
      case "wotd":    renderWotdTab(content); break;
      case "lists":   renderListsTab(content); break;
      case "users":   renderUsersTab(content); break;
      case "config":  renderConfigTab(content); break;
      case "tools":   renderToolsTab(content); break;
    }
  }

  /* =========================================================
     ONGLET 1 : THÈMES
     ========================================================= */
  async function renderThemesTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">GESTION DES THÈMES</div>
        <div id="themesList" style="margin:10px 0;">Chargement...</div>
        <button class="btn btn-gold" id="addThemeBtn">+ Nouveau thème</button>
      </div>
      <div id="themeEditor" hidden></div>
    `;

    document.getElementById("addThemeBtn").onclick = openThemeCreator;
    await loadThemesList();
  }

  async function loadThemesList() {
    const list = document.getElementById("themesList");
    if (!list) return;

    const themes = await window.FB.getCollection("themes") || [];

    if (themes.length === 0) {
      list.innerHTML = `
        <div style="padding:14px; text-align:center; color:var(--ink-muted); font-style:italic;">
          Aucun thème en base.<br>
          <button class="btn btn-outline mt-8" id="initThemesBtn">⚡ Initialiser les 12 thèmes par défaut</button>
        </div>
      `;
      const initBtn = document.getElementById("initThemesBtn");
      if (initBtn) initBtn.onclick = initDefaultThemes;
      return;
    }

    list.innerHTML = themes.map(function(t) {
      const wordCount = countWordsInTheme(t);
      const chunkCount = (t.chunks || []).length;
      return `
        <div class="list-item">
          <div style="flex:1; min-width:0;">
            <div class="title">${escapeHTML(t.icon || "📚")} ${escapeHTML(t.name || t._id)}</div>
            <div class="meta">${wordCount} mots · ${chunkCount} phrases</div>
          </div>
          <div class="actions">
            <button data-edit-theme="${t._id}" type="button">Gérer</button>
            <button class="del" data-del-theme="${t._id}" type="button">✕</button>
          </div>
        </div>
      `;
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
      { id: "quotidien",  name: "Les Mots du Quotidien",   nameAr: "الحياة اليومية",   icon: "💬", description: "Les expressions essentielles", order: 1 },
      { id: "creation",   name: "La Création",              nameAr: "الخلق",            icon: "🌱", description: "Ciel, terre, mer, lumière", order: 2 },
      { id: "foi",        name: "La Foi",                   nameAr: "الإيمان",          icon: "🕌", description: "Vocabulaire spirituel", order: 3 },
      { id: "famille",    name: "La Famille",               nameAr: "العائلة",          icon: "👨‍👩‍👧", description: "Père, mère, frère, sœur", order: 4 },
      { id: "table",      name: "À Table",                  nameAr: "على المائدة",      icon: "🍽️", description: "Nourriture, boissons", order: 5 },
      { id: "voyage",     name: "En Voyage",                nameAr: "في السفر",         icon: "✈️", description: "Transports, hôtels", order: 6 },
      { id: "sentiments", name: "Les Sentiments",           nameAr: "المشاعر",          icon: "🌸", description: "Joie, amour, patience", order: 7 },
      { id: "temps",      name: "Le Temps & le Ciel",       nameAr: "الزمن والسماء",    icon: "🌙", description: "Jour, nuit, saisons", order: 8 },
      { id: "couleurs",   name: "Couleurs & Formes",        nameAr: "الألوان والأشكال", icon: "🎨", description: "Voir le monde en arabe", order: 9 },
      { id: "travail",    name: "Travail & Savoir",         nameAr: "العمل والعلم",     icon: "💼", description: "Métiers, école", order: 10 },
      { id: "nature",     name: "La Nature",                nameAr: "الطبيعة",          icon: "🌿", description: "Animaux, plantes", order: 11 },
      { id: "coran",      name: "Le Coran",                 nameAr: "القرآن",           icon: "📖", description: "Mots sacrés", order: 12, special: true }
    ];

    toast("Initialisation en cours...");
    for (const t of defaults) {
      await window.FB.setDocument("themes", t.id, {
        ...t,
        levels: { debutant: [], intermediaire: [], avance: [], expert: [], mouallim: [] },
        chunks: [],
        words: t.special ? [] : null,
        createdAt: Date.now()
      });
    }
    toast("✅ 12 thèmes créés !");
    await loadThemesList();
  }

  function openThemeCreator() {
    showThemeForm({});
  }

  async function openThemeEditor(themeId) {
    const theme = await window.FB.getDocument("themes", themeId);
    if (!theme) {
      toast("Thème introuvable");
      return;
    }
    currentTheme = theme;
    showThemeForm(theme);
  }

  function showThemeForm(theme) {
    const editor = document.getElementById("themeEditor");
    if (!editor) return;
    editor.hidden = false;

    const isNew = !theme._id;

    editor.innerHTML = `
      <div class="panel" style="border-color:var(--gold-light);">
        <div class="panel-title">${isNew ? "NOUVEAU THÈME" : "ÉDITER : " + escapeHTML(theme.name || "")}</div>
        <div style="display:flex; flex-direction:column; gap:8px; margin:10px 0;">
          <input id="thId" placeholder="ID (ex: cuisine)" value="${escapeHTML(theme._id || theme.id || "")}" ${theme._id ? "disabled" : ""}/>
          <input id="thName" placeholder="Nom français" value="${escapeHTML(theme.name || "")}"/>
          <input id="thNameAr" placeholder="Nom arabe" value="${escapeHTML(theme.nameAr || "")}" dir="rtl"/>
          <input id="thIcon" placeholder="Icône (emoji)" value="${escapeHTML(theme.icon || "📚")}" maxlength="4"/>
          <input id="thDesc" placeholder="Description" value="${escapeHTML(theme.description || "")}"/>
          <input id="thOrder" type="number" placeholder="Ordre" value="${theme.order || 99}"/>
        </div>
        <button class="btn btn-gold" id="saveThBtn">${isNew ? "Créer" : "Enregistrer"}</button>
        <button class="btn btn-outline mt-8" id="cancelThBtn">Annuler</button>
      </div>
      ${!isNew ? renderThemeContentEditor(theme) : ""}
    `;

    document.getElementById("saveThBtn").onclick = function() { saveTheme(isNew); };
    document.getElementById("cancelThBtn").onclick = function() { editor.hidden = true; };

    if (!isNew) {
      bindWordEditor(theme);
      bindChunkEditor(theme);
    }
  }

  function renderThemeContentEditor(theme) {
    return `
      <div class="panel mt-12">
        <div class="panel-title">CONTENU — MOTS</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin:8px 0;">
          <button class="filter-chip active" data-level="debutant">Débutant</button>
          <button class="filter-chip" data-level="intermediaire">Intermédiaire</button>
          <button class="filter-chip" data-level="avance">Avancé</button>
          <button class="filter-chip" data-level="expert">Expert</button>
          <button class="filter-chip" data-level="mouallim">Mouallim</button>
        </div>
        <div id="wordsContainer"></div>
        <div class="panel mt-12" style="border-color:rgba(212,175,55,0.4);">
          <div class="panel-title">+ AJOUTER UN MOT</div>
          <div style="display:flex; flex-direction:column; gap:6px; margin:8px 0;">
            <input id="newWordAr" placeholder="Mot en arabe (ex: بَيْت)" dir="rtl"/>
            <input id="newWordTr" placeholder="Translittération (ex: BAYT)"/>
            <input id="newWordFr" placeholder="Traduction française"/>
            <input id="newWordEx" placeholder="Exemple en arabe (optionnel)" dir="rtl"/>
            <input id="newWordExFr" placeholder="Traduction de l'exemple (optionnel)"/>
          </div>
          <button class="btn btn-gold" id="addWordBtn">+ Ajouter ce mot</button>
        </div>
        <div class="panel mt-12">
          <div class="panel-title">📥 IMPORT EN LOT</div>
          <div style="font-size:12px; color:var(--ink-muted); margin:6px 0;">
            Format: <b>arabe = français</b> (un par ligne).<br>
            Optionnel : ajouter <b>= translit</b> à la fin
          </div>
          <textarea id="bulkInput" rows="6" style="width:100%; padding:8px; background:var(--ink-card); color:var(--ink); border:1px solid var(--line); border-radius:8px; font-size:14px;" placeholder="بيت = Maison
ماء = Eau
شمس = Soleil"></textarea>
          <button class="btn btn-outline mt-8" id="bulkImportBtn">Importer ces mots</button>
        </div>
      </div>
      <div class="panel mt-12">
        <div class="panel-title">CONTENU — PHRASES (CHUNKS)</div>
        <div id="chunksContainer"></div>
        <div class="panel mt-12" style="border-color:rgba(212,175,55,0.4);">
          <div class="panel-title">+ AJOUTER UNE PHRASE</div>
          <div style="display:flex; flex-direction:column; gap:6px; margin:8px 0;">
            <input id="newChunkAr" placeholder="Phrase en arabe" dir="rtl"/>
            <input id="newChunkTr" placeholder="Translittération"/>
            <input id="newChunkFr" placeholder="Traduction française"/>
            <input id="newChunkUnlock" placeholder="IDs des mots requis (ex: q-001,q-002,q-003)"/>
            <select id="newChunkLevel" style="padding:8px; background:var(--ink-card); color:var(--ink); border:1px solid var(--line); border-radius:8px;">
              <option value="debutant">Débutant</option>
              <option value="intermediaire">Intermédiaire</option>
              <option value="avance">Avancé</option>
              <option value="expert">Expert</option>
              <option value="mouallim">Mouallim</option>
            </select>
          </div>
          <button class="btn btn-gold" id="addChunkBtn">+ Ajouter cette phrase</button>
        </div>
      </div>
    `;
  }

  function bindWordEditor(theme) {
    document.querySelectorAll("[data-level]").forEach(function(btn) {
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
      container.innerHTML = '<div style="padding:14px; text-align:center; color:var(--ink-muted); font-style:italic;">Aucun mot à ce niveau</div>';
      return;
    }

    container.innerHTML = words.map(function(w, i) {
      return `
        <div class="word-row">
          <div class="word-body">
            <div class="word-ar">${escapeHTML(w.ar || "")}</div>
            ${w.translit ? '<div class="word-translit">' + escapeHTML(w.translit) + '</div>' : ''}
            <div class="word-fr">${escapeHTML(w.fr || "")}</div>
          </div>
          <div class="actions">
            <button class="del" data-del-word="${i}" type="button">✕</button>
          </div>
        </div>
      `;
    }).join("");

    container.querySelectorAll("[data-del-word]").forEach(function(btn) {
      btn.onclick = function() { deleteWord(theme, parseInt(btn.getAttribute("data-del-word"), 10)); };
    });
  }

  async function addNewWord(theme) {
    const ar = document.getElementById("newWordAr").value.trim();
    const translit = document.getElementById("newWordTr").value.trim();
    const fr = document.getElementById("newWordFr").value.trim();
    const example = document.getElementById("newWordEx").value.trim();
    const exFr = document.getElementById("newWordExFr").value.trim();

    if (!ar || !fr) {
      toast("Arabe et français requis");
      return;
    }

    if (!theme.levels) theme.levels = { debutant:[], intermediaire:[], avance:[], expert:[], mouallim:[] };
    if (!theme.levels[currentLevel]) theme.levels[currentLevel] = [];

    const prefix = (theme._id || "x").substring(0, 2);
    const totalWords = countWordsInTheme(theme);
    const newId = prefix + "-" + String(totalWords + 1).padStart(3, "0");

    theme.levels[currentLevel].push({
      id: newId,
      ar: ar,
      translit: translit,
      fr: fr,
      example: example,
      exFr: exFr,
      tags: []
    });

    await window.FB.setDocument("themes", theme._id, theme);

    document.getElementById("newWordAr").value = "";
    document.getElementById("newWordTr").value = "";
    document.getElementById("newWordFr").value = "";
    document.getElementById("newWordEx").value = "";
    document.getElementById("newWordExFr").value = "";

    toast("✅ Mot ajouté");
    renderWordsList(theme);
  }

  async function bulkImportWords(theme) {
    const text = document.getElementById("bulkInput").value;
    if (!text.trim()) {
      toast("Collez vos mots d'abord");
      return;
    }

    const lines = text.split("\n").filter(function(l) { return l.trim() && l.includes("="); });
    if (lines.length === 0) {
      toast("Format incorrect");
      return;
    }

    if (!theme.levels) theme.levels = { debutant:[], intermediaire:[], avance:[], expert:[], mouallim:[] };
    if (!theme.levels[currentLevel]) theme.levels[currentLevel] = [];

    const prefix = (theme._id || "x").substring(0, 2);
    let counter = countWordsInTheme(theme);

    lines.forEach(function(line) {
      const parts = line.split("=").map(function(s) { return s.trim(); });
      if (parts.length < 2) return;
      counter++;
      theme.levels[currentLevel].push({
        id: prefix + "-" + String(counter).padStart(3, "0"),
        ar: parts[0],
        fr: parts[1],
        translit: parts[2] || "",
        example: "",
        exFr: "",
        tags: []
      });
    });

    await window.FB.setDocument("themes", theme._id, theme);
    document.getElementById("bulkInput").value = "";
    toast("✅ " + lines.length + " mots importés");
    renderWordsList(theme);
  }

  async function deleteWord(theme, index) {
    if (!confirm("Supprimer ce mot ?")) return;
    theme.levels[currentLevel].splice(index, 1);
    await window.FB.setDocument("themes", theme._id, theme);
    toast("Mot supprimé");
    renderWordsList(theme);
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
      container.innerHTML = '<div style="padding:14px; text-align:center; color:var(--ink-muted); font-style:italic;">Aucune phrase</div>';
      return;
    }
    container.innerHTML = chunks.map(function(c, i) {
      return `
        <div class="word-row">
          <div class="word-body">
            <div class="word-ar">${escapeHTML(c.ar || "")}</div>
            ${c.translit ? '<div class="word-translit">' + escapeHTML(c.translit) + '</div>' : ''}
            <div class="word-fr">${escapeHTML(c.fr || "")}</div>
            <div style="font-size:11px; color:var(--ink-muted);">[${escapeHTML(c.level || "")}] requiert: ${(c.unlockAfter || []).join(", ")}</div>
          </div>
          <div class="actions">
            <button class="del" data-del-chunk="${i}" type="button">✕</button>
          </div>
        </div>
      `;
    }).join("");
    container.querySelectorAll("[data-del-chunk]").forEach(function(btn) {
      btn.onclick = function() { deleteChunk(theme, parseInt(btn.getAttribute("data-del-chunk"), 10)); };
    });
  }

  async function addNewChunk(theme) {
    const ar = document.getElementById("newChunkAr").value.trim();
    const tr = document.getElementById("newChunkTr").value.trim();
    const fr = document.getElementById("newChunkFr").value.trim();
    const unlockStr = document.getElementById("newChunkUnlock").value.trim();
    const level = document.getElementById("newChunkLevel").value;

    if (!ar || !fr) { toast("Arabe et français requis"); return; }

    if (!theme.chunks) theme.chunks = [];
    const prefix = (theme._id || "x").substring(0, 2);
    const newId = "chunk-" + prefix + "-" + String(theme.chunks.length + 1).padStart(3, "0");

    theme.chunks.push({
      id: newId,
      ar: ar,
      translit: tr,
      fr: fr,
      unlockAfter: unlockStr.split(",").map(function(s) { return s.trim(); }).filter(Boolean),
      level: level
    });

    await window.FB.setDocument("themes", theme._id, theme);
    document.getElementById("newChunkAr").value = "";
    document.getElementById("newChunkTr").value = "";
    document.getElementById("newChunkFr").value = "";
    document.getElementById("newChunkUnlock").value = "";
    toast("✅ Phrase ajoutée");
    renderChunksList(theme);
  }

  async function deleteChunk(theme, index) {
    if (!confirm("Supprimer cette phrase ?")) return;
    theme.chunks.splice(index, 1);
    await window.FB.setDocument("themes", theme._id, theme);
    toast("Phrase supprimée");
    renderChunksList(theme);
  }

  async function saveTheme(isNew) {
    const id = document.getElementById("thId").value.trim();
    const name = document.getElementById("thName").value.trim();
    const nameAr = document.getElementById("thNameAr").value.trim();
    const icon = document.getElementById("thIcon").value.trim() || "📚";
    const desc = document.getElementById("thDesc").value.trim();
    const order = parseInt(document.getElementById("thOrder").value, 10) || 99;

    if (!id || !name) { toast("ID et nom requis"); return; }

    const data = { id: id, name: name, nameAr: nameAr, icon: icon, description: desc, order: order };
    if (isNew) {
      data.levels = { debutant:[], intermediaire:[], avance:[], expert:[], mouallim:[] };
      data.chunks = [];
      data.createdAt = Date.now();
    }

    await window.FB.setDocument("themes", id, data);
    toast("✅ Thème enregistré");
    document.getElementById("themeEditor").hidden = true;
    await loadThemesList();
  }

  async function deleteTheme(themeId) {
    if (!confirm("Supprimer ce thème et tout son contenu ?")) return;
    await window.FB.deleteDocument("themes", themeId);
    toast("Thème supprimé");
    await loadThemesList();
  }

  /* =========================================================
     ONGLET 2 : LETTRES
     ========================================================= */
  async function renderLettersTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">GESTION DES LETTRES</div>
        <div id="lettersList">Chargement...</div>
        <button class="btn btn-outline mt-8" id="initLettersBtn">⚡ Initialiser les 28 lettres par défaut</button>
      </div>
    `;
    document.getElementById("initLettersBtn").onclick = initDefaultLetters;
    await loadLettersList();
  }

  async function loadLettersList() {
    const letters = await window.FB.getCollection("letters") || [];
    const list = document.getElementById("lettersList");
    if (!list) return;
    if (letters.length === 0) {
      list.innerHTML = '<div style="padding:10px; color:var(--ink-muted); font-style:italic;">Aucune lettre. Cliquez "Initialiser" pour créer les 28 lettres.</div>';
      return;
    }
    list.innerHTML = letters.sort(function(a,b) { return (a.order||0)-(b.order||0); }).map(function(l) {
      return `<div class="word-row"><div class="word-body"><div class="word-ar">${escapeHTML(l.ar||"")}</div><div class="word-fr">${escapeHTML(l.name||"")} — ${escapeHTML(l.sound||"")}</div></div></div>`;
    }).join("");
  }

  async function initDefaultLetters() {
    const letters = [
      {id:"alif",ar:"ا",name:"Alif",sound:"a",order:1},{id:"ba",ar:"ب",name:"Bā'",sound:"b",order:2},
      {id:"ta",ar:"ت",name:"Tā'",sound:"t",order:3},{id:"tha",ar:"ث",name:"Thā'",sound:"th",order:4},
      {id:"jim",ar:"ج",name:"Jīm",sound:"j",order:5},{id:"ha",ar:"ح",name:"Ḥā'",sound:"ḥ",order:6},
      {id:"kha",ar:"خ",name:"Khā'",sound:"kh",order:7},{id:"dal",ar:"د",name:"Dāl",sound:"d",order:8},
      {id:"dhal",ar:"ذ",name:"Dhāl",sound:"dh",order:9},{id:"ra",ar:"ر",name:"Rā'",sound:"r",order:10},
      {id:"zay",ar:"ز",name:"Zāy",sound:"z",order:11},{id:"sin",ar:"س",name:"Sīn",sound:"s",order:12},
      {id:"shin",ar:"ش",name:"Shīn",sound:"sh",order:13},{id:"sad",ar:"ص",name:"Ṣād",sound:"ṣ",order:14},
      {id:"dad",ar:"ض",name:"Ḍād",sound:"ḍ",order:15},{id:"ta2",ar:"ط",name:"Ṭā'",sound:"ṭ",order:16},
      {id:"za",ar:"ظ",name:"Ẓā'",sound:"ẓ",order:17},{id:"ayn",ar:"ع",name:"ʿAyn",sound:"ʿ",order:18},
      {id:"ghayn",ar:"غ",name:"Ghayn",sound:"gh",order:19},{id:"fa",ar:"ف",name:"Fā'",sound:"f",order:20},
      {id:"qaf",ar:"ق",name:"Qāf",sound:"q",order:21},{id:"kaf",ar:"ك",name:"Kāf",sound:"k",order:22},
      {id:"lam",ar:"ل",name:"Lām",sound:"l",order:23},{id:"mim",ar:"م",name:"Mīm",sound:"m",order:24},
      {id:"nun",ar:"ن",name:"Nūn",sound:"n",order:25},{id:"ha2",ar:"ه",name:"Hā'",sound:"h",order:26},
      {id:"waw",ar:"و",name:"Wāw",sound:"w",order:27},{id:"ya",ar:"ي",name:"Yā'",sound:"y",order:28}
    ];
    toast("Init lettres...");
    for (const l of letters) await window.FB.setDocument("letters", l.id, l);
    toast("✅ 28 lettres créées");
    await loadLettersList();
  }

  /* =========================================================
     ONGLET 3 : BADGES
     ========================================================= */
  function renderBadgesTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">BADGES</div>
        <div style="padding:14px; color:var(--ink-muted); font-style:italic;">
          Les 30 badges sont définis dans le code (xp.js). Modification à venir dans une prochaine version.
        </div>
      </div>
    `;
  }

  /* =========================================================
     ONGLET 4 : MOT DU JOUR
     ========================================================= */
  async function renderWotdTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">MOTS DU JOUR PROGRAMMÉS</div>
        <div id="wotdList">Chargement...</div>
        <div class="panel mt-12" style="border-color:rgba(212,175,55,0.4);">
          <div class="panel-title">+ AJOUTER UN MOT DU JOUR</div>
          <div style="display:flex; flex-direction:column; gap:6px; margin:8px 0;">
            <input id="wotdAr" placeholder="Mot en arabe" dir="rtl"/>
            <input id="wotdTr" placeholder="Translittération"/>
            <input id="wotdFr" placeholder="Traduction"/>
            <input id="wotdDef" placeholder="Définition courte"/>
            <input id="wotdExAr" placeholder="Exemple en arabe" dir="rtl"/>
            <input id="wotdExFr" placeholder="Traduction de l'exemple"/>
          </div>
          <button class="btn btn-gold" id="addWotdBtn">+ Ajouter à la rotation</button>
        </div>
      </div>
    `;
    document.getElementById("addWotdBtn").onclick = addWotd;
    await loadWotdList();
  }

  async function loadWotdList() {
    const list = await window.FB.getCollection("wotd") || [];
    const container = document.getElementById("wotdList");
    if (!container) return;
    if (list.length === 0) {
      container.innerHTML = '<div style="padding:10px; color:var(--ink-muted); font-style:italic;">Aucun mot du jour</div>';
      return;
    }
    container.innerHTML = list.map(function(w) {
      return `<div class="word-row"><div class="word-body"><div class="word-ar">${escapeHTML(w.ar||"")}</div><div class="word-fr">${escapeHTML(w.fr||"")}</div></div><div class="actions"><button class="del" data-del-wotd="${w._id}">✕</button></div></div>`;
    }).join("");
    container.querySelectorAll("[data-del-wotd]").forEach(function(btn) {
      btn.onclick = async function() {
        if (!confirm("Supprimer ?")) return;
        await window.FB.deleteDocument("wotd", btn.getAttribute("data-del-wotd"));
        toast("Supprimé");
        loadWotdList();
      };
    });
  }

  async function addWotd() {
    const data = {
      ar: document.getElementById("wotdAr").value.trim(),
      translit: document.getElementById("wotdTr").value.trim(),
      fr: document.getElementById("wotdFr").value.trim(),
      def: document.getElementById("wotdDef").value.trim(),
      exAr: document.getElementById("wotdExAr").value.trim(),
      exFr: document.getElementById("wotdExFr").value.trim(),
      createdAt: Date.now()
    };
    if (!data.ar || !data.fr) { toast("Arabe et français requis"); return; }
    await window.FB.addDocument("wotd", data);
    ["wotdAr","wotdTr","wotdFr","wotdDef","wotdExAr","wotdExFr"].forEach(function(id) {
      document.getElementById(id).value = "";
    });
    toast("✅ Mot du jour ajouté");
    loadWotdList();
  }

  /* =========================================================
     ONGLET 5 : LISTES OFFICIELLES
     ========================================================= */
  async function renderListsTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">LISTES OFFICIELLES</div>
        <div id="officialListsContainer">Chargement...</div>
        <div class="panel mt-12" style="border-color:rgba(212,175,55,0.4);">
          <div class="panel-title">+ NOUVELLE LISTE OFFICIELLE</div>
          <input id="newListName" placeholder="Nom de la liste (ex: Top 100 Coran)" style="width:100%; margin:6px 0;"/>
          <input id="newListDesc" placeholder="Description courte" style="width:100%; margin:6px 0;"/>
          <button class="btn btn-gold" id="createOfficialListBtn">Créer</button>
        </div>
      </div>
    `;
    document.getElementById("createOfficialListBtn").onclick = createOfficialList;
    loadOfficialLists();
  }

  async function loadOfficialLists() {
    const lists = await window.FB.getCollection("officialLists") || [];
    const c = document.getElementById("officialListsContainer");
    if (!c) return;
    if (lists.length === 0) {
      c.innerHTML = '<div style="padding:10px; color:var(--ink-muted); font-style:italic;">Aucune liste officielle</div>';
      return;
    }
    c.innerHTML = lists.map(function(l) {
      return `<div class="list-item"><div style="flex:1;"><div class="title">${escapeHTML(l.name||"")}</div><div class="meta">${(l.words||[]).length} mots</div></div><div class="actions"><button class="del" data-del-list="${l._id}">✕</button></div></div>`;
    }).join("");
    c.querySelectorAll("[data-del-list]").forEach(function(btn) {
      btn.onclick = async function() {
        if (!confirm("Supprimer ?")) return;
        await window.FB.deleteDocument("officialLists", btn.getAttribute("data-del-list"));
        toast("Supprimé");
        loadOfficialLists();
      };
    });
  }

  async function createOfficialList() {
    const name = document.getElementById("newListName").value.trim();
    const desc = document.getElementById("newListDesc").value.trim();
    if (!name) { toast("Nom requis"); return; }
    await window.FB.addDocument("officialLists", {
      name: name, description: desc, words: [], featured: false, createdAt: Date.now()
    });
    document.getElementById("newListName").value = "";
    document.getElementById("newListDesc").value = "";
    toast("✅ Liste créée");
    loadOfficialLists();
  }

  /* =========================================================
     ONGLET 6 : UTILISATEURS
     ========================================================= */
  async function renderUsersTab(container) {
    const users = await window.FB.getCollection("users") || [];
    const total = users.length;
    const premium = users.filter(function(u) { return u.isPremium; }).length;
    const totalXP = users.reduce(function(s, u) { return s + (u.xp || 0); }, 0);

    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">STATISTIQUES UTILISATEURS</div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin:10px 0;">
          <div class="stat"><b>${total}</b><span>Inscrits</span></div>
          <div class="stat"><b>${premium}</b><span>Premium</span></div>
          <div class="stat"><b>${totalXP}</b><span>XP total</span></div>
        </div>
      </div>
      <div class="panel mt-12">
        <div class="panel-title">TOP UTILISATEURS</div>
        ${users.sort(function(a,b) { return (b.xp||0)-(a.xp||0); }).slice(0,10).map(function(u, i) {
          return `<div class="list-item"><div style="flex:1;"><div class="title">#${i+1} ${escapeHTML(u.pseudo||"Anonyme")}</div><div class="meta">XP: ${u.xp||0} · Niveau ${u.level||1}${u.isPremium?" · ✦":""}</div></div></div>`;
        }).join("") || '<div style="padding:10px; color:var(--ink-muted);">Aucun utilisateur</div>'}
      </div>
    `;
  }

  /* =========================================================
     ONGLET 7 : RÉGLAGES
     ========================================================= */
  async function renderConfigTab(container) {
    const cfg = await window.FB.getDocument("config", "global") || {};
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">RÉGLAGES GLOBAUX</div>
        <div style="display:flex; flex-direction:column; gap:8px; margin:10px 0;">
          <label>Prix Premium (€) <input id="cfgPrice" type="number" step="0.01" value="${cfg.premiumPrice || 7.99}"/></label>
          <label>Limite chat IA / jour <input id="cfgChat" type="number" value="${cfg.chatDailyLimit || 10}"/></label>
          <label>XP par bonne réponse QCM <input id="cfgQcm" type="number" value="${cfg.xpQcm || 10}"/></label>
          <label>Multiplicateur XP Premium <input id="cfgMult" type="number" step="0.5" value="${cfg.premiumMultiplier || 2}"/></label>
          <label>Message d'accueil (Home) <input id="cfgWelcome" placeholder="ex: Bienvenue dans la maison de la langue" value="${escapeHTML(cfg.welcomeMessage||"")}"/></label>
        </div>
        <button class="btn btn-gold" id="saveCfgBtn">Enregistrer</button>
      </div>
    `;
    document.getElementById("saveCfgBtn").onclick = async function() {
      await window.FB.setDocument("config", "global", {
        premiumPrice: parseFloat(document.getElementById("cfgPrice").value),
        chatDailyLimit: parseInt(document.getElementById("cfgChat").value, 10),
        xpQcm: parseInt(document.getElementById("cfgQcm").value, 10),
        premiumMultiplier: parseFloat(document.getElementById("cfgMult").value),
        welcomeMessage: document.getElementById("cfgWelcome").value.trim()
      });
      toast("✅ Réglages sauvegardés");
    };
  }

  /* =========================================================
     ONGLET 8 : OUTILS
     ========================================================= */
  function renderToolsTab(container) {
    container.innerHTML = `
      <div class="panel">
        <div class="panel-title">OUTILS</div>
        <button class="btn btn-outline" id="exportBtn" style="width:100%; margin:6px 0;">📤 Exporter toute la base (JSON)</button>
        <button class="btn btn-outline" id="reloadBtn" style="width:100%; margin:6px 0;">🔄 Recharger l'app</button>
        <button class="btn btn-outline" id="announceBtn" style="width:100%; margin:6px 0;">📢 Envoyer une annonce</button>
      </div>
    `;
    document.getElementById("exportBtn").onclick = exportAll;
    document.getElementById("reloadBtn").onclick = function() { location.reload(); };
    document.getElementById("announceBtn").onclick = function() {
      const msg = prompt("Message à envoyer aux utilisateurs :");
      if (msg) {
        window.FB.addDocument("announcements", { message: msg, createdAt: Date.now() });
        toast("✅ Annonce envoyée");
      }
    };
  }

  async function exportAll() {
    toast("Export en cours...");
    const themes = await window.FB.getCollection("themes") || [];
    const letters = await window.FB.getCollection("letters") || [];
    const wotd = await window.FB.getCollection("wotd") || [];
    const lists = await window.FB.getCollection("officialLists") || [];
    const cfg = await window.FB.getDocument("config", "global") || {};

    const data = { themes, letters, wotd, officialLists: lists, config: cfg, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dar-al-loughah-backup-" + new Date().toISOString().slice(0,10) + ".json";
    a.click();
    URL.revokeObjectURL(url);
    toast("✅ Export téléchargé");
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
    });
  }

  function toast(msg) {
    if (window.Main && window.Main.toast) window.Main.toast(msg);
    else console.log(msg);
  }

  return { show: show };
})();

window.AdminScreen = AdminScreen;
console.log("✓ AdminScreen chargé");
