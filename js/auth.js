/* =========================================================
   DAR AL LOUGHAH — AUTH SIMPLE (local + Firebase optionnel)
   ========================================================= */

const Auth = (function() {

  let currentUser = null;

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    // Restaurer depuis le cache
    try {
      const cached = localStorage.getItem("dar_auth_user");
      if (cached) {
        currentUser = JSON.parse(cached);
        if (window.State && window.State.setUser) {
          window.State.setUser(currentUser);
        }
        // Déclencher l'événement pour que le bouton admin apparaisse
        setTimeout(function() {
          fireUserChange(currentUser);
        }, 500);
      }
    } catch(e) {}
  }

  /* =========================================================
     FIRE EVENT — pour le bouton admin
     ========================================================= */
  function fireUserChange(user) {
    const isAdmin = user ? checkAdmin(user.email) : false;
    document.dispatchEvent(new CustomEvent("firebase-user-changed", {
      detail: { user: user, isAdmin: isAdmin }
    }));
  }

  function checkAdmin(email) {
    if (!email) return false;
    const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
    return admins.indexOf(email.toLowerCase()) !== -1;
  }

  /* =========================================================
     LOGIN / SIGNUP — local en priorité
     ========================================================= */
  async function login(email, password, pseudo) {
    if (!email || !password) {
      return { success: false, error: "Email et mot de passe requis" };
    }

    email = email.toLowerCase().trim();

    // 1. Tenter local d'abord
    try {
      const users = JSON.parse(localStorage.getItem("dar_local_users") || "{}");
      const u = users[email];
      if (u && u.password === password) {
        currentUser = {
          email: email,
          pseudo: u.pseudo || email.split("@")[0],
          isAdmin: checkAdmin(email),
          source: "local"
        };
        try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
        if (window.State && window.State.setUser) window.State.setUser(currentUser);
        fireUserChange(currentUser);

        // 2. Tenter Firebase en arrière-plan (silencieux)
        if (window.FB && window.FB.isReady()) {
          window.FB.signIn(email, password).catch(function() {});
        }

        return { success: true, user: currentUser };
      }
      if (u && u.password !== password) {
        return { success: false, error: "Mot de passe incorrect" };
      }
    } catch(e) {}

    // 3. Si pas en local, essayer Firebase
    if (window.FB && window.FB.isReady()) {
      const result = await window.FB.signIn(email, password);
      if (result.success) {
        currentUser = {
          email: email,
          uid: result.user.uid,
          pseudo: pseudo || result.user.displayName || email.split("@")[0],
          isAdmin: checkAdmin(email),
          source: "firebase"
        };
        try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
        if (window.State && window.State.setUser) window.State.setUser(currentUser);
        fireUserChange(currentUser);
        return { success: true, user: currentUser };
      }
      return { success: false, error: result.error || "Compte introuvable" };
    }

    return { success: false, error: "Compte introuvable" };
  }

  async function signup(email, password, pseudo) {
    if (!email || !password) {
      return { success: false, error: "Email et mot de passe requis" };
    }
    if (password.length < 6) {
      return { success: false, error: "Mot de passe : 6 caractères min" };
    }

    email = email.toLowerCase().trim();

    // 1. Vérifier si compte local existe déjà
    try {
      const users = JSON.parse(localStorage.getItem("dar_local_users") || "{}");
      if (users[email]) {
        return { success: false, error: "Email déjà utilisé" };
      }

      // Créer en local
      users[email] = {
        password: password,
        pseudo: pseudo || email.split("@")[0],
        createdAt: Date.now()
      };
      localStorage.setItem("dar_local_users", JSON.stringify(users));

      currentUser = {
        email: email,
        pseudo: pseudo || email.split("@")[0],
        isAdmin: checkAdmin(email),
        source: "local"
      };
      try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
      if (window.State && window.State.setUser) window.State.setUser(currentUser);
      fireUserChange(currentUser);

      // 2. Créer aussi en Firebase en arrière-plan
      if (window.FB && window.FB.isReady()) {
        window.FB.signUp(email, password).then(function(r) {
          if (r.success && currentUser) {
            currentUser.uid = r.user.uid;
            try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
          }
        }).catch(function() {});
      }

      return { success: true, user: currentUser };
    } catch(e) {
      return { success: false, error: "Erreur d'inscription" };
    }
  }

  async function loginGoogle() {
    if (window.FB && window.FB.isReady()) {
      const result = await window.FB.signInGoogle();
      if (result.success) {
        currentUser = {
          email: result.user.email,
          uid: result.user.uid,
          pseudo: result.user.displayName || result.user.email.split("@")[0],
          isAdmin: checkAdmin(result.user.email),
          source: "google"
        };
        try { localStorage.setItem("dar_auth_user", JSON.stringify(currentUser)); } catch(e) {}
        if (window.State && window.State.setUser) window.State.setUser(currentUser);
        fireUserChange(currentUser);
        return { success: true };
      }
      return { success: false, error: result.error };
    }
    return { success: false, error: "Google indisponible" };
  }

  async function loginApple() {
    return { success: false, error: "Apple bientôt disponible" };
  }

  async function logout() {
    if (window.FB && window.FB.isReady()) {
      try { await window.FB.signOut(); } catch(e) {}
    }
    currentUser = null;
    try { localStorage.removeItem("dar_auth_user"); } catch(e) {}
    if (window.State && window.State.clearUser) window.State.clearUser();
    fireUserChange(null);
  }

  async function resetPassword(email) {
    if (window.FB && window.FB.isReady()) {
      return await window.FB.resetPassword(email);
    }
    return { success: false, error: "Réinitialisation indisponible" };
  }

  /* =========================================================
     HELPERS
     ========================================================= */
  function getCurrentUser() { return currentUser; }
  function isLoggedIn() { return !!currentUser; }
  function isAdmin() {
    if (!currentUser) return false;
    return checkAdmin(currentUser.email);
  }

  /* =========================================================
     INIT
     ========================================================= */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

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
console.log("✓ Auth chargé (local-first)");
