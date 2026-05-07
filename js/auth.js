/* =========================================================
   DAR AL LOUGHAH — AUTHENTICATION
   Gère les connexions :
   - Google (One Tap si CONFIG.GOOGLE_CLIENT_ID rempli)
   - Apple Sign In
   - Email + mot de passe (local ou backend)
   - Mode invité
   ========================================================= */

const Auth = (function() {

  const CFG = window.CONFIG || {};

  /* =========================================================
     CHECK SI L'UTILISATEUR EST CONNECTÉ
     ========================================================= */
  function isLoggedIn() {
    return window.State && window.State.get("loggedIn") === true;
  }

  function getUser() {
    if (!window.State) return null;
    return {
      pseudo: window.State.get("pseudo"),
      email: window.State.get("email"),
      avatar: window.State.get("avatar"),
      method: window.State.get("authMethod")
    };
  }

  /* =========================================================
     LOGIN : GOOGLE
     ========================================================= */
  async function loginGoogle() {
    if (!CFG.GOOGLE_CLIENT_ID) {
      // Pas de client ID configuré : mode démo
      return loginAsDemo("google", "Utilisateur Google");
    }

    // Charger le SDK Google si pas déjà fait
    if (!window.google || !window.google.accounts) {
      await loadGoogleSDK();
    }

    return new Promise(function(resolve) {
      try {
        window.google.accounts.id.initialize({
          client_id: CFG.GOOGLE_CLIENT_ID,
          callback: function(response) {
            const profile = parseJWT(response.credential);
            const user = {
              pseudo: profile.name || profile.given_name || "Utilisateur Google",
              email: profile.email || "",
              avatar: profile.picture || "",
              method: "google"
            };
            completeLogin(user, response.credential);
            resolve({ success: true, user: user });
          }
        });
        window.google.accounts.id.prompt();
      } catch (e) {
        console.warn("Google Sign-In error :", e);
        resolve(loginAsDemo("google", "Utilisateur Google"));
      }
    });
  }

  function loadGoogleSDK() {
    return new Promise(function(resolve) {
      if (document.querySelector('script[src*="accounts.google.com"]')) {
        return resolve();
      }
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = function() { resolve(); };
      document.head.appendChild(script);
    });
  }

  function parseJWT(token) {
    try {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(atob(base64).split("").map(function(c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return {};
    }
  }

  /* =========================================================
     LOGIN : APPLE
     ========================================================= */
  async function loginApple() {
    if (!CFG.APPLE_CLIENT_ID) {
      return loginAsDemo("apple", "Utilisateur Apple");
    }

    if (!window.AppleID) {
      await loadAppleSDK();
    }

    return new Promise(function(resolve) {
      try {
        window.AppleID.auth.init({
          clientId: CFG.APPLE_CLIENT_ID,
          scope: "name email",
          redirectURI: window.location.href,
          state: "auth_" + Date.now(),
          usePopup: true
        });

        window.AppleID.auth.signIn().then(function(data) {
          const user = {
            pseudo: (data.user && data.user.name && data.user.name.firstName) || "Utilisateur Apple",
            email: (data.user && data.user.email) || "",
            avatar: "",
            method: "apple"
          };
          completeLogin(user, data.authorization && data.authorization.id_token);
          resolve({ success: true, user: user });
        }).catch(function(e) {
          console.warn("Apple Sign-In error :", e);
          resolve(loginAsDemo("apple", "Utilisateur Apple"));
        });
      } catch (e) {
        resolve(loginAsDemo("apple", "Utilisateur Apple"));
      }
    });
  }

  function loadAppleSDK() {
    return new Promise(function(resolve) {
      if (document.querySelector('script[src*="appleid.auth"]')) return resolve();
      const script = document.createElement("script");
      script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = function() { resolve(); };
      document.head.appendChild(script);
    });
  }

  /* =========================================================
     LOGIN : EMAIL + MOT DE PASSE
     ========================================================= */
  async function loginEmail(email, password) {
    if (!email || !password) {
      return { success: false, error: "Email et mot de passe requis" };
    }
    if (!validateEmail(email)) {
      return { success: false, error: "Email invalide" };
    }

    // 1. Backend
    if (CFG.BACKEND_URL && navigator.onLine !== false) {
      try {
        const res = await fetch(CFG.BACKEND_URL + "/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: password })
        });
        if (res.ok) {
          const data = await res.json();
          const user = {
            pseudo: data.pseudo || email.split("@")[0],
            email: email,
            avatar: data.avatar || "",
            method: "email"
          };
          completeLogin(user, data.token);
          return { success: true, user: user };
        } else {
          const err = await res.json().catch(function() { return {}; });
          return { success: false, error: err.message || "Identifiants incorrects" };
        }
      } catch (e) {
        // Si backend KO, on tombe sur le mode local
      }
    }

    // 2. Mode local (vérification depuis localStorage)
    const stored = getStoredAccount(email);
    if (!stored) {
      return { success: false, error: "Aucun compte trouvé. Créez d'abord un compte." };
    }
    if (stored.passwordHash !== simpleHash(password)) {
      return { success: false, error: "Mot de passe incorrect" };
    }
    const user = {
      pseudo: stored.pseudo,
      email: email,
      avatar: stored.avatar || "",
      method: "email"
    };
    completeLogin(user);
    return { success: true, user: user };
  }

  /* =========================================================
     INSCRIPTION
     ========================================================= */
  async function register(data) {
    if (!data.pseudo || !data.email || !data.password) {
      return { success: false, error: "Tous les champs sont requis" };
    }
    if (!validateEmail(data.email)) {
      return { success: false, error: "Email invalide" };
    }
    if (data.password.length < 6) {
      return { success: false, error: "Le mot de passe doit faire au moins 6 caractères" };
    }
    if (data.password !== data.passwordConfirm) {
      return { success: false, error: "Les mots de passe ne correspondent pas" };
    }
    if (!data.terms) {
      return { success: false, error: "Vous devez accepter les conditions d'utilisation" };
    }

    // 1. Backend
    if (CFG.BACKEND_URL && navigator.onLine !== false) {
      try {
        const res = await fetch(CFG.BACKEND_URL + "/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pseudo: data.pseudo,
            email: data.email,
            password: data.password,
            newsletter: !!data.newsletter
          })
        });
        if (res.ok) {
          const json = await res.json();
          const user = {
            pseudo: data.pseudo,
            email: data.email,
            avatar: "",
            method: "email"
          };
          completeLogin(user, json.token, !!data.newsletter);
          return { success: true, user: user };
        } else {
          const err = await res.json().catch(function() { return {}; });
          return { success: false, error: err.message || "Erreur d'inscription" };
        }
      } catch (e) {
        // Si backend KO, on tombe en local
      }
    }

    // 2. Mode local
    if (getStoredAccount(data.email)) {
      return { success: false, error: "Un compte existe déjà avec cet email" };
    }
    storeAccount({
      email: data.email,
      pseudo: data.pseudo,
      passwordHash: simpleHash(data.password),
      newsletter: !!data.newsletter,
      createdAt: Date.now()
    });

    // Inscription newsletter
    if (data.newsletter && window.Api) {
      window.Api.subscribeNewsletter(data.email, data.pseudo);
    }

    const user = {
      pseudo: data.pseudo,
      email: data.email,
      avatar: "",
      method: "email"
    };
    completeLogin(user, null, !!data.newsletter);
    return { success: true, user: user };
  }

  /* =========================================================
     LOGIN : INVITÉ
     ========================================================= */
  function loginGuest() {
    const user = {
      pseudo: "Invité",
      email: "",
      avatar: "",
      method: "guest"
    };
    completeLogin(user);
    return { success: true, user: user };
  }

  /* =========================================================
     LOGOUT
     ========================================================= */
  function logout() {
    if (window.State) {
      window.State.update({
        loggedIn: false,
        authMethod: "guest"
      });
    }
    // Nettoyer les SDK
    try {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (e) {}
    document.dispatchEvent(new CustomEvent("auth-logout"));
  }

  /* =========================================================
     COMPLÈTE LE LOGIN (mise à jour du state)
     ========================================================= */
  function completeLogin(user, token, newsletter) {
    if (!window.State) return;

    const isFirstLogin = !window.State.get("createdAt");

    window.State.update({
      loggedIn: true,
      pseudo: user.pseudo,
      email: user.email,
      avatar: user.avatar || "",
      authMethod: user.method,
      newsletter: !!newsletter,
      createdAt: window.State.get("createdAt") || Date.now()
    });

    if (token) {
      try { localStorage.setItem("dar_auth_token", token); } catch (e) {}
    }

    document.dispatchEvent(new CustomEvent("auth-login", { detail: user }));

    // Vérifier les badges (Early adopter en particulier)
    if (window.XP) {
      window.XP.checkBadges();
    }
  }

  /* =========================================================
     FALLBACK DÉMO (quand pas de SDK configuré)
     ========================================================= */
  function loginAsDemo(method, defaultName) {
    const pseudo = prompt(
      "Mode démo (" + method + ") — entrez votre pseudo :",
      defaultName
    );
    if (!pseudo) return { success: false, error: "Annulé" };
    const user = {
      pseudo: pseudo,
      email: "",
      avatar: "",
      method: method
    };
    completeLogin(user);
    return { success: true, user: user };
  }

  /* =========================================================
     STOCKAGE LOCAL DES COMPTES (mode hors-ligne)
     ========================================================= */
  function getAccountsKey() {
    return "dar_accounts_v1";
  }

  function getAllAccounts() {
    try {
      const raw = localStorage.getItem(getAccountsKey());
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getStoredAccount(email) {
    const all = getAllAccounts();
    return all[email.toLowerCase()] || null;
  }

  function storeAccount(account) {
    const all = getAllAccounts();
    all[account.email.toLowerCase()] = account;
    try {
      localStorage.setItem(getAccountsKey(), JSON.stringify(all));
    } catch (e) {}
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // Hash simple (pas cryptographiquement sûr, juste pour mode local)
  // Pour une vraie sécurité, utiliser le backend
  function simpleHash(str) {
    let hash = 0;
    if (!str) return "0";
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return "h_" + Math.abs(hash).toString(36);
  }

  /* =========================================================
     CHANGEMENT DE PSEUDO
     ========================================================= */
  function changePseudo(newPseudo) {
    if (!newPseudo || newPseudo.trim().length < 2) {
      return { success: false, error: "Pseudo trop court" };
    }
    if (window.State) {
      window.State.set("pseudo", newPseudo.trim());
    }
    return { success: true };
  }

  /* -------- API publique -------- */
  return {
    isLoggedIn: isLoggedIn,
    getUser: getUser,
    loginGoogle: loginGoogle,
    loginApple: loginApple,
    loginEmail: loginEmail,
    loginGuest: loginGuest,
    register: register,
    logout: logout,
    changePseudo: changePseudo,
    validateEmail: validateEmail
  };
})();

window.Auth = Auth;
console.log("✓ Auth chargé");
