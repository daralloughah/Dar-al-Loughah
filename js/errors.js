/* =========================================================
   DAR AL LOUGHAH - GESTION D'ERREURS GLOBALE
   Capture toutes les erreurs JS + promesses rejetees
   Affiche un toast utilisateur + log dans Firestore
   ========================================================= */

const ErrorTracker = (function() {

  let initialized = false;
  let errorQueue = [];
  let lastErrorTime = 0;
  let lastErrorMessage = "";

  // Traduction technique -> francais clair
  const ERROR_TRANSLATIONS = {
    "Network request failed": "Pas de connexion internet",
    "Failed to fetch": "Probleme de connexion au serveur",
    "auth/network-request-failed": "Pas de connexion internet",
    "auth/too-many-requests": "Trop de tentatives, reessayez plus tard",
    "auth/user-not-found": "Compte introuvable",
    "auth/wrong-password": "Mot de passe incorrect",
    "auth/invalid-credential": "Identifiants incorrects",
    "auth/email-already-in-use": "Email deja utilise",
    "auth/popup-blocked": "Popup bloquee par le navigateur",
    "auth/popup-closed-by-user": "Connexion annulee",
    "permission-denied": "Permissions insuffisantes",
    "not-found": "Contenu introuvable",
    "unavailable": "Service indisponible, reessayez",
    "deadline-exceeded": "Le serveur met trop de temps a repondre",
    "cancelled": "Operation annulee",
    "quota-exceeded": "Limite quotidienne atteinte",
    "unauthenticated": "Vous devez etre connecte"
  };

  function translateError(message) {
    if (!message) return "Erreur inconnue";
    const msgStr = String(message);
    for (const key in ERROR_TRANSLATIONS) {
      if (msgStr.indexOf(key) !== -1) return ERROR_TRANSLATIONS[key];
    }
    return msgStr.length > 60 ? msgStr.substring(0, 60) + "..." : msgStr;
  }

  function showErrorToast(message) {
    const userMsg = translateError(message);
    if (window.Main && window.Main.toast) {
      window.Main.toast("Erreur : " + userMsg, 4000);
    }
  }

  async function logToFirestore(errorData) {
    if (!window.FB || !window.FB.isReady || !window.FB.isReady()) {
      errorQueue.push(errorData);
      return;
    }
    try {
      await window.FB.addDocument("error_logs", errorData);
    } catch (e) {
      console.warn("Impossible de logger l'erreur dans Firestore:", e);
    }
  }

  function buildErrorData(error, source) {
    const user = window.State ? {
      pseudo: window.State.get("pseudo") || "Anonyme",
      email: window.State.get("email") || "",
      isAdmin: window.State.isAdmin ? window.State.isAdmin() : false
    } : { pseudo: "Avant init", email: "", isAdmin: false };

    return {
      source: source,
      message: error.message || String(error) || "Erreur inconnue",
      messageUserFr: translateError(error.message || String(error)),
      stack: (error.stack || "").substring(0, 1000),
      filename: error.filename || "",
      lineno: error.lineno || 0,
      colno: error.colno || 0,
      url: location.href,
      userAgent: navigator.userAgent.substring(0, 200),
      screen: window.Main && window.Main.getCurrentScreen ? window.Main.getCurrentScreen() : "",
      user: user,
      timestamp: Date.now(),
      date: new Date().toISOString()
    };
  }

  function handleError(error, source) {
    const now = Date.now();
    const message = error.message || String(error);
    if (message === lastErrorMessage && (now - lastErrorTime) < 2000) return;
    lastErrorMessage = message;
    lastErrorTime = now;

    console.error("[" + source + "]", error);
    const data = buildErrorData(error, source);
    showErrorToast(data.message);
    logToFirestore(data);
  }

  function flushQueue() {
    if (errorQueue.length === 0) return;
    const queue = errorQueue.slice();
    errorQueue = [];
    queue.forEach(function(data) { logToFirestore(data); });
  }

  function init() {
    if (initialized) return;
    initialized = true;

    window.addEventListener("error", function(event) {
      handleError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error ? event.error.stack : ""
      }, "window.error");
    });

    window.addEventListener("unhandledrejection", function(event) {
      const reason = event.reason || {};
      handleError({
        message: reason.message || String(reason),
        stack: reason.stack || ""
      }, "promise.rejection");
    });

    const tryFlush = setInterval(function() {
      if (window.FB && window.FB.isReady && window.FB.isReady()) {
        flushQueue();
        clearInterval(tryFlush);
      }
    }, 1000);

    console.log("ErrorTracker initialise");
  }

  function reportManual(message, context) {
    handleError({
      message: message,
      stack: new Error().stack
    }, context || "manual");
  }

  init();

  return {
    report: reportManual,
    translateError: translateError
  };
})();

window.ErrorTracker = ErrorTracker;
