/* =========================================================
   DAR AL LOUGHAH — AUTH (Firebase + fallback local)
   - Si Firebase OK → utilise Firebase Auth
   - Sinon → fallback local (ancien système)
   ========================================================= */

const Auth = (function() {

  let currentUser = null;
  let listeners = [];

  /* =========================================================
     INIT — Écoute Firebase
     ========================================================= */
  function init() {
    // Écouter les changements Firebase Auth
    document.addEventListener("firebase-user-changed", function(e) {
      const fbUser = e.detail && e.detail.user;
      const isAdmin = e.detail && e.detail.isAdmin;

      if (fbUser) {
        // Connecté via Firebase
        currentUser = {
          email: fbUser.email,
          uid: fbUser.uid,
          pseudo: fbUser.displayName || fbUser.email.split("@")[0],
          isAdmin: isAdmin,
          source: "firebase"
        };

        // Sauvegarder en local pour relance rapide
        try {
          localStorage.setItem("dar_auth_user", JSON.stringify(currentUser));
        } catch(e) {}

        // Synchroniser avec State
        if (window.State && window.State.setUser) {
          window.State.setUser(currentUser);
        }

        // Créer/Mettre à jour le profil utilisateur dans Firestore
        syncUserToFirestore(currentUser);

        notify();
      } else {
        currentUser = null;
        try { localStorage.removeItem("dar_auth_user"); } catch(e) {}
        notify();
      }
    });

    // Au chargement, si on a un user en cache, le restaurer en attendant Firebase
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
     SYNC USER → Firestore
     ========================================================= */
  async function syncUserToFirestore(user) {
    if (!window.FB || !window.FB.isReady()) return;
    if (!user || !user.uid) return;

    try {
      const existing = await window.FB.getDocument("users", user.uid);
      if (!existing) {
        // Premier login : créer profil
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
        // Mise à jour lastSeen
        await window.FB.updateDocument("users", user.uid, {
          lastSeen: Date.now(),
          isAdmin: user.isAdmin || false
        });
      }
    } catch(e) {
      console.warn("Sync Firestore err:", e);
    }
  }

  /* =========================================================
     AUTH METHODS — Email
     ========================================================= */
  async function loginEmail(email, password) {
    if (!email || !password) {
      return { success: false, error: "Email et mot de passe requis" };
    }

    if (window.FB && window.FB.isReady()) {
      // Tentative login Firebase
      const result = await window.FB.signIn(email, password);
      if (result.success) {
        return { success: true };
      }
      // Si user n'existe pas, on tente de l'inscrire
      if (result.error && (result.error.indexOf("Aucun") !== -1 || result.error.indexOf("incorrect") !== -1)) {
        return { success: false, error: result.error, canSignup: true };
      }
      return { success: false, error: result.error };
    }

    // Fallback local
    return loginLocal(email, password);
  }

  async function signupEmail(email, password, pseudo) {
    if (!email || !password) {
      return { success: false, error: "Email et mot de passe requis" };
    }
    if (password.length < 6) {
      return { success: false, error: "Mot de passe min 6 caractères" };
    }

    if (window.FB && window.FB.isReady()) {
      const result = await window.FB.signUp(email, password);
      if (result.success) {
        return { success: true };
      }
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
    return { success: false, error: "Google login indisponible" };
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
    notify();
  }

  async function resetPassword(email) {
    if (window.FB && window.FB.isReady()) {
      return await window.FB.resetPassword(email);
    }
    return { success: false, error: "Reset indisponible" };
  }

  /* =========================================================
     FALLBACK LOCAL (mode déconnecté)
     ========================================================= */
  function loginLocal(email, password) {
    try {
      const users = JSON.parse(localStorage.getItem("dar_local_users") || "{}");
      const u = users[email.toLowerCase()];
      if (!u) return { success: false, error: "Compte introuvable", canSignup: true };
      if (u.password !== password) return { success: false, error: "Mot de passe incorrect" };

      const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
      currentUser = {
        email: email,
        pseudo: u.pseudo || email.split("@")[0],
        isAdmin: admins.indexOf(email.toLowerCase()) !== -1,
        source: "local"
      };
      localStorage.setItem("dar_auth_user", JSON.stringify(currentUser));
      if (window.State && window.State.setUser) window.State.setUser(currentUser);

      // Forcer l'événement pour le bouton admin
      document.dispatchEvent(new CustomEvent("firebase-user-changed", {
        detail: { user: currentUser, isAdmin: currentUser.isAdmin }
      }));

      notify();
      return { success: true };
    } catch(e) {
      return { success: false, error: "Erreur locale" };
    }
  }

  function signupLocal(email, password, pseudo) {
    try {
      const users = JSON.parse(localStorage.getItem("dar_local_users") || "{}");
      if (users[email.toLowerCase()]) return { success: false, error: "Email déjà utilisé" };
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
  function isAdmin() { return !!(currentUser && currentUser.isAdmin); }

  function onChange(callback) {
    listeners.push(callback);
  }

  function notify() {
    listeners.forEach(function(cb) {
      try { cb(currentUser); } catch(e) {}
    });
  }

  /* =========================================================
     INIT AU DEMARRAGE
     ========================================================= */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    init: init,
    loginEmail: loginEmail,
    signupEmail: signupEmail,
    loginGoogle: loginGoogle,
    logout: logout,
    resetPassword: resetPassword,
    getCurrentUser: getCurrentUser,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin,
    onChange: onChange
  };
})();

window.Auth = Auth;
console.log("✓ Auth chargé (Firebase + fallback)");
