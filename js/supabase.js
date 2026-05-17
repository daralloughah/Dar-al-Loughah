/* =========================================================
   DAR AL LOUGHAH — CONNECTEUR SUPABASE
   Remplace l'ancien firebase.js
   100% cloud, zéro localStorage
   API publique identique pour ne rien casser ailleurs
   ========================================================= */

const FB = (function() {

  // ===== CONFIGURATION =====
  const SUPABASE_URL = "https://gnchedfcmvnbrwsnkhjq.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Ij9OSzWJ9haOpI5NAmThoQ_UXVY3jnF";
  const ADMIN_EMAILS = ["daralloughah2@gmail.com", "hakimhakom543@gmail.com"];

  // ===== ÉTAT INTERNE =====
  let supabase = null;
  let isReady = false;
  let readyCallbacks = [];
  let initPromise = null;
  let currentUser = null;

  // ===== MAPPING DES NOMS DE COLLECTIONS =====
  // Firebase utilisait des noms, Supabase utilise des tables avec d'autres noms
  function mapCollectionName(name) {
    const mapping = {
      "users": "profiles",
      "badges": "badges_content",
      "officialLists": "official_lists"
    };
    return mapping[name] || name;
  }

  // ===== AFFICHAGE D'ERREUR FATALE =====
  function showFatalError(msg) {
    document.body.innerHTML =
      '<div style="padding:40px;color:#fff;background:#0a1535;font-family:sans-serif;min-height:100vh;text-align:center">' +
      '<h2 style="color:#D4AF37">Erreur Supabase</h2>' +
      '<p style="margin-top:20px;color:#ccc">' + msg + '</p>' +
      '<p style="margin-top:30px;font-size:13px;color:#888">Rechargez la page ou contactez l\'administrateur.</p>' +
      '</div>';
  }

  // ===== INITIALISATION =====
  async function init() {
    if (isReady) return true;
    if (initPromise) return initPromise;

    initPromise = (async function() {
      try {
        // Chargement dynamique du SDK Supabase depuis CDN
        const mod = await import("https://esm.sh/@supabase/supabase-js@2");
        supabase = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });

        // Récupère la session existante au chargement
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData && sessionData.session) {
          currentUser = sessionData.session.user;
        }

        // Écoute les changements d'auth (login/logout)
        supabase.auth.onAuthStateChange(function(event, session) {
          currentUser = session ? session.user : null;
          const adapted = adaptUser(currentUser);
          const admin = adapted ? isUserAdmin(adapted.email) : false;
          document.dispatchEvent(new CustomEvent("firebase-user-changed", {
            detail: { user: adapted, isAdmin: admin }
          }));
        });

        isReady = true;
        console.log("Supabase initialisé");

        // Dispatch initial si user déjà connecté
        if (currentUser) {
          const adapted = adaptUser(currentUser);
          const admin = isUserAdmin(adapted.email);
          document.dispatchEvent(new CustomEvent("firebase-user-changed", {
            detail: { user: adapted, isAdmin: admin }
          }));
        }

        readyCallbacks.forEach(function(cb) {
          try { cb(); } catch (e) { console.error(e); }
        });
        readyCallbacks = [];

        return true;
      } catch (e) {
        showFatalError("Impossible de charger Supabase : " + (e.message || e));
        throw e;
      }
    })();

    return initPromise;
  }

  // ===== ADAPTATEUR USER SUPABASE -> FORMAT FIREBASE =====
  // Pour rester compatible avec auth.js et le reste du code
  function adaptUser(supaUser) {
    if (!supaUser) return null;
    return {
      uid: supaUser.id,
      email: supaUser.email,
      displayName: (supaUser.user_metadata && supaUser.user_metadata.pseudo) || (supaUser.email ? supaUser.email.split("@")[0] : ""),
      photoURL: (supaUser.user_metadata && supaUser.user_metadata.avatar_url) || ""
    };
  }

  // ===== HELPERS =====
  function onReady(cb) {
    if (isReady) cb();
    else readyCallbacks.push(cb);
  }

  function isUserAdmin(email) {
    if (!email) return false;
    const lower = email.toLowerCase();
    return ADMIN_EMAILS.map(function(e) { return e.toLowerCase(); }).indexOf(lower) !== -1;
  }

  function isCurrentUserAdmin() {
    if (!currentUser) return false;
    return isUserAdmin(currentUser.email);
  }

  function getCurrentUser() {
    return adaptUser(currentUser);
  }

  // ===== AUTHENTIFICATION : EMAIL =====
  async function signIn(email, password) {
    await init();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email, password: password });
      if (error) return { success: false, error: translateError(error.message) };
      return { success: true, user: adaptUser(data.user) };
    } catch (e) {
      return { success: false, error: translateError(e.message) };
    }
  }

  async function signUp(email, password) {
    await init();
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password
      });
      if (error) return { success: false, error: translateError(error.message) };
      return { success: true, user: adaptUser(data.user) };
    } catch (e) {
      return { success: false, error: translateError(e.message) };
    }
  }

  async function signInGoogle() {
    return { success: false, error: "Google login pas encore configuré" };
  }

  async function signOutUser() {
    await init();
    try {
      await supabase.auth.signOut();
      currentUser = null;
    } catch (e) {
      console.warn("Erreur signOut:", e);
    }
  }

  async function resetPassword(email) {
    await init();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { success: false, error: translateError(error.message) };
      return { success: true };
    } catch (e) {
      return { success: false, error: translateError(e.message) };
    }
  }

  // ===== TRADUCTION DES ERREURS =====
  function translateError(msg) {
    if (!msg) return "Erreur inconnue";
    const m = msg.toLowerCase();
    if (m.includes("invalid login credentials")) return "Identifiants incorrects";
    if (m.includes("invalid email")) return "Email invalide";
    if (m.includes("user already registered") || m.includes("already exists")) return "Cet email est déjà utilisé";
    if (m.includes("weak password") || m.includes("password should be")) return "Mot de passe trop faible (min 6 caractères, majuscules + minuscules + chiffres)";
    if (m.includes("email not confirmed")) return "Email non confirmé, vérifiez votre boîte mail";
    if (m.includes("user not found")) return "Aucun compte avec cet email";
    if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives, réessayez plus tard";
    if (m.includes("network") || m.includes("fetch")) return "Pas de connexion internet";
    return "Erreur : " + msg;
  }

  // ===== CRUD GÉNÉRIQUE =====
  async function getCollection(name) {
    await init();
    const table = mapCollectionName(name);
    const { data, error } = await supabase.from(table).select("*");
    if (error) { console.warn("getCollection error:", error); return []; }
    return (data || []).map(function(row) {
      return Object.assign({ _id: row.id }, row);
    });
  }

  async function getDocument(name, id) {
    await init();
    const table = mapCollectionName(name);
    const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) { console.warn("getDocument error:", error); return null; }
    if (!data) return null;
    return Object.assign({ _id: data.id }, data);
  }

  async function setDocument(name, id, data) {
    await init();
    const table = mapCollectionName(name);
    const payload = Object.assign({}, data, { id: id });
    const { error } = await supabase.from(table).upsert(payload);
    if (error) {
      console.warn("setDocument error:", error);
      var err = new Error(error.message || JSON.stringify(error));
      err.supabaseCode = error.code;
      err.supabaseDetails = error.details;
      throw err;
    }
    return true;
  }

  async function updateDocument(name, id, data) {
    await init();
    const table = mapCollectionName(name);
    const { error } = await supabase.from(table).update(data).eq("id", id);
    if (error) { console.warn("updateDocument error:", error); return false; }
    return true;
  }

  async function deleteDocument(name, id) {
    await init();
    const table = mapCollectionName(name);
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) { console.warn("deleteDocument error:", error); return false; }
    return true;
  }

  async function addDocument(name, data) {
    await init();
    const table = mapCollectionName(name);
    const { data: result, error } = await supabase.from(table).insert(data).select("id").single();
    if (error) { console.warn("addDocument error:", error); return null; }
    return result ? result.id : null;
  }

  // ===== ACCÈS AU CLIENT SUPABASE NATIF =====
  // Pour le cloud-sync et les leaderboards temps réel
  function getClient() {
    return supabase;
  }

  // ===== INIT AUTO AU CHARGEMENT =====
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { init(); });
  } else {
    init();
  }

  // ===== API PUBLIQUE (identique à l'ancien firebase.js) =====
  return {
    init: init,
    onReady: onReady,
    isReady: function() { return isReady; },
    isUserAdmin: isUserAdmin,
    isCurrentUserAdmin: isCurrentUserAdmin,
    getCurrentUser: getCurrentUser,
    signIn: signIn,
    signUp: signUp,
    signInGoogle: signInGoogle,
    signOut: signOutUser,
    resetPassword: resetPassword,
    getCollection: getCollection,
    getDocument: getDocument,
    setDocument: setDocument,
    updateDocument: updateDocument,
    deleteDocument: deleteDocument,
    addDocument: addDocument,
    getClient: getClient
  };
})();

window.FB = FB;
console.log("Supabase connector chargé");
