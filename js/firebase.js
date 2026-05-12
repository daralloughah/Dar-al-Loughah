const FB = (function() {

  let app = null;
  let db = null;
  let auth = null;
  let isReady = false;
  let readyCallbacks = [];
  let initPromise = null;

  function showFatalError(msg) {
    document.body.innerHTML =
      "<div style=\"padding:40px;color:#fff;background:#0a1535;font-family:sans-serif;min-height:100vh;text-align:center\">" +
      "<h2 style=\"color:#D4AF37\">Erreur Firebase</h2>" +
      "<p style=\"margin-top:20px;color:#ccc\">" + msg + "</p>" +
      "<p style=\"margin-top:30px;font-size:13px;color:#888\">Rechargez la page ou contactez l'administrateur.</p>" +
      "</div>";
  }

  async function init() {
    if (isReady) return true;
    if (initPromise) return initPromise;

    initPromise = (async function() {
      const cfg = window.CONFIG && window.CONFIG.FIREBASE;
      if (!cfg || !cfg.apiKey) {
        showFatalError("Configuration Firebase manquante dans config.js");
        throw new Error("Firebase configuration manquante");
      }

      try {
        const appMod = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js");
        const fsMod = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
        const authMod = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js");

        app = appMod.initializeApp(cfg);
        db = fsMod.getFirestore(app);
        auth = authMod.getAuth(app);

        window._firestoreFns = {
          collection: fsMod.collection, doc: fsMod.doc,
          getDoc: fsMod.getDoc, getDocs: fsMod.getDocs,
          setDoc: fsMod.setDoc, updateDoc: fsMod.updateDoc,
          deleteDoc: fsMod.deleteDoc, addDoc: fsMod.addDoc,
          query: fsMod.query, where: fsMod.where,
          orderBy: fsMod.orderBy, limit: fsMod.limit,
          onSnapshot: fsMod.onSnapshot,
          serverTimestamp: fsMod.serverTimestamp
        };

        window._authFns = {
          signInWithEmailAndPassword: authMod.signInWithEmailAndPassword,
          createUserWithEmailAndPassword: authMod.createUserWithEmailAndPassword,
          signOut: authMod.signOut,
          onAuthStateChanged: authMod.onAuthStateChanged,
          GoogleAuthProvider: authMod.GoogleAuthProvider,
          signInWithPopup: authMod.signInWithPopup,
          signInWithRedirect: authMod.signInWithRedirect,
          getRedirectResult: authMod.getRedirectResult,
          sendPasswordResetEmail: authMod.sendPasswordResetEmail
        };

        isReady = true;
        console.log("Firebase initialise");

        window._authFns.onAuthStateChanged(auth, function(user) {
          if (user) {
            const isAdmin = isUserAdmin(user.email);
            document.dispatchEvent(new CustomEvent("firebase-user-changed", {
              detail: { user: user, isAdmin: isAdmin }
            }));
          } else {
            document.dispatchEvent(new CustomEvent("firebase-user-changed", {
              detail: { user: null, isAdmin: false }
            }));
          }
        });

        readyCallbacks.forEach(function(cb) {
          try { cb(); } catch (e) { console.error(e); }
        });
        readyCallbacks = [];

        return true;
      } catch (e) {
        showFatalError("Impossible de charger Firebase : " + (e.message || e));
        throw e;
      }
    })();

    return initPromise;
  }

  function onReady(cb) {
    if (isReady) cb();
    else readyCallbacks.push(cb);
  }

  function isUserAdmin(email) {
    if (!email) return false;
    const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
    return admins.map(function(e) { return e.toLowerCase(); }).indexOf(email.toLowerCase()) !== -1;
  }

  function isCurrentUserAdmin() {
    if (!auth || !auth.currentUser) return false;
    return isUserAdmin(auth.currentUser.email);
  }

  async function signIn(email, password) {
    await init();
    try {
      const result = await window._authFns.signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (e) {
      return { success: false, error: translateError(e.code) };
    }
  }

  async function signUp(email, password) {
    await init();
    try {
      const result = await window._authFns.createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (e) {
      return { success: false, error: translateError(e.code) };
    }
  }

  async function signInGoogle() {
    await init();
    try {
      const provider = new window._authFns.GoogleAuthProvider();
      const result = await window._authFns.signInWithPopup(auth, provider);
      return { success: true, user: result.user };
    } catch (e) {
      return { success: false, error: translateError(e.code) };
    }
  }

  async function signOutUser() {
    await init();
    try { await window._authFns.signOut(auth); } catch (e) {}
  }

  async function resetPassword(email) {
    await init();
    try {
      await window._authFns.sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (e) {
      return { success: false, error: translateError(e.code) };
    }
  }

  function getCurrentUser() {
    return auth ? auth.currentUser : null;
  }

  function translateError(code) {
    const errors = {
      "auth/email-already-in-use": "Cet email est deja utilise",
      "auth/invalid-email": "Email invalide",
      "auth/weak-password": "Mot de passe trop faible (min 6 caracteres)",
      "auth/user-not-found": "Aucun compte avec cet email",
      "auth/wrong-password": "Mot de passe incorrect",
      "auth/invalid-credential": "Identifiants incorrects",
      "auth/too-many-requests": "Trop de tentatives, reessayez plus tard",
      "auth/network-request-failed": "Pas de connexion internet",
      "auth/popup-blocked": "Popup bloquee, autorisez les popups",
      "auth/popup-closed-by-user": "Connexion annulee"
    };
    return errors[code] || ("Erreur : " + code);
  }

  async function getCollection(name) {
    await init();
    const fns = window._firestoreFns;
    const snap = await fns.getDocs(fns.collection(db, name));
    const items = [];
    snap.forEach(function(d) { items.push(Object.assign({ _id: d.id }, d.data())); });
    return items;
  }

  async function getDocument(name, id) {
    await init();
    const fns = window._firestoreFns;
    const ref = fns.doc(db, name, id);
    const snap = await fns.getDoc(ref);
    if (snap.exists()) return Object.assign({ _id: snap.id }, snap.data());
    return null;
  }

  async function setDocument(name, id, data) {
    await init();
    const fns = window._firestoreFns;
    const ref = fns.doc(db, name, id);
    await fns.setDoc(ref, data, { merge: true });
    return true;
  }

  async function updateDocument(name, id, data) {
    await init();
    const fns = window._firestoreFns;
    const ref = fns.doc(db, name, id);
    await fns.setDoc(ref, data, { merge: true });
    return true;
  }

  async function deleteDocument(name, id) {
    await init();
    const fns = window._firestoreFns;
    const ref = fns.doc(db, name, id);
    await fns.deleteDoc(ref);
    return true;
  }

  async function addDocument(name, data) {
    await init();
    const fns = window._firestoreFns;
    const ref = await fns.addDoc(fns.collection(db, name), data);
    return ref.id;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() { init(); });
  } else {
    init();
  }

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
    addDocument: addDocument
  };
})();

window.FB = FB;
console.log("Firebase connector charge");
