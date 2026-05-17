/* =========================================================
   DAR AL LOUGHAH — LEADERBOARD v2 (Supabase + Par thème)
   Onglets : General / Hebdo / Mensuel / Streak / Par thème / Groupes
   ========================================================= */

const LeaderboardScreen = (function() {

  let currentTab = "general";
  let allUsers = [];
  let allGroups = [];
  let allThemes = [];
  let userGroupsMap = {};
  let selectedThemeId = null;
  let themeProgressCache = []; // pour l'onglet "Par thème"

  /* ============ ENTRÉE PRINCIPALE ============ */
  async function show() {
    renderUI();
    await loadData();
    renderTab(currentTab);
  }

  function renderUI() {
    const container = document.getElementById("leaderboardContent");
    if (!container) return;
    container.innerHTML =
      '<div class="lb-tabs-wrap"><div class="lb-tabs">' +
        '<button class="filter-chip active" data-lbtab="general">Général</button>' +
        '<button class="filter-chip" data-lbtab="weekly">Hebdo</button>' +
        '<button class="filter-chip" data-lbtab="monthly">Mensuel</button>' +
        '<button class="filter-chip" data-lbtab="streak">Streak</button>' +
        '<button class="filter-chip" data-lbtab="theme">Par thème</button>' +
        '<button class="filter-chip" data-lbtab="groups">Groupes</button>' +
      '</div></div>' +
      '<div id="lbTabContent" class="lb-content"><div class="lb-loading">Chargement...</div></div>';

    container.querySelectorAll(".lb-tabs .filter-chip").forEach(function(btn) {
      btn.addEventListener("click", function() {
        const tab = btn.getAttribute("data-lbtab");
        currentTab = tab;
        container.querySelectorAll(".lb-tabs .filter-chip").forEach(function(b) {
          b.classList.toggle("active", b === btn);
        });
        renderTab(tab);
      });
    });
  }

  /* ============ CHARGEMENT DES DONNÉES ============ */
  async function loadData() {
    try {
      const client = window.FB && window.FB.getClient ? window.FB.getClient() : null;
      if (!client) {
        allUsers = []; allGroups = []; allThemes = [];
        return;
      }

      // Users (profiles)
      const { data: users, error: e1 } = await client
        .from("profiles")
        .select("id,pseudo,xp,level,streak,xp_this_week,xp_this_month")
        .limit(500);
      allUsers = (users || []).map(function(u) {
        return {
          _id: u.id,
          pseudo: u.pseudo,
          xp: u.xp || 0,
          level: u.level || 1,
          streak: u.streak || 0,
          xpThisWeek: u.xp_this_week || 0,
          xpThisMonth: u.xp_this_month || 0
        };
      });

      // Groups
      const { data: groups } = await client.from("groups").select("*");
      allGroups = (groups || []).map(function(g) {
        return Object.assign({}, g, { _id: g.id });
      });

      // Themes (pour le dropdown)
      const { data: themes } = await client
        .from("themes")
        .select("id,name_fr,name_ar")
        .order("name_fr", { ascending: true });
      allThemes = themes || [];
    } catch (e) {
      console.warn("Erreur load leaderboard:", e);
      allUsers = []; allGroups = []; allThemes = [];
    }

    userGroupsMap = {};
    allGroups.forEach(function(g) {
      const members = g.members || [];
      members.forEach(function(uid) {
        if (!userGroupsMap[uid]) userGroupsMap[uid] = [];
        userGroupsMap[uid].push(g);
      });
    });
  }

  /* ============ ROUTAGE ============ */
  function renderTab(tab) {
    const c = document.getElementById("lbTabContent");
    if (!c) return;
    switch (tab) {
      case "general": renderGeneral(c); break;
      case "weekly":  renderWeekly(c); break;
      case "monthly": renderMonthly(c); break;
      case "streak":  renderStreak(c); break;
      case "theme":   renderThemeTab(c); break;
      case "groups":  renderGroups(c); break;
    }
  }

  /* ============ ONGLETS XP ============ */
  function renderGeneral(c) {
    const sorted = allUsers.slice().sort(function(a, b) { return (b.xp || 0) - (a.xp || 0); });
    renderUserList(c, sorted, function(u) { return formatNumber(u.xp || 0) + " XP"; }, "general");
  }
  function renderWeekly(c) {
    const sorted = allUsers.slice().sort(function(a, b) { return (b.xpThisWeek || 0) - (a.xpThisWeek || 0); });
    const subtitle = window.PeriodReset ? "Semaine " + window.PeriodReset.getCurrentWeekKey() : "Cette semaine";
    renderUserList(c, sorted, function(u) { return formatNumber(u.xpThisWeek || 0) + " XP"; }, "weekly", subtitle);
  }
  function renderMonthly(c) {
    const sorted = allUsers.slice().sort(function(a, b) { return (b.xpThisMonth || 0) - (a.xpThisMonth || 0); });
    const subtitle = window.PeriodReset ? "Mois " + window.PeriodReset.getCurrentMonthKey() : "Ce mois";
    renderUserList(c, sorted, function(u) { return formatNumber(u.xpThisMonth || 0) + " XP"; }, "monthly", subtitle);
  }
  function renderStreak(c) {
    const sorted = allUsers.slice().sort(function(a, b) { return (b.streak || 0) - (a.streak || 0); });
    renderUserList(c, sorted, function(u) {
      const s = u.streak || 0;
      return s + (s > 1 ? " jours" : " jour");
    }, "streak", "Jours consécutifs de participation");
  }

  /* ============ ONGLET PAR THÈME ============ */
  async function renderThemeTab(container) {
    if (allThemes.length === 0) {
      container.innerHTML = '<div class="lb-empty">Aucun thème disponible.</div>';
      return;
    }

    // Pré-sélection : query string ?theme=xxx ou premier thème
    if (!selectedThemeId) {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTheme = urlParams.get("theme");
      selectedThemeId = urlTheme || allThemes[0].id;
    }

    // Construire le dropdown
    let html = '<div class="lb-theme-selector">';
    html += '<label class="lb-theme-label">Thème :</label>';
    html += '<select id="lbThemeSelect" class="lb-theme-select">';
    allThemes.forEach(function(t) {
      const sel = t.id === selectedThemeId ? " selected" : "";
      html += '<option value="' + escapeHTML(t.id) + '"' + sel + '>' + escapeHTML(t.name_fr || t.id) + '</option>';
    });
    html += '</select></div>';
    html += '<div id="lbThemeList" class="lb-theme-list"><div class="lb-loading">Chargement...</div></div>';

    container.innerHTML = html;

    const select = container.querySelector("#lbThemeSelect");
    select.addEventListener("change", function() {
      selectedThemeId = select.value;
      loadAndRenderTheme();
    });

    await loadAndRenderTheme();
  }

  async function loadAndRenderTheme() {
    const listEl = document.getElementById("lbThemeList");
    if (!listEl) return;
    listEl.innerHTML = '<div class="lb-loading">Chargement du classement...</div>';

    try {
      const client = window.FB && window.FB.getClient ? window.FB.getClient() : null;
      if (!client) {
        listEl.innerHTML = '<div class="lb-empty">Cloud indisponible.</div>';
        return;
      }

      const { data: progress, error } = await client
        .from("theme_progress")
        .select("user_id,xp,words_learned,quizzes_done")
        .eq("theme_id", selectedThemeId)
        .order("xp", { ascending: false })
        .limit(50);

      if (error) {
        listEl.innerHTML = '<div class="lb-empty">Erreur : ' + escapeHTML(error.message) + '</div>';
        return;
      }

      themeProgressCache = progress || [];

      if (themeProgressCache.length === 0) {
        listEl.innerHTML = '<div class="lb-empty">Personne n a encore commencé ce thème.<br>Sois le premier !</div>';
        return;
      }

      // Joindre avec les pseudos
      const rows = themeProgressCache.map(function(p) {
        const u = allUsers.find(function(x) { return x._id === p.user_id; });
        return {
          _id: p.user_id,
          pseudo: u ? u.pseudo : "Anonyme",
          level: u ? u.level : 1,
          xp: p.xp || 0,
          wordsLearned: p.words_learned || 0,
          quizzesDone: p.quizzes_done || 0
        };
      });

      const currentUserId = getCurrentUserId();
      const top10 = rows.slice(0, 10);
      let html = '<div class="lb-subtitle">Classement du thème</div>';
      html += '<div class="lb-list">';
      top10.forEach(function(r, i) {
        const isMine = r._id === currentUserId;
        const valueLabel = formatNumber(r.xp) + ' XP · ' + r.wordsLearned + ' mots';
        html += renderRow(r, i + 1, valueLabel, isMine);
      });
      html += '</div>';

      const myIdx = rows.findIndex(function(r) { return r._id === currentUserId; });
      if (myIdx >= 10) {
        const r = rows[myIdx];
        html += '<div class="lb-my-position-label">Ma position :</div>';
        html += '<div class="lb-list">' + renderRow(r, myIdx + 1, formatNumber(r.xp) + ' XP · ' + r.wordsLearned + ' mots', true) + '</div>';
      } else if (myIdx === -1) {
        html += '<div class="lb-my-position-label">Tu n as pas encore commencé ce thème.</div>';
      }

      listEl.innerHTML = html;

      listEl.querySelectorAll("[data-user-id]").forEach(function(row) {
        row.addEventListener("click", function() {
          openUserModal(row.getAttribute("data-user-id"));
        });
      });
    } catch (e) {
      console.warn("loadAndRenderTheme exception:", e);
      listEl.innerHTML = '<div class="lb-empty">Erreur de chargement.</div>';
    }
  }

  /* ============ ONGLET GROUPES ============ */
  function renderGroups(container) {
    const groupsWithXP = allGroups.map(function(g) {
      const members = g.members || [];
      let totalXP = 0;
      members.forEach(function(uid) {
        const u = allUsers.find(function(x) { return x._id === uid; });
        if (u) totalXP += (u.xp || 0);
      });
      return Object.assign({}, g, { totalXP: totalXP });
    });

    groupsWithXP.sort(function(a, b) { return (b.totalXP || 0) - (a.totalXP || 0); });

    if (groupsWithXP.length === 0) {
      container.innerHTML = '<div class="lb-empty">Aucun groupe pour l instant.<br>Créez le premier !</div>';
      return;
    }

    const currentUserId = getCurrentUserId();
    const myGroup = groupsWithXP.find(function(g) {
      return (g.members || []).indexOf(currentUserId) !== -1;
    });

    let html = '<div class="lb-subtitle">Classement par total XP du groupe</div>';
    const top10 = groupsWithXP.slice(0, 10);
    html += '<div class="lb-list">';
    top10.forEach(function(g, i) {
      html += renderGroupRow(g, i + 1, g._id === (myGroup && myGroup._id));
    });
    html += '</div>';

    if (myGroup) {
      const myRank = groupsWithXP.findIndex(function(g) { return g._id === myGroup._id; }) + 1;
      if (myRank > 10) {
        html += '<div class="lb-my-position-label">Mon groupe :</div>';
        html += '<div class="lb-list">' + renderGroupRow(myGroup, myRank, true) + '</div>';
      }
    }

    container.innerHTML = html;
  }

  function renderGroupRow(g, rank, isMine) {
    const medal = getMedalForRank(rank);
    const memberCount = (g.members || []).length;
    const cls = "lb-row lb-group-row" + (isMine ? " lb-row-mine" : "");
    return '<div class="' + cls + '">' +
      '<div class="lb-rank">' + medal + '</div>' +
      '<div class="lb-body">' +
        '<div class="lb-pseudo">' + escapeHTML(g.name || "Groupe") + '</div>' +
        '<div class="lb-meta">' + memberCount + ' membre' + (memberCount > 1 ? 's' : '') + '</div>' +
      '</div>' +
      '<div class="lb-value">' + formatNumber(g.totalXP || 0) + ' XP</div>' +
    '</div>';
  }

  /* ============ RENDU LISTE USERS ============ */
  function renderUserList(container, sortedUsers, labelGetter, tabKey, subtitle) {
    if (sortedUsers.length === 0) {
      container.innerHTML = '<div class="lb-empty">Aucun utilisateur classé pour l instant.</div>';
      return;
    }

    const currentUserId = getCurrentUserId();
    const top10 = sortedUsers.slice(0, 10);

    let html = '';
    if (subtitle) html += '<div class="lb-subtitle">' + escapeHTML(subtitle) + '</div>';
    html += '<div class="lb-list">';
    top10.forEach(function(u, i) {
      html += renderRow(u, i + 1, labelGetter(u), u._id === currentUserId);
    });
    html += '</div>';

    const myIndex = sortedUsers.findIndex(function(u) { return u._id === currentUserId; });
    if (myIndex >= 10) {
      html += '<div class="lb-my-position-label">Ma position :</div>';
      html += '<div class="lb-list">' + renderRow(sortedUsers[myIndex], myIndex + 1, labelGetter(sortedUsers[myIndex]), true) + '</div>';
    }

    container.innerHTML = html;

    container.querySelectorAll("[data-user-id]").forEach(function(row) {
      row.addEventListener("click", function() {
        openUserModal(row.getAttribute("data-user-id"));
      });
    });
  }

  function renderRow(u, rank, valueLabel, isMine) {
    const medal = getMedalForRank(rank);
    const pseudo = u.pseudo || "Anonyme";
    const level = u.level || 1;
    const groups = userGroupsMap[u._id] || [];
    const groupName = groups.length > 0 ? groups[0].name : "";
    const cls = "lb-row" + (isMine ? " lb-row-mine" : "");

    return '<div class="' + cls + '" data-user-id="' + escapeHTML(u._id) + '">' +
      '<div class="lb-rank">' + medal + '</div>' +
      '<div class="lb-body">' +
        '<div class="lb-pseudo">' + escapeHTML(pseudo) + '</div>' +
        '<div class="lb-meta">Niveau ' + level +
          (groupName ? ' &middot; ' + escapeHTML(groupName) : '') +
        '</div>' +
      '</div>' +
      '<div class="lb-value">' + escapeHTML(valueLabel) + '</div>' +
    '</div>';
  }

  /* ============ MÉDAILLES ============ */
  function getMedalForRank(rank) {
    if (rank === 1) return '<span class="lb-medal lb-medal-gold">🥇</span>';
    if (rank === 2) return '<span class="lb-medal lb-medal-silver">🥈</span>';
    if (rank === 3) return '<span class="lb-medal lb-medal-bronze">🥉</span>';
    return '<span class="lb-rank-num">#' + rank + '</span>';
  }

  /* ============ MODALE PROFIL ============ */
  function openUserModal(userId) {
    const u = allUsers.find(function(x) { return x._id === userId; });
    if (!u) return;
    const currentUserId = getCurrentUserId();
    const isMyself = u._id === currentUserId;

    let modal = document.getElementById("lbUserModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "lbUserModal";
      modal.className = "modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      document.body.appendChild(modal);
    }

    const groups = userGroupsMap[u._id] || [];
    const groupsLabel = groups.length > 0
      ? groups.map(function(g) { return escapeHTML(g.name); }).join(", ")
      : "<em>aucun groupe</em>";

    modal.innerHTML =
      '<div class="modal-backdrop" data-lb-close="1"></div>' +
      '<div class="modal-card">' +
        '<div class="panel-title">' + escapeHTML(u.pseudo || "Anonyme") + '</div>' +
        '<div class="lb-user-modal-stats">' +
          '<div class="stat"><b>' + formatNumber(u.xp || 0) + '</b><span>XP total</span></div>' +
          '<div class="stat"><b>' + (u.level || 1) + '</b><span>Niveau</span></div>' +
          '<div class="stat"><b>' + (u.streak || 0) + '</b><span>Streak</span></div>' +
        '</div>' +
        '<div class="lb-user-modal-info">' +
          '<div><b>Groupes :</b> ' + groupsLabel + '</div>' +
        '</div>' +
        '<div class="modal-actions lb-modal-actions">' +
          (isMyself
            ? '<button class="btn btn-ghost" data-lb-close="1">Fermer</button>'
            : '<button class="btn btn-ghost" data-lb-close="1">Fermer</button>' +
              '<button class="btn btn-outline" data-lb-action="view-profile">Voir le profil</button>' +
              '<button class="btn btn-gold" data-lb-action="send-message">Envoyer un message</button>'
          ) +
        '</div>' +
      '</div>';

    modal.hidden = false;

    modal.querySelectorAll("[data-lb-close]").forEach(function(el) {
      el.addEventListener("click", function() { modal.hidden = true; });
    });

    const viewBtn = modal.querySelector("[data-lb-action='view-profile']");
    if (viewBtn) viewBtn.addEventListener("click", function() {
      modal.hidden = true;
      if (window.Main && window.Main.toast) window.Main.toast("Profil public à venir bientôt inchaAllah");
    });

    const msgBtn = modal.querySelector("[data-lb-action='send-message']");
    if (msgBtn) msgBtn.addEventListener("click", function() {
      modal.hidden = true;
      if (window.Main && window.Main.toast) window.Main.toast("Messagerie à venir bientôt inchaAllah");
    });
  }

  /* ============ API EXTERNE : ouvrir directement sur un thème ============ */
  function showWithTheme(themeId) {
    selectedThemeId = themeId || null;
    currentTab = "theme";
    show().then(function() {
      // Activer visuellement le bon onglet
      const container = document.getElementById("leaderboardContent");
      if (container) {
        container.querySelectorAll(".lb-tabs .filter-chip").forEach(function(b) {
          b.classList.toggle("active", b.getAttribute("data-lbtab") === "theme");
        });
      }
    });
  }

  /* ============ UTILS ============ */
  function getCurrentUserId() {
    if (window.Auth && window.Auth.getUser) {
      const u = window.Auth.getUser();
      if (u && u.uid) return u.uid;
    }
    if (window.State && window.State.get) return window.State.get("uid") || "";
    return "";
  }
  function formatNumber(n) {
    if (typeof n !== "number") n = parseInt(n, 10) || 0;
    return n.toLocaleString("fr-FR");
  }
  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, function(c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
    });
  }

  /* ============ API PUBLIQUE ============ */
  return {
    show: show,
    showWithTheme: showWithTheme
  };
})();

window.LeaderboardScreen = LeaderboardScreen;
console.log("LeaderboardScreen v2 chargé");
