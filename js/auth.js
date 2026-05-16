const Auth = (function() {

  const CFG = window.CONFIG || {};

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

  function backendReady() {
    return window.FB && window.FB.isReady && window.FB.isReady();
  }

  async function ensureBackend() {
    if (backendReady()) return true;
    if (window.FB && window.FB.init) {
      try { await window.FB.init(); } catch (e) { return false; }
    }
    return backendReady();
  }

  async function loginGoogle() {
    const ok = await ensureBackend();
    if (!ok) return { success: false, error: "Backend non disponible" };
    const result = await window.FB.signInGoogle();
    if (!result.success) return { success: false, error: result.error || "Erreur Google" };
    const user = {
      pseudo: result.user.displayName || result.user.email.split("@")[0],
      email: result.user.email,
      avatar: result.user.photoURL || "",
      method: "google",
      uid: result.user.uid
    };
    completeLogin(user);
    return { success: true, user: user };
  }

  async function loginApple() {
    return { success: false, error: "Apple login non configure" };
  }

  async function loginEmail(email, password) {
    if (!email || !password) return { success: false, error: "Email et mot de passe requis" };
    if (!validateEmail(email)) return { success: false, error: "Email invalide" };

    const ok = await ensureBackend();
    if (!ok) return { success: false, error: "Backend non disponible" };

    const result = await window.FB.signIn(email, password);
    if (!result.success) return { success: false, error: result.error || "Identifiants incorrects" };

    const user = {
      pseudo: result.user.displayName || email.split("@")[0],
      email: email,
      avatar: result.user.photoURL || "",
      method: "email",
      uid: result.user.uid
    };
    completeLogin(user);
    return { success: true, user: user };
  }

  async function register(data) {
    if (!data.pseudo || !data.email || !data.password) return { success: false, error: "Tous les champs sont requis" };
    if (!validateEmail(data.email)) return { success: false, error: "Email invalide" };
    if (data.password.length < 6) return { success: false, error: "Mot de passe trop court (min 6 caracteres)" };
    if (data.password !== data.passwordConfirm) return { success: false, error: "Mots de passe differents" };
    if (!data.terms) return { success: false, error: "Acceptez les conditions" };

    const ok = await ensureBackend();
    if (!ok) return { success: false, error: "Backend non disponible" };

    // Detection : etait-on en mode invite avec des donnees ?
    const wasGuestWithData = window.State && window.State.isGuest && window.State.isGuest() &&
      ((window.State.get("xp") || 0) > 0 ||
       (window.State.get("lists") || []).length > 0 ||
       (window.State.get("unlockedBadges") || []).length > 0);

    const result = await window.FB.signUp(data.email, data.password);
    if (!result.success) return { success: false, error: result.error || "Erreur inscription" };

    const user = {
      pseudo: data.pseudo,
      email: data.email,
      avatar: "",
      method: "email",
      uid: result.user.uid
    };
    completeLogin(user, !!data.newsletter);

    // Si on avait des donnees en mode invite, on les promeut au cloud
    if (wasGuestWithData && window.State && window.State.promoteGuestToUser) {
      try {
        await window.State.promoteGuestToUser();
        if (window.Main && window.Main.toast) window.Main.toast("Progression sauvegardee dans le cloud");
      } catch (e) {
        console.warn("Promotion invite -> user echouee:", e);
      }
    }

    return { success: true, user: user };
  }

  function loginGuest() {
    const user = { pseudo: "Invite", email: "", avatar: "", method: "guest" };
    completeLogin(user);
    if (window.Main && window.Main.toast) {
      window.Main.toast("Mode invite : progression non sauvegardee");
    }
    return { success: true, user: user };
  }

  async function logout() {
    // Flush des donnees en attente avant deconnexion
    if (window.State && window.State.flushPending) {
      try { await window.State.flushPending(); } catch (e) {}
    }
    if (backendReady()) {
      try { await window.FB.signOut(); } catch (e) {}
    }
    if (window.State) window.State.update({ loggedIn: false, authMethod: "guest" });
    document.dispatchEvent(new CustomEvent("auth-logout"));
  }

  function completeLogin(user, newsletter) {
    if (!window.State) return;

    window.State.update({
      loggedIn: true,
      pseudo: user.pseudo,
      email: user.email,
      avatar: user.avatar || "",
      authMethod: user.method,
      uid: user.uid || "",
      newsletter: !!newsletter,
      createdAt: window.State.get("createdAt") || Date.now()
    });

    document.dispatchEvent(new CustomEvent("auth-login", { detail: user }));

    const adminEmails = (CFG.ADMIN_EMAILS || []).map(function(e) { return e.toLowerCase(); });
    const isAdmin = user.email && adminEmails.indexOf(user.email.toLowerCase()) !== -1;
    document.dispatchEvent(new CustomEvent("firebase-user-changed", {
      detail: { user: user, isAdmin: isAdmin }
    }));

    if (window.XP && window.XP.checkBadges) {
      try { window.XP.checkBadges(); } catch (e) { console.warn("checkBadges error:", e); }
    }
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function changePseudo(newPseudo) {
    if (!newPseudo || newPseudo.trim().length < 2) return { success: false, error: "Pseudo trop court" };
    if (window.State) window.State.set("pseudo", newPseudo.trim());
    return { success: true };
  }

  async function resetPassword(email) {
    const ok = await ensureBackend();
    if (!ok) return { success: false, error: "Backend non disponible" };
    return await window.FB.resetPassword(email);
  }

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
    validateEmail: validateEmail,
    resetPassword: resetPassword
  };
})();

window.Auth = Auth;
console.log("Auth (Supabase-ready) charge");
