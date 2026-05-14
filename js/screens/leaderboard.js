/* =========================================================
   DAR AL LOUGHAH - LEADERBOARD SCREEN
   5 onglets : General / Hebdo / Mensuel / Streak / Groupes
   - Top 10 + position du user connecte
   - Pseudo + groupe + valeur
   - Clic sur user = modale (Voir profil / Envoyer message)
   ========================================================= */

const LeaderboardScreen = (function() {

  let currentTab = "general";
  let allUsers = [];
  let allGroups = [];
  let userGroupsMap = {};

  // ============ ENTREE PRINCIPALE ============
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
        '<button class="filter-chip active" data-lbtab="general">General</button>' +
        '<button class="filter-chip" data-lbtab="weekly">Hebdo</button>' +
        '<button class="filter-chip" data-lbtab="monthly">Mensuel</button>' +
        '<button class="filter-chip" data-lbtab="streak">Streak</button>' +
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

  // ============ CHARGEMENT DES DONNEES ============
  async function loadData() {
    try {
      if (window.FB && window.FB.getCollection) {
        allUsers = await window.FB.getCollection("users") || [];
        allGroups = await window.FB.getCollection("groups") || [];
      } else {
        allUsers = [];
        allGroups = [];
      }
    } catch (e) {
      console.warn("Erreur load leaderboard:", e);
      allUsers = [];
      allGroups = [];
    }

    // Construire un map userId -> [groupes]
    userGroupsMap = {};
    allGroups.forEach(function(g) {
      const members = g.members || [];
      members.forEach(function(uid) {
        if (!userGroupsMap[uid]) userGroupsMap[uid] = [];
        userGroupsMap[uid].push(g);
      });
    });
  }

  // ============ ROUTAGE DES ONGLETS ============
  function renderTab(tab) {
    const c = document.getElementById("lbTabContent");
    if (!c) return;
    switch (tab) {
      case "general": renderGeneral(c); break;
      case "weekly":  renderWeekly(c); break;
      case "monthly": renderMonthly(c); break;
      case "streak":  renderStreak(c); break;
      case "groups":  renderGroups(c); break;
    }
  }

  // ============ ONGLET GENERAL (XP total) ============
  function renderGeneral(container) {
    const sorted = allUsers.slice().sort(function(a, b) {
      return (b.xp || 0) - (a.xp || 0);
    });
    const valueGetter = function(u) { return (u.xp || 0); };
    const labelGetter = function(u) { return formatNumber(u.xp || 0) + " XP"; };
    renderLeaderboardList(container, sorted, valueGetter, labelGetter, "general");
  }

  // ============ ONGLET HEBDO ============
  function renderWeekly(container) {
    const sorted = allUsers.slice().sort(function(a, b) {
      return (b.xpThisWeek || 0) - (a.xpThisWeek || 0);
    });
    const valueGetter = function(u) { return (u.xpThisWeek || 0); };
    const labelGetter = function(u) { return formatNumber(u.xpThisWeek || 0) + " XP"; };
    const subtitle = window.PeriodReset ? "Semaine " + window.PeriodReset.getCurrentWeekKey() : "Cette semaine";
    renderLeaderboardList(container, sorted, valueGetter, labelGetter, "weekly", subtitle);
  }

  // ============ ONGLET MENSUEL ============
  function renderMonthly(container) {
    const sorted = allUsers.slice().sort(function(a, b) {
      return (b.xpThisMonth || 0) - (a.xpThisMonth || 0);
    });
    const valueGetter = function(u) { return (u.xpThisMonth || 0); };
    const labelGetter = function(u) { return formatNumber(u.xpThisMonth || 0) + " XP"; };
    const subtitle = window.PeriodReset ? "Mois " + window.PeriodReset.getCurrentMonthKey() : "Ce mois";
    renderLeaderboardList(container, sorted, valueGetter, labelGetter, "monthly", subtitle);
  }

  // ============ ONGLET STREAK ============
  function renderStreak(container) {
    const sorted = allUsers.slice().sort(function(a, b) {
      return (b.streak || 0) - (a.streak || 0);
    });
    const valueGetter = function(u) { return (u.streak || 0); };
    const labelGetter = function(u) {
      const s = u.streak || 0;
      return s + (s > 1 ? " jours" : " jour");
    };
    renderLeaderboardList(container, sorted, valueGetter, labelGetter, "streak", "Jours consecutifs de participation");
  }

  // ============ ONGLET GROUPES (total XP du groupe) ============
  function renderGroups(container) {
    // Calculer le total XP de chaque groupe
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
      container.innerHTML = '<div class="lb-empty">Aucun groupe pour l instant.<br>Creez le premier !</div>';
      return;
    }

    const currentUserId = getCurrentUserId();
    const myGroup = groupsWithXP.find(function(g) {
      return (g.members || []).indexOf(currentUserId) !== -1;
    });

    let html = '';
    if (window.PeriodReset) {
      html += '<div class="lb-subtitle">Classement par total XP du groupe</div>';
    }

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

  // ============ RENDU LISTE GENERIQUE ============
  function renderLeaderboardList(container, sortedUsers, valueGetter, labelGetter, tabKey, subtitle) {
    if (sortedUsers.length === 0) {
      container.innerHTML = '<div class="lb-empty">Aucun utilisateur classe pour l instant.</div>';
      return;
    }

    const currentUserId = getCurrentUserId();
    const top10 = sortedUsers.slice(0, 10);

    let html = '';
    if (subtitle) {
      html += '<div class="lb-subtitle">' + escapeHTML(subtitle) + '</div>';
    }

    html += '<div class="lb-list">';
    top10.forEach(function(u, i) {
      html += renderUserRow(u, i + 1, labelGetter(u), u._id === currentUserId);
    });
    html += '</div>';

    // Position du user connecte si hors top 10
    const myIndex = sortedUsers.findIndex(function(u) { return u._id === currentUserId; });
    if (myIndex >= 10) {
      html += '<div class="lb-my-position-label">Ma position :</div>';
      html += '<div class="lb-list">' + renderUserRow(sortedUsers[myIndex], myIndex + 1, labelGetter(sortedUsers[myIndex]), true) + '</div>';
    }

    container.innerHTML = html;

    // Bind clic sur les lignes utilisateur
    container.querySelectorAll("[data-user-id]").forEach(function(row) {
      row.addEventListener("click", function() {
        openUserModal(row.getAttribute("data-user-id"));
      });
    });
  }

  function renderUserRow(u, rank, valueLabel, isMine) {
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

  // ============ MEDAILLES DE RANG ============
  function getMedalForRank(rank) {
    if (rank === 1) return '<span class="lb-medal lb-medal-gold" title="1er">🥇</span>';
    if (rank === 2) return '<span class="lb-medal lb-medal-silver" title="2eme">🥈</span>';
    if (rank === 3) return '<span class="lb-medal lb-medal-bronze" title="3eme">🥉</span>';
    return '<span class="lb-rank-num">#' + rank + '</span>';
  }

  // ============ MODALE PROFIL UTILISATEUR ============
  function openUserModal(userId) {
    const u = allUsers.find(function(x) { return x._id === userId; });
    if (!u) return;

    const currentUserId = getCurrentUserId();
    const isMyself = u._id === currentUserId;

    // Construire la modale
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
    if (viewBtn) {
      viewBtn.addEventListener("click", function() {
        modal.hidden = true;
        if (window.Main && window.Main.toast) {
          window.Main.toast("Profil public a venir bientot inchaAllah");
        }
        // TODO Phase 4 : ouvrir l ecran profil-public avec userId
      });
    }

    const msgBtn = modal.querySelector("[data-lb-action='send-message']");
    if (msgBtn) {
      msgBtn.addEventListener("click", function() {
        modal.hidden = true;
        if (window.Main && window.Main.toast) {
          window.Main.toast("Messagerie a venir bientot inchaAllah");
        }
        // TODO Phase 5 : ouvrir conversation avec userId
      });
    }
  }

  // ============ UTILS ============
  function getCurrentUserId() {
    if (window.Auth && window.Auth.getUser) {
      const u = window.Auth.getUser();
      if (u && u.uid) return u.uid;
    }
    if (window.State && window.State.get) {
      return window.State.get("uid") || "";
    }
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

  // ============ API PUBLIQUE ============
  return {
    show: show
  };
})();

window.LeaderboardScreen = LeaderboardScreen;
console.log("LeaderboardScreen charge");
