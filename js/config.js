/* =========================================================
   DAR AL LOUGHAH — CONFIGURATION
   C'est ICI que tu mets tes réglages personnels.
   Tu peux laisser vide au début, l'app marchera quand même.
   ========================================================= */

const CONFIG = {

  // ===========================================
  // 📌 INFORMATIONS DE BASE
  // ===========================================
  APP_NAME: "Dar Al Loughah",
  APP_VERSION: "1.0.0",
  PREMIUM_PRICE: 7.99,
  PREMIUM_CURRENCY: "€",

  // ===========================================
  // 📧 TON EMAIL POUR RECEVOIR LES CONTACTS
  // Quand un utilisateur te contacte, ça va arriver ici
  // ===========================================
  CONTACT_EMAIL: "ton-email@exemple.com",

  // Service gratuit pour recevoir les emails sans backend.
  // Va sur https://formsubmit.co et entre ton email,
  // ils t'enverront un email de confirmation.
  FORMSUBMIT_EMAIL: "ton-email@exemple.com",

  // ===========================================
  // 🌐 BACKEND (laisse vide pour utiliser les fichiers JSON locaux)
  // Plus tard, quand tu auras un serveur, mets son URL ici
  // ===========================================
  BACKEND_URL: "",

    // ===========================================
  // 🔐 AUTHENTIFICATION
  // ===========================================
  GOOGLE_CLIENT_ID: "",
  APPLE_CLIENT_ID: "",

  // ===========================================
  // 🔥 FIREBASE (backend gratuit Google)
  // ===========================================
  FIREBASE: {
    apiKey: "AIzaSyCs8NKBBAwXQ9CGmA1tQ4BamgY9ZmPHhSE",
    authDomain: "dar-al-loughah.firebaseapp.com",
    projectId: "dar-al-loughah",
    storageBucket: "dar-al-loughah.firebasestorage.app",
    messagingSenderId: "237210972802",
    appId: "1:237210972802:web:e9e76a9c1ace0af4737a9b",
    measurementId: "G-TDFNFVHZBF"
  },

  // ===========================================
  // 👑 EMAILS ADMIN (reconnu auto admin)
  // ===========================================
  ADMIN_EMAILS: [
    "daralloughah2@gmail.com",
    "hakimhakom543@gmail.com"
     // Ajouter d'autres emails admin ici si besoin
  ],


  // ===========================================
  // 💳 PAIEMENTS
  // ===========================================
  STRIPE_PUBLIC_KEY: "",
  STRIPE_PAYMENT_LINK: "",
  PAYPAL_CLIENT_ID: "",
  PAYPAL_PAYMENT_LINK: "",

  // ===========================================
  // 🤖 AGENT IA POUR LE CHAT
  // ===========================================
  AI_AGENT: {
    ENDPOINT: "",
    METHOD: "POST",
    HEADERS: {
      "Content-Type": "application/json"
    },
    SYSTEM_PROMPT: "Tu es Mouallim, un professeur d'arabe patient et bienveillant. Tu aides l'utilisateur à apprendre l'arabe. Réponds toujours brièvement et corrige ses erreurs avec gentillesse.",
    USE_FALLBACK: true
  },

  // ===========================================
  // 🧠 IA - GROQ (Llama 4) - AJOUTÉ ICI ✅
  // ===========================================
  GROQ_API_KEY: "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", 
  GROQ_MODEL: "llama-4-scout-8b-instruct", 

  // ===========================================
  // 🎤 LANGUES SUPPORTÉES
  // ===========================================
  SUPPORTED_LANGUAGES: {
    fr: { name: "Français", code: "fr-FR", direction: "ltr" },
    ar: { name: "Arabe", code: "ar-SA", direction: "rtl" }
  },
  DEFAULT_LANGUAGE: "fr",

  // ===========================================
  // 🎮 GAMIFICATION
  // ===========================================
  XP: {
    QCM_CORRECT: 10,
    RAPID_BASE: 5,
    RAPID_COMBO_BONUS: 2,
    RAPID_COMBO_MAX: 20,
    WORD_KNOWN: 10,
    LETTER_LEARNED: 15,
    READING_MILESTONE: 50,
    PREMIUM_MULTIPLIER: 2
  },

  WORD_MASTERY_REVIEWS: 10,
  CHAT_DAILY_LIMIT: 10,
  STREAK_RESET_HOURS: 36,
  MOUALLIM_THRESHOLD: 12000,

  // ===========================================
  // 🔊 SONS (générés par Web Audio, pas de fichiers à charger)
  // ===========================================
  SOUNDS: {
    TAP_VOLUME: 0.15,
    CORRECT_VOLUME: 0.25,
    WRONG_VOLUME: 0.20
  },

  // ===========================================
  // 📦 STOCKAGE LOCAL
  // ===========================================
  STORAGE_KEY: "dar_al_loughah_v2",

  // ===========================================
  // 📂 CHEMINS VERS LES DONNÉES
  // ===========================================
  DATA_PATHS: {
    THEMES_INDEX: "data/themes.json",
    THEME_FILE: "data/themes/{id}.json",
    LETTERS: "data/letters.json",
    BADGES: "data/badges.json",
    WOTD: "data/wotd.json"
  },

  // ===========================================
  // 🚩 FONCTIONNALITÉS ON / OFF
  // Active ou désactive des features
  // ===========================================
  FEATURES: {
    VOICE_CHAT: true,
    SOCIAL_SHARE: false,
    OFFLINE_CACHE: true,
    LEADERBOARD: false,
    AMBIENT_SOUND: false
  }
};

// Ne pas toucher à ce qui est en dessous, c'est utilisé par les autres fichiers
window.CONFIG = CONFIG;
console.log("✓ Config chargée :", CONFIG.APP_NAME, "v" + CONFIG.APP_VERSION);
