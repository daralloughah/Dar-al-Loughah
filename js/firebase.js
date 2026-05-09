/* =========================================================
   DAR AL LOUGHAH — FIREBASE CONNECTOR
   Pont entre l'app et Firebase (Firestore + Auth)
   ========================================================= */

const FB = (function() {

  let app = null;
  let db = null;
  let auth = null;
  let isReady = false;
  let readyCallbacks = [];

  /* =========================================================
     INITIALISATION
     ========================================================= */
  async function init() {
    if (isReady) return true;
    const cfg = window.CONFIG && window.CONFIG.FIREBASE;
    if (!cfg || !cfg.apiKey) {
      console.warn("⚠️ Firebase non configuré — mode local uniquement");
      return false;
    }

    try {
      // Charger les SDK Firebase via CDN
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js");
      const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js");
      const authModule = await import("https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js");

      app = initializeApp(cfg);
      db = firestoreModule.getFirestore(app);
      auth = authModule.getAuth(app);

      // Stocker les fonctions Firestore globalement
      window._firestoreFns = {
        collection: firestoreModule.collection,
        doc: firestoreModule.doc,
        getDoc: firestoreModule.getDoc,
        getDocs: firestoreModule.getDocs,
        setDoc: firestoreModule.setDoc,
        updateDoc: firestoreModule.updateDoc,
        deleteDoc: firestoreModule.deleteDoc,
        addDoc: firestoreModule.addDoc,
        query: firestoreModule.query,
        where: firestoreModule.where,
        orderBy: firestoreModule.orderBy,
        limit: firestoreModule.limit,
        onSnapshot: firestoreModule.onSnapshot,
        serverTimestamp: firestoreModule.serverTimestamp
      };

      // Stocker les fonctions Auth globalement
      window._authFns = {
        signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
        createUserWithEmailAndPassword: authModule.createUserWithEmailAndPassword,
        signOut: authModule.signOut,
        onAuthStateChanged: authModule.onAuthStateChanged,
        GoogleAuthProvider: authModule.GoogleAuthProvider,
        signInWithPopup: authModule.signInWithPopup,
        sendPasswordResetEmail: authModule.sendPasswordResetEmail
      };

      isReady = true;
      console.log("✅ Firebase initialisé");

      // Détecter quand l'utilisateur se connecte/déconnecte
      window._authFns.onAuthStateChanged(auth, function(user) {
        if (user) {
          const isAdmin = isUserAdmin(user.email);
          console.log("👤 Connecté:", user.email, isAdmin ? "(ADMIN)" : "");
          document.dispatchEvent(new CustomEvent("firebase-user-changed", {
            detail: { user: user, isAdmin: isAdmin }
          }));
        } else {
          document.dispatchEvent(new CustomEvent("firebase-user-changed", {
            detail: { user: null, isAdmin: false }
          }));
        }
      });

      readyCallbacks.forEach(function(cb) { try { cb(); } catch (e) {} });
      readyCallbacks = [];

      return true;
    } catch (e) {
      console.error("❌ Erreur init Firebase:", e);
      return false;
    }
  }

  function onReady(callback) {
    if (isReady) callback();
    else readyCallbacks.push(callback);
  }

  /* =========================================================
     ADMIN CHECK
     ========================================================= */
  function isUserAdmin(email) {
    if (!email) return false;
    const admins = (window.CONFIG && window.CONFIG.ADMIN_EMAILS) || [];
    return admins.indexOf(email.toLowerCase()) !== -1;
  }

  function isCurrentUserAdmin() {
    if (!auth || !auth.currentUser) return false;
    return isUserAdmin(auth.currentUser.email);
  }

  /* =========================================================
     AUTH
     ========================================================= */
  async function signIn(email, password) {
    if (!isReady) await init();
    try {
      const result = await window._authFns.signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (e) {
      return { success: false, error: translateError(e.code) };
    }
  }

  async function signUp(email, password) {
    if (!isReady) await init();
    try {
      const result = await window._authFns.createUserWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (e) {
      return { success: false, error: translateError(e.code) };
    }
  }

  async function signInGoogle() {
    if (!isReady) await init();
    try {
      const provider = new window._authFns.GoogleAuthProvider();
      const result = await window._authFns.signInWithPopup(auth, provider);
      return { success: true, user: result.user };
    } catch (e) {
      return { success: false, error: translateError(e.code) };
    }
  }

  async function signOutUser() {
    if (!isReady) return;
    try { await window._authFns.signOut(auth); } catch (e) {}
  }

  async function resetPassword(email) {
    if (!isReady) await init();
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
      "auth/email-already-in-use": "Cet email est déjà utilisé",
      "auth/invalid-email": "Email invalide",
      "auth/weak-password": "Mot de passe trop faible (min 6 caractères)",
      "auth/user-not-found": "Aucun compte avec cet email",
      "auth/wrong-password": "Mot de passe incorrect",
      "auth/invalid-credential": "Identifiants incorrects",
      "auth/too-many-requests": "Trop de tentatives, réessayez plus tard",
      "auth/network-request-failed": "Pas de connexion internet"
    };
    return errors[code] || "Erreur de connexion";
  }

  /* =========================================================
     FIRESTORE — LIRE
     ========================================================= */
  async function getCollection(collectionName) {
    if (!isReady) await init();
    if (!isReady) return null;
    try {
      const fns = window._firestoreFns;
      const snap = await fns.getDocs(fns.collection(db, collectionName));
      const items = [];
      snap.forEach(function(doc) {
        items.push({ _id: doc.id, ...doc.data() });
      });
      return items;
    } catch (e) {
      console.warn("Erreur getCollection:", collectionName, e.message);
      return null;
    }
  }

  async function getDocument(collectionName, docId) {
    if (!isReady) await init();
    if (!isReady) return null;
    try {
      const fns = window._firestoreFns;
      const ref = fns.doc(db, collectionName, docId);
      const snap = await fns.getDoc(ref);
      if (snap.exists()) {
        return { _id: snap.id, ...snap.data() };
      }
      return null;
    } catch (e) {
      console.warn("Erreur getDocument:", e.message);
      return null;
    }
  }

  /* =========================================================
     FIRESTORE — ÉCRIRE
     ========================================================= */
  async function setDocument(collectionName, docId, data) {
    if (!isReady) await init();
    if (!isReady) return false;
    try {
      const fns = window._firestoreFns;
      const ref = fns.doc(db, collectionName, docId);
      await fns.setDoc(ref, data, { merge: true });
      return true;
    } catch (e) {
      console.warn("Erreur setDocument:", e.message);
      return false;
    }
  }

  async function updateDocument(collectionName, docId, data) {
    if (!isReady) await init();
    if (!isReady) return false;
    try {
      const fns = window._firestoreFns;
      const ref = fns.doc(db, collectionName, docId);
      await fns.updateDoc(ref, data);
      return true;
    } catch (e) {
      console.warn("Erreur updateDocument:", e.message);
      return false;
    }
  }

  async function deleteDocument(collectionName, docId) {
    if (!isReady) await init();
    if (!isReady) return false;
    try {
      const fns = window._firestoreFns;
      const ref = fns.doc(db, collectionName, docId);
      await fns.deleteDoc(ref);
      return true;
    } catch (e) {
      console.warn("Erreur deleteDocument:", e.message);
      return false;
    }
  }

  async function addDocument(collectionName, data) {
    if (!isReady) await init();
    if (!isReady) return null;
    try {
      const fns = window._firestoreFns;
      const ref = await fns.addDoc(fns.collection(db, collectionName), data);
      return ref.id;
    } catch (e) {
      console.warn("Erreur addDocument:", e.message);
      return null;
    }
  }

  /* =========================================================
     INIT AUTOMATIQUE AU DEMARRAGE
     ========================================================= */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* -------- API publique -------- */
  return {
    init: init,
    onReady: onReady,
    isReady: function() { return isReady; },
    isUserAdmin: isUserAdmin,
    isCurrentUserAdmin: isCurrentUserAdmin,
    getCurrentUser: getCurrentUser,
    // Auth
    signIn: signIn,
    signUp: signUp,
    signInGoogle: signInGoogle,
    signOut: signOutUser,
    resetPassword: resetPassword,
    // Firestore
    getCollection: getCollection,
    getDocument: getDocument,
    setDocument: setDocument,
    updateDocument: updateDocument,
    deleteDocument: deleteDocument,
    addDocument: addDocument
  };
})();

window.FB = FB;
console.log("✓ Firebase connector chargé");
