/* =========================================================
   DAR AL LOUGHAH — CONFIGURATION (CORRIGÉE)
   ========================================================= */

const CONFIG = {
  APP_NAME: "Dar Al Loughah",
  APP_VERSION: "1.0.0",
  PREMIUM_PRICE: 7.99,
  PREMIUM_CURRENCY: "EUR",

  CONTACT_EMAIL: "ton-email@exemple.com",
  FORMSUBMIT_EMAIL: "ton-email@exemple.com",

  BACKEND_URL: "",

  GOOGLE_CLIENT_ID: "",
  APPLE_CLIENT_ID: "",

  FIREBASE: {
    apiKey: "AIzaSyCs8NKBBAwXQ9CGmA1tQ4BamgY9ZmPHhSE",
    authDomain: "dar-al-loughah.firebaseapp.com",
    projectId: "dar-al-loughah",
    storageBucket: "dar-al-loughah.firebasestorage.app",
    messagingSenderId: "237210972802",
    appId: "1:237210972802:web:e9e76a9c1ace0af4737a9b",
    measurementId: "G-TDFNFVHZBF"
  },

  ADMIN_EMAILS: [
    "daralloughah2@gmail.com",
    "hakimhakom543@gmail.com"
  ],

  STRIPE_PUBLIC_KEY: "",
  STRIPE_PAYMENT_LINK: "",
  PAYPAL_CLIENT_ID: "",
  PAYPAL_PAYMENT_LINK: "",

  AI_AGENT: {
    ENDPOINT: "",
    METHOD: "POST",
    HEADERS: {
      "Content-Type": "application/json"
    },
    SYSTEM_PROMPT: "Tu es Mouallim, un professeur d'arabe patient et bienveillant. Tu aides l'utilisateur a apprendre l'arabe. Reponds toujours brievement et corrige ses erreurs avec gentillesse.",
    USE_FALLBACK: true
  },

  GROQ_API_KEY: "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",
  GROQ_MODEL: "llama-3.1-8b-instant", // Corrigé : Llama-4 n'existe pas encore

  SUPPORTED_LANGUAGES: {
    fr: { name: "Français", code: "fr-FR", direction: "ltr" },
    ar: { name: "Arabe", code: "ar-SA", direction: "rtl" }
  },
  DEFAULT_LANGUAGE: "fr",

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

  SOUNDS: {
    TAP_VOLUME: 0.15,
    CORRECT_VOLUME: 0.25,
    WRONG_VOLUME: 0.20
  },

  STORAGE_KEY: "dar_al_loughah_v2",

  DATA_PATHS: {
    THEMES_INDEX: "data/themes.json",
    THEME_FILE: "data/themes/{id}.json",
    LETTERS: "data/letters.json",
    BADGES: "data/badges.json",
    WOTD: "data/wotd.json"
  },

  FEATURES: {
    VOICE_CHAT: true,
    SOCIAL_SHARE: false,
    OFFLINE_CACHE: true,
    LEADERBOARD: false,
    AMBIENT_SOUND: false,
    PREMIUM_VISIBLE: false,
    ADS_ENABLED: false
  }
};

window.CONFIG = CONFIG;
console.log("✓ Config chargée proprement");
