/* =========================================================
   DAR AL LOUGHAH — AUTH (Firebase + fallback local)
   Version compatible avec l'ancien main.js
   ========================================================= */

const Auth = (function() {

  let currentUser = null;
  let firebaseReady = false;

  /* =========================================================
     INIT — Écoute les événements Firebase
     ========================================================= */
  function init() {
    document.addEventListener("firebase-user-changed", function(e) {
      const fbUser = e.detail && e.detail.user;
      const isAdmin = e.detail && e.detail.isAdmin;

      if (fbUser && fbUser.email) {
        currentUser = {
          email: fbUser.email,
          uid: fbUser.uid || null,
          pseudo: fbUser.pseudo || fbUser.displayName || fbUser.email.split("@")[0],
          isAdmin: isAdmin || false,
          source: fbUser.source || "firebase"
        };
        try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
        if (window.State && window.State.setUser) {
          window.State.setUser(currentUser);
        }
        syncUserToFirestore(currentUser);
        firebaseReady = true;
      }
    });

    // Restaurer depuis le cache au démarrage
    try {
      const cached = localStorage.getItem("dar_auth_user");
      if (cached) {
        currentUser = JSON.parse(cached);
        if (window.State && window.State.setUser) {
          window.State.setUser(currentUser);
        }
      }
    } catch(e) {}
  }

  /* =========================================================
     SYNC FIRESTORE
     ========================================================= */
  async function syncUserToFirestore(user) {
    if (!window.FB || !window.FB.isReady()) return;
    if (!user || !user.uid) return;

    try {
      const existing = await window.FB.getDocument("users", user.uid);
      if (!existing) {
        await window.FB.setDocument("users", user.uid, {
          email: user.email,
          pseudo: user.pseudo,
          xp: 0,
          level: 1,
          streak: 0,
          isPremium: false,
          isAdmin: user.isAdmin || false,
          createdAt: Date.now(),
          lastSeen: Date.now()
        });
      } else {
        await window.FB.updateDocument("users", user.uid, {
          lastSeen: Date.now()
        });
      }
    } catch(e) {
      console.warn("Sync user err:", e);
    }
  }

  /* =========================================================
     LOGIN — méthodes appelées par main.js
     ========================================================= */
  async function login(email, password, pseudo) {
    if (!email || !password) {
      return { success: false, error: "Email et mot de passe requis" };
    }

    // Tentative Firebase d'abord
    if (window.FB && window.FB.isReady()) {
      const result = await window.FB.signIn(email, password);
      if (result.success) {
        return { success: true, user: { email: email, pseudo: pseudo || email.split("@")[0] } };
      }
      // Fallback local si Firebase refuse
      console.warn("Firebase login échoué, fallback local:", result.error);
    }

    // Fallback local
    return loginLocal(email, password);
  }

  async function signup(email, password, pseudo) {
    if (!email || !password) {
      return { success: false, error: "Email et mot de passe requis" };
    }
    if (password.length < 6) {
      return { success: false, error: "Mot de passe : 6 caractères minimum" };
    }

    // Tentative Firebase d'abord
    if (window.FB && window.FB.isReady()) {
      const result = await window.FB.signUp(email, password);
      if (result.success) {
        // Forcer le pseudo
        currentUser = {
          email: email,
          uid: result.user.uid,
          pseudo: pseudo || email.split("@")[0],
          isAdmin: window.FB.isUserAdmin(email),
          source: "firebase"
        };
        try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
        if (window.State && window.State.setUser) {
          window.State.setUser(currentUser);
        }
        return { success: true, user: currentUser };
      }
      console.warn("Firebase signup échoué, fallback local:", result.error);
      return { success: false, error: result.error };
    }

    // Fallback local
    return signupLocal(email, password, pseudo);
  }

  async function loginGoogle() {
    if (window.FB && window.FB.isReady()) {
      const result = await window.FB.signInGoogle();
      if (result.success) return { success: true };
      return { success: false, error: result.error };
    }
    return { success: false, error: "Google indisponible" };
  }

  async function loginApple() {
    return { success: false, error: "Apple bientôt disponible" };
  }

  async function logout() {
    if (window.FB && window.FB.isReady()) {
      await window.FB.signOut();
    }
    currentUser = null;
    try { localStorage.removeItem("dar_auth_user"); } catch(e) {}
    if (window.State && window.State.clearUser) {
      window.State.clearUser();
    }
    document.dispatchEvent(new CustomEvent("firebase-user-changed", {
      detail: { user: null, isAdmin: false }
    }));
  }

  async function resetPassword(email) {
    if (window.FB && window.FB.isReady()) {
      return await window.FB.resetPassword(email);
    }
    return { success: false, error: "Réinitialisation indisponible" };
  }

  /* =========================================================
     FALLBACK LOCAL (si Firebase pas dispo)
     ========================================================= */
  function loginLocal(email, password) {
    try {
      const users = JSON.parse(localStorage.getItem("dar_local_users") || "{}");
      const u = users[email.toLowerCase()];
      if (!u) return { success: false, error: "Compte introuvable" };
      if (u.password !== password) return { success: false, error: "Mot de passe incorrect" };

      const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
      currentUser = {
        email: email,
        pseudo: u.pseudo || email.split("@")[0],
        isAdmin: admins.indexOf(email.toLowerCase()) !== -1,
        source: "local"
      };
      try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
      if (window.State && window.State.setUser) {
        window.State.setUser(currentUser);
      }

      // Important : déclencher l'événement pour le bouton admin
      document.dispatchEvent(new CustomEvent("firebase-user-changed", {
        detail: { user: currentUser, isAdmin: currentUser.isAdmin }
      }));

      return { success: true, user: currentUser };
    } catch(e) {
      return { success: false, error: "Erreur locale" };
    }
  }

  function signupLocal(email, password, pseudo) {
    try {
      const users = JSON.parse(localStorage.getItem("dar_local_users") || "{}");
      if (users[email.toLowerCase()]) {
        return { success: false, error: "Email déjà utilisé" };
      }
      users[email.toLowerCase()] = {
        password: password,
        pseudo: pseudo || email.split("@")[0],
        createdAt: Date.now()
      };
      localStorage.setItem("dar_local_users", JSON.stringify(users));
      return loginLocal(email, password);
    } catch(e) {
      return { success: false, error: "Erreur locale" };
    }
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function getCurrentUser() { return currentUser; }
  function isLoggedIn() { return !!currentUser; }
  function isAdmin() {
    if (!currentUser) return false;
    if (currentUser.isAdmin) return true;
    const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
    return admins.indexOf((currentUser.email || "").toLowerCase()) !== -1;
  }

  /* =========================================================
     INIT
     ========================================================= */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* -------- API publique -------- */
  return {
    init: init,
    login: login,
    signup: signup,
    loginGoogle: loginGoogle,
    loginApple: loginApple,
    logout: logout,
    resetPassword: resetPassword,
    getCurrentUser: getCurrentUser,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin
  };
})();

window.Auth = Auth;
console.log("✓ Auth chargé");
