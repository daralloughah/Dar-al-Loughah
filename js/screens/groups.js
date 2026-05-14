/* =========================================================
   DAR AL LOUGHAH - SCREEN: GROUPES (v2 fix auth)
   - Creer/rejoindre/quitter des groupes
   - Top membres + classement inter-groupes
   - Code d'invitation
   ========================================================= */

const GroupsScreen = (function() {

  let currentView = "myGroups";
  let userGroups = [];
  let allGroupsCache = [];

  function getCurrentUserId() {
    if (window.FB && window.FB.getCurrentUser) {
      try {
        const fbUser = window.FB.getCurrentUser();
        if (fbUser && fbUser.uid) return fbUser.uid;
      } catch (e) {}
    }
    if (window.Auth && window.Auth.getUser) {
      try {
        const u = window.Auth.getUser();
        if (u && u.uid) return u.uid;
      } catch (e) {}
    }
    if (window.State) {
      const uid = window.State.get("uid") || window.State.get("userId");
      if (uid) return uid;
    }
    return null;
  }

  function getCurrentPseudo() {
    if (window.State) {
      const p = window.State.get("pseudo");
      if (p) return p;
    }
    if (window.Auth && window.Auth.getUser) {
      try {
        const u = window.Auth.getUser();
        if (u && u.displayName) return u.displayName;
        if (u && u.email) return u.email.split("@")[0];
      } catch (e) {}
    }
    return "Anonyme";
  }

  function getCurrentXP() {
    if (window.State) return window.State.get("xp") || 0;
    return 0;
  }

  async function show() {
    const container = document.getElementById("groupsContent");
    if (!container) return;
    container.innerHTML = '<div class="admin-loading">Chargement des groupes...</div>';
    await loadUserGroups();
    renderUI();
  }

  async function loadUserGroups() {
    const uid = getCurrentUserId();
    if (!uid) {
      userGroups = [];
      return;
    }
    try {
      const all = await window.FB.getCollection("groups") || [];
      allGroupsCache = all;
      userGroups = all.filter(function(g) {
        return Array.isArray(g.members) && g.members.indexOf(uid) !== -1;
      });
    } catch (e) {
      console.warn("Erreur chargement groupes :", e);
      userGroups = [];
      allGroupsCache = [];
    }
  }

  function renderUI() {
    const container = document.getElementById("groupsContent");
    if (!container) return;
    container.innerHTML =
      '<div class="sub-tabs" style="margin-bottom:14px;">' +
        '<button class="filter-chip ' + (currentView === "myGroups" ? "active" : "") + '" data-groupview="myGroups">Mes groupes</button>' +
        '<button class="filter-chip ' + (currentView === "create" ? "active" : "") + '" data-groupview="create">Creer</button>' +
        '<button class="filter-chip ' + (currentView === "join" ? "active" : "") + '" data-groupview="join">Rejoindre</button>' +
        '<button class="filter-chip ' + (currentView === "ranking" ? "active" : "") + '" data-groupview="ranking">Classement</button>' +
      '</div>' +
      '<div id="groupsViewContent"></div>';

    container.querySelectorAll("[data-groupview]").forEach(function(btn) {
      btn.onclick = function() {
        currentView = btn.getAttribute("data-groupview");
        container.querySelectorAll("[data-groupview]").forEach(function(b) { b.classList.remove("active"); });
        btn.classList.add("active");
        renderView();
      };
    });
    renderView();
  }

  function renderView() {
    const content = document.getElementById("groupsViewContent");
    if (!content) return;
    if (currentView === "myGroups") renderMyGroups(content);
    else if (currentView === "create") renderCreate(content);
    else if (currentView === "join") renderJoin(content);
    else if (currentView === "ranking") renderRanking(content);
  }

  function renderMyGroups(container) {
    if (userGroups.length === 0) {
      container.innerHTML =
        '<div class="panel">' +
          '<div class="panel-title">MES GROUPES</div>' +
          '<div class="admin-empty">Tu n appartiens a aucun groupe.<br>Cree-en un ou rejoins-en un avec un code.</div>' +
        '</div>';
      return;
    }
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">MES GROUPES (' + userGroups.length + ')</div>' +
        userGroups.map(function(g) {
          const memberCount = (g.members || []).length;
          const typeLabel = getTypeLabel(g.type);
          return '<div class="list-item admin-list-item">' +
            '<div class="admin-item-body">' +
              '<div class="title">' + escapeHTML(g.name || "Sans nom") + '</div>' +
              '<div class="meta">' + typeLabel + ' - ' + memberCount + ' membre' + (memberCount > 1 ? "s" : "") + ' - ' + (g.totalXP || 0) + ' XP cumules</div>' +
            '</div>' +
            '<div class="admin-item-actions">' +
              '<button class="btn-mini btn-mini-edit" data-view-group="' + g._id + '" type="button">Voir</button>' +
            '</div>' +
          '</div>';
        }).join("") +
      '</div>';
    container.querySelectorAll("[data-view-group]").forEach(function(btn) {
      btn.onclick = function() { showGroupDetail(btn.getAttribute("data-view-group")); };
    });
  }

  function renderCreate(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">CREER UN GROUPE</div>' +
        '<p class="admin-hint">Cree ta classe, ta famille, ton alliance ou ton cercle d apprentissage.</p>' +
        '<div class="form-grid">' +
          '<label class="admin-label">Nom du groupe<input class="input" id="newGroupName" placeholder="ex: Madrasatouna Annee 2" maxlength="50"/></label>' +
          '<label class="admin-label">Description (optionnel)<input class="input" id="newGroupDesc" placeholder="ex: Eleves d arabe debutants" maxlength="100"/></label>' +
          '<label class="admin-label">Type<select class="input" id="newGroupType">' +
            '<option value="classe">Classe / Institut</option>' +
            '<option value="famille">Famille</option>' +
            '<option value="alliance">Alliance</option>' +
            '<option value="cercle">Cercle d amis</option>' +
          '</select></label>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="createGroupBtn" style="width:100%;">Creer ce groupe</button>' +
      '</div>';
    document.getElementById("createGroupBtn").onclick = createGroup;
  }

  function renderJoin(container) {
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">REJOINDRE UN GROUPE</div>' +
        '<p class="admin-hint">Demande le code d invitation a la personne qui a cree le groupe.</p>' +
        '<div class="form-grid">' +
          '<label class="admin-label">Code d invitation (6 caracteres)<input class="input" id="joinCode" placeholder="ABCD12" maxlength="6" style="text-transform:uppercase; letter-spacing:4px; text-align:center; font-size:18px;"/></label>' +
        '</div>' +
        '<button class="btn btn-gold mt-12" id="joinGroupBtn" style="width:100%;">Rejoindre le groupe</button>' +
      '</div>';
    document.getElementById("joinGroupBtn").onclick = joinGroup;
  }

  async function renderRanking(container) {
    container.innerHTML = '<div class="admin-loading">Chargement du classement...</div>';
    let allGroups;
    try {
      allGroups = await window.FB.getCollection("groups") || [];
    } catch (e) {
      container.innerHTML = '<div class="panel"><div class="admin-error">Erreur: ' + e.message + '</div></div>';
      return;
    }
    allGroups.sort(function(a, b) { return (b.totalXP || 0) - (a.totalXP || 0); });
    const top10 = allGroups.slice(0, 10);
    container.innerHTML =
      '<div class="panel">' +
        '<div class="panel-title">TOP 10 DES GROUPES</div>' +
        '<p class="admin-hint">Classement par XP cumules de tous les membres.</p>' +
        (top10.length > 0 ? top10.map(function(g, i) {
          const medal = i === 0 ? "1er" : i === 1 ? "2eme" : i === 2 ? "3eme" : "#" + (i+1);
          const memberCount = (g.members || []).length;
          return '<div class="list-item admin-list-item">' +
            '<div class="admin-item-body">' +
              '<div class="title">' + medal + ' ' + escapeHTML(g.name || "Sans nom") + '</div>' +
              '<div class="meta">' + (g.totalXP || 0) + ' XP - ' + memberCount + ' membres - ' + getTypeLabel(g.type) + '</div>' +
            '</div>' +
          '</div>';
        }).join("") : '<div class="admin-empty">Aucun groupe encore. Sois le premier !</div>') +
      '</div>';
  }

  async function showGroupDetail(groupId) {
    const content = document.getElementById("groupsViewContent");
    if (!content) return;
    content.innerHTML = '<div class="admin-loading">Chargement...</div>';
    let group, users;
    try {
      group = await window.FB.getDocument("groups", groupId);
      users = await window.FB.getCollection("users") || [];
    } catch (e) {
      content.innerHTML = '<div class="panel"><div class="admin-error">Erreur: ' + e.message + '</div></div>';
      return;
    }
    if (!group) { content.innerHTML = '<div class="panel"><div class="admin-empty">Groupe introuvable</div></div>'; return; }

    const memberIds = group.members || [];
    const members = users.filter(function(u) { return memberIds.indexOf(u._id || u.uid) !== -1; });
    members.sort(function(a, b) { return (b.xp || 0) - (a.xp || 0); });
    const totalXP = members.reduce(function(s, m) { return s + (m.xp || 0); }, 0);

    const currentUid = getCurrentUserId();
    const isCreator = currentUid && group.createdBy === currentUid;

    content.innerHTML =
      '<div class="panel">' +
        '<button class="btn btn-outline" id="backToGroupsBtn" style="margin-bottom:12px;">Retour</button>' +
        '<div class="panel-title">' + escapeHTML(group.name || "") + '</div>' +
        (group.description ? '<p class="admin-hint">' + escapeHTML(group.description) + '</p>' : '') +
        '<div class="stats-grid mt-12">' +
          '<div class="stat"><b>' + members.length + '</b><span>Membres</span></div>' +
          '<div class="stat"><b>' + totalXP + '</b><span>XP cumules</span></div>' +
          '<div class="stat"><b>' + getTypeLabel(group.type) + '</b><span>Type</span></div>' +
        '</div>' +
        '<div class="form-hint mt-12">Code d invitation : <b style="letter-spacing:3px; color:var(--gold-light); font-size:16px;">' + escapeHTML(group.invitCode || "") + '</b><br>Partage ce code pour faire rejoindre tes proches.</div>' +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">CLASSEMENT INTERNE</div>' +
        (members.length > 0 ? members.map(function(m, i) {
          const medal = i === 0 ? "1er" : i === 1 ? "2eme" : i === 2 ? "3eme" : "#" + (i+1);
          return '<div class="list-item admin-list-item">' +
            '<div class="admin-item-body">' +
              '<div class="title">' + medal + ' ' + escapeHTML(m.pseudo || "Anonyme") + (m.isPremium ? " - premium" : "") + '</div>' +
              '<div class="meta">' + (m.xp || 0) + ' XP - Niveau ' + (m.level || 1) + ' - Streak ' + (m.streak || 0) + 'j</div>' +
            '</div>' +
          '</div>';
        }).join("") : '<div class="admin-empty">Aucun membre</div>') +
      '</div>' +
      '<div class="panel mt-12">' +
        '<div class="panel-title">ACTIONS</div>' +
        '<button class="btn btn-outline mt-8" id="leaveGroupBtn" style="width:100%;">Quitter ce groupe</button>' +
        (isCreator ? '<button class="btn btn-outline mt-8" id="deleteGroupBtn" style="width:100%; border-color:rgba(255,107,120,.4); color:#ff9aa5;">Supprimer ce groupe (createur)</button>' : '') +
      '</div>';

    document.getElementById("backToGroupsBtn").onclick = function() { renderView(); };
    document.getElementById("leaveGroupBtn").onclick = function() { leaveGroup(groupId); };
    if (isCreator) {
      document.getElementById("deleteGroupBtn").onclick = function() { deleteGroup(groupId); };
    }
  }

  async function createGroup() {
    const name = getVal("newGroupName");
    const desc = getVal("newGroupDesc");
    const type = document.getElementById("newGroupType").value;
    if (!name) { toast("Donne un nom au groupe"); return; }
    if (name.length < 3) { toast("Nom trop court (min 3 caracteres)"); return; }

    const uid = getCurrentUserId();
    if (!uid) {
      toast("Tu dois etre connecte pour creer un groupe");
      console.warn("getCurrentUserId() returned null", {
        FB: !!window.FB,
        FBgetCurrentUser: !!(window.FB && window.FB.getCurrentUser),
        Auth: !!window.Auth,
        AuthgetUser: !!(window.Auth && window.Auth.getUser),
        State: !!window.State
      });
      return;
    }

    if (userGroups.length >= 5) {
      toast("Limite atteinte : 5 groupes max par utilisateur");
      return;
    }

    const invitCode = generateInvitCode();
    const newGroupId = "grp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);

    try {
      await window.FB.setDocument("groups", newGroupId, {
        name: name,
        description: desc,
        type: type,
        createdBy: uid,
        createdByPseudo: getCurrentPseudo(),
        members: [uid],
        invitCode: invitCode,
        totalXP: getCurrentXP(),
        totalWords: 0,
        createdAt: Date.now()
      });
      toast("Groupe cree ! Code : " + invitCode);
      currentView = "myGroups";
      await loadUserGroups();
      renderUI();
    } catch (e) {
      toast("Erreur: " + e.message);
    }
  }

  async function joinGroup() {
    const code = getVal("joinCode").toUpperCase().trim();
    if (!code || code.length !== 6) { toast("Code invalide (6 caracteres)"); return; }
    const uid = getCurrentUserId();
    if (!uid) { toast("Tu dois etre connecte"); return; }
    if (userGroups.length >= 5) { toast("Limite atteinte : 5 groupes max"); return; }

    try {
      const allGroups = await window.FB.getCollection("groups") || [];
      const group = allGroups.find(function(g) { return g.invitCode === code; });
      if (!group) { toast("Code invalide ou groupe introuvable"); return; }
      const members = group.members || [];
      if (members.indexOf(uid) !== -1) { toast("Tu es deja membre de ce groupe"); return; }
      members.push(uid);
      const myXP = getCurrentXP();
      await window.FB.setDocument("groups", group._id, Object.assign({}, group, {
        members: members,
        totalXP: (group.totalXP || 0) + myXP
      }));
      toast("Tu as rejoint " + group.name + " !");
      currentView = "myGroups";
      await loadUserGroups();
      renderUI();
    } catch (e) {
      toast("Erreur: " + e.message);
    }
  }

  async function leaveGroup(groupId) {
    if (!await confirmAction("Quitter ce groupe ?")) return;
    const uid = getCurrentUserId();
    if (!uid) return;
    try {
      const group = await window.FB.getDocument("groups", groupId);
      if (!group) { toast("Groupe introuvable"); return; }
      const members = (group.members || []).filter(function(memberId) { return memberId !== uid; });
      const myXP = getCurrentXP();
      await window.FB.setDocument("groups", groupId, Object.assign({}, group, {
        members: members,
        totalXP: Math.max(0, (group.totalXP || 0) - myXP)
      }));
      toast("Tu as quitte le groupe");
      currentView = "myGroups";
      await loadUserGroups();
      renderUI();
    } catch (e) {
      toast("Erreur: " + e.message);
    }
  }

  async function deleteGroup(groupId) {
    if (!await confirmAction("Supprimer DEFINITIVEMENT ce groupe ? Tous les membres seront retires.")) return;
    try {
      await window.FB.deleteDocument("groups", groupId);
      toast("Groupe supprime");
      currentView = "myGroups";
      await loadUserGroups();
      renderUI();
    } catch (e) {
      toast("Erreur: " + e.message);
    }
  }

  function generateInvitCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function getTypeLabel(type) {
    if (type === "classe") return "Classe";
    if (type === "famille") return "Famille";
    if (type === "alliance") return "Alliance";
    if (type === "cercle") return "Cercle";
    return "Groupe";
  }

  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c];
    });
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function toast(msg) {
    if (window.Main && window.Main.toast) window.Main.toast(msg);
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

window.GroupsScreen = GroupsScreen;
console.log("OK GroupsScreen charge");
