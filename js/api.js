/* =========================================================
   DAR AL LOUGHAH — API LAYER
   Communique avec :
   - les fichiers JSON locaux (data/*.json) en mode hors-ligne
   - ton backend distant (si CONFIG.BACKEND_URL est rempli)
   - Formsubmit (pour les contacts sans backend)
   ========================================================= */

const Api = (function() {

  const CFG = window.CONFIG || {};
  const cache = {}; // mémoire pour ne pas refetcher la même chose

  /* =========================================================
     UTILS
     ========================================================= */
  function isOnline() {
    return navigator.onLine !== false;
  }

  function hasBackend() {
    return CFG.BACKEND_URL && CFG.BACKEND_URL.length > 0;
  }

  // Charge un JSON depuis une URL avec cache
  async function fetchJSON(url, options) {
    options = options || {};
    const cacheKey = url + JSON.stringify(options);

    // Cache local en mémoire
    if (!options.noCache && cache[cacheKey]) {
      return cache[cacheKey];
    }

    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      cache[cacheKey] = data;
      return data;
    } catch (e) {
      console.warn("Échec fetch :", url, e.message);
      return null;
    }
  }

  /* =========================================================
     THÈMES
     ========================================================= */
  async function getThemesIndex() {
    // 1. PRIORITÉ Firebase
    if (window.FB && window.FB.isReady && window.FB.isReady()) {
      const data = await window.FB.getCollection("themes");
      if (data && data.length > 0) {
        // Trier par order
        data.sort(function(a, b) { return (a.order || 99) - (b.order || 99); });
        console.log("✓ Thèmes chargés depuis Firebase:", data.length);
        return data;
      }
    }
    // 2. Fallback backend distant
    if (hasBackend() && isOnline()) {
      const data = await fetchJSON(CFG.BACKEND_URL + "/themes");
      if (data) return data;
    }
    // 3. Fallback fichier JSON local
    const localPath = (CFG.DATA_PATHS && CFG.DATA_PATHS.THEMES_INDEX) || "data/themes.json";
    const data = await fetchJSON(localPath);
    if (data) return data;
    // 4. Fallback ultime
    return getDefaultThemes();
  }
 
  /* =========================================================
     LETTRES (alphabet)
     ========================================================= */
  async function getLetters() {
    if (hasBackend() && isOnline()) {
      const data = await fetchJSON(CFG.BACKEND_URL + "/letters");
      if (data) return data;
    }
    const localPath = (CFG.DATA_PATHS && CFG.DATA_PATHS.LETTERS) || "data/letters.json";
    const data = await fetchJSON(localPath);
    if (data) return data;
    return getDefaultLetters();
  }

  /* =========================================================
     BADGES
     ========================================================= */
  async function getBadges() {
    if (hasBackend() && isOnline()) {
      const data = await fetchJSON(CFG.BACKEND_URL + "/badges");
      if (data) return data;
    }
    const localPath = (CFG.DATA_PATHS && CFG.DATA_PATHS.BADGES) || "data/badges.json";
    const data = await fetchJSON(localPath);
    if (data) return data;
    return getDefaultBadges();
  }

  /* =========================================================
     MOT DU JOUR
     ========================================================= */
  async function getWordOfTheDay() {
    if (hasBackend() && isOnline()) {
      const data = await fetchJSON(CFG.BACKEND_URL + "/wotd");
      if (data) return data;
    }
    const localPath = (CFG.DATA_PATHS && CFG.DATA_PATHS.WOTD) || "data/wotd.json";
    const data = await fetchJSON(localPath);
    if (data && Array.isArray(data) && data.length > 0) {
      const idx = new Date().getDate() % data.length;
      return data[idx];
    }
    return getDefaultWotd();
  }

  /* =========================================================
     CONTACT (formulaire)
     ========================================================= */
  async function sendContact(payload) {
    // Option 1 : backend perso
    if (hasBackend() && isOnline()) {
      try {
        const res = await fetch(CFG.BACKEND_URL + "/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) return { success: true, method: "backend" };
      } catch (e) {}
    }

    // Option 2 : Formsubmit (gratuit, juste avec ton email)
    const fsEmail = CFG.FORMSUBMIT_EMAIL || CFG.CONTACT_EMAIL;
    if (fsEmail && fsEmail.indexOf("@") > 0 && fsEmail !== "ton-email@exemple.com") {
      try {
        const formData = new FormData();
        formData.append("name", payload.name || "");
        formData.append("email", payload.email || "");
        formData.append("subject", payload.subject || "Contact Dar Al Loughah");
        formData.append("message", payload.message || "");
        formData.append("_subject", "Nouveau message — Dar Al Loughah");
        formData.append("_template", "table");

        const res = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(fsEmail), {
          method: "POST",
          body: formData
        });
        if (res.ok) return { success: true, method: "formsubmit" };
      } catch (e) {}
    }

    // Option 3 : mailto fallback
    try {
      const target = CFG.CONTACT_EMAIL || "contact@dar-al-loughah.com";
      const subject = encodeURIComponent("[" + (payload.subject || "Contact") + "] de " + (payload.name || ""));
      const body = encodeURIComponent(
        "Nom : " + (payload.name || "") + "\n" +
        "Email : " + (payload.email || "") + "\n\n" +
        (payload.message || "")
      );
      window.location.href = "mailto:" + target + "?subject=" + subject + "&body=" + body;
      return { success: true, method: "mailto" };
    } catch (e) {
      return { success: false, error: "Aucune méthode de contact disponible" };
    }
  }

  /* =========================================================
     NEWSLETTER
     ========================================================= */
  async function subscribeNewsletter(email, pseudo) {
    if (hasBackend() && isOnline()) {
      try {
        const res = await fetch(CFG.BACKEND_URL + "/newsletter/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, pseudo: pseudo, date: Date.now() })
        });
        if (res.ok) return { success: true };
      } catch (e) {}
    }
    // Fallback : utiliser Formsubmit
    const fsEmail = CFG.FORMSUBMIT_EMAIL || CFG.CONTACT_EMAIL;
    if (fsEmail && fsEmail.indexOf("@") > 0 && fsEmail !== "ton-email@exemple.com") {
      try {
        const formData = new FormData();
        formData.append("email", email);
        formData.append("pseudo", pseudo || "");
        formData.append("_subject", "Nouvelle inscription newsletter — Dar Al Loughah");
        await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(fsEmail), {
          method: "POST",
          body: formData
        });
        return { success: true };
      } catch (e) {}
    }
    return { success: false };
  }

  /* =========================================================
     PROGRESSION (sync utilisateur si backend)
     ========================================================= */
  async function syncProgress(userData) {
    if (!hasBackend() || !isOnline()) return { success: false, offline: true };
    try {
      const res = await fetch(CFG.BACKEND_URL + "/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      });
      if (res.ok) return { success: true };
    } catch (e) {}
    return { success: false };
  }

  /* =========================================================
     IA CHAT (proxy)
     ========================================================= */
  async function sendToAI(message, history) {
    const ai = CFG.AI_AGENT || {};
    if (ai.ENDPOINT) {
      try {
        const res = await fetch(ai.ENDPOINT, {
          method: ai.METHOD || "POST",
          headers: ai.HEADERS || { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: message,
            history: history || [],
            systemPrompt: ai.SYSTEM_PROMPT || ""
          })
        });
        if (res.ok) {
          const data = await res.json();
          return { success: true, reply: data.reply || data.message || data.text || JSON.stringify(data) };
        }
      } catch (e) {
        console.warn("Erreur agent IA :", e.message);
      }
    }
    // Fallback local
    return { success: true, reply: getFallbackAIReply(message), fallback: true };
  }

  function getFallbackAIReply(message) {
    const t = (message || "").toLowerCase();
    if (t.includes("مرحبا") || t.includes("marhaba") || t.includes("bonjour") || t.includes("salut") || t.includes("salam")) {
      return "أهلاً وسهلاً ! Comment puis-je t'aider aujourd'hui ?";
    }
    if (t.includes("merci") || t.includes("شكر")) {
      return "عفواً ! (De rien !) Continue, tu progresses bien.";
    }
    if (t.includes("où") || t.includes("اين") || t.includes("ou")) {
      return "إلى أين تذهب ؟ (Où vas-tu ?) — Réponds en arabe si tu peux !";
    }
    if (t.includes("?") || t.includes("؟")) {
      return "C'est une bonne question ! Essaie de la formuler en arabe : commence par كيف (kayfa = comment) ou متى (mata = quand).";
    }
    return "جميل ! Essaie de construire une phrase complète en arabe. Je suis là pour te corriger.";
  }

  /* =========================================================
     PAIEMENTS (vérification)
     ========================================================= */
  async function verifyPayment(reference) {
    if (!hasBackend() || !isOnline()) {
      return { success: true, verified: true, mock: true };
    }
    try {
      const res = await fetch(CFG.BACKEND_URL + "/payments/verify/" + reference);
      if (res.ok) return await res.json();
    } catch (e) {}
    return { success: false };
  }

  /* =========================================================
     FALLBACKS — données minimales si rien trouvé
     ========================================================= */
  function getDefaultThemes() {
    return [
      { id: "quotidien",  name: "Les Mots du Quotidien", nameAr: "الحياة اليومية",  icon: "💬", description: "Les expressions essentielles" },
      { id: "creation",   name: "La Création",           nameAr: "الخلق",          icon: "🌱", description: "Ciel, terre, mer, lumière" },
      { id: "foi",        name: "La Foi",                nameAr: "الإيمان",        icon: "🕌", description: "Vocabulaire spirituel" },
      { id: "famille",    name: "La Famille",            nameAr: "العائلة",        icon: "👨‍👩‍👧", description: "Père, mère, frère, sœur" },
      { id: "table",      name: "À Table",               nameAr: "على المائدة",    icon: "🍽️", description: "Nourriture, boissons" },
      { id: "voyage",     name: "En Voyage",             nameAr: "في السفر",       icon: "✈️", description: "Transports, hôtels, directions" },
      { id: "sentiments", name: "Les Sentiments",        nameAr: "المشاعر",        icon: "🌸", description: "Joie, amour, patience" },
      { id: "temps",      name: "Le Temps & le Ciel",    nameAr: "الزمن والسماء",  icon: "🌙", description: "Jour, nuit, saisons, lune" },
      { id: "couleurs",   name: "Couleurs & Formes",     nameAr: "الألوان والأشكال", icon: "🎨", description: "Voir le monde en arabe" },
      { id: "travail",    name: "Travail & Savoir",      nameAr: "العمل والعلم",   icon: "💼", description: "Métiers, école, université" },
      { id: "nature",     name: "La Nature",             nameAr: "الطبيعة",        icon: "🌿", description: "Animaux, plantes, paysages" },
      { id: "coran",      name: "Le Coran",              nameAr: "القرآن",         icon: "📖", description: "Mots sacrés (sans niveau)", special: true }
    ];
  }

  function getDefaultTheme(themeId) {
    return {
      id: themeId,
      name: themeId,
      levels: {
        debutant: [],
        intermediaire: [],
        avance: [],
        expert: [],
        mouallim: []
      }
    };
  }

  function getDefaultLetters() {
    return [
      { id:"alif", ar:"ا", name:"Alif",  sound:"a"  },
      { id:"ba",   ar:"ب", name:"Bā'",   sound:"b"  },
      { id:"ta",   ar:"ت", name:"Tā'",   sound:"t"  },
      { id:"tha",  ar:"ث", name:"Thā'",  sound:"th" },
      { id:"jim",  ar:"ج", name:"Jīm",   sound:"j"  },
      { id:"ha",   ar:"ح", name:"Ḥā'",   sound:"ḥ"  },
      { id:"kha",  ar:"خ", name:"Khā'",  sound:"kh" },
      { id:"dal",  ar:"د", name:"Dāl",   sound:"d"  },
      { id:"dhal", ar:"ذ", name:"Dhāl",  sound:"dh" },
      { id:"ra",   ar:"ر", name:"Rā'",   sound:"r"  },
      { id:"zay",  ar:"ز", name:"Zāy",   sound:"z"  },
      { id:"sin",  ar:"س", name:"Sīn",   sound:"s"  },
      { id:"shin", ar:"ش", name:"Shīn",  sound:"sh" },
      { id:"sad",  ar:"ص", name:"Ṣād",   sound:"ṣ"  },
      { id:"dad",  ar:"ض", name:"Ḍād",   sound:"ḍ"  },
      { id:"ta2",  ar:"ط", name:"Ṭā'",   sound:"ṭ"  },
      { id:"za",   ar:"ظ", name:"Ẓā'",   sound:"ẓ"  },
      { id:"ayn",  ar:"ع", name:"ʿAyn",  sound:"ʿ"  },
      { id:"ghayn",ar:"غ", name:"Ghayn", sound:"gh" },
      { id:"fa",   ar:"ف", name:"Fā'",   sound:"f"  },
      { id:"qaf",  ar:"ق", name:"Qāf",   sound:"q"  },
      { id:"kaf",  ar:"ك", name:"Kāf",   sound:"k"  },
      { id:"lam",  ar:"ل", name:"Lām",   sound:"l"  },
      { id:"mim",  ar:"م", name:"Mīm",   sound:"m"  },
      { id:"nun",  ar:"ن", name:"Nūn",   sound:"n"  },
      { id:"ha2",  ar:"ه", name:"Hā'",   sound:"h"  },
      { id:"waw",  ar:"و", name:"Wāw",   sound:"w"  },
      { id:"ya",   ar:"ي", name:"Yā'",   sound:"y"  }
    ];
  }

  function getDefaultBadges() {
    return null; // sera défini dans xp.js si besoin
  }

  function getDefaultWotd() {
    const list = [
      { ar:"سلام", translit:"SALĀM",  fr:"Paix",     def:"Un mot de bienveillance, utilisé en salutation et pour exprimer la sérénité.", exAr:"السلام عليكم",   exFr:"« Que la paix soit sur vous »" },
      { ar:"نور",  translit:"NŪR",    fr:"Lumière",  def:"La clarté qui dissipe les ombres — littérale ou spirituelle.",                   exAr:"نور القمر",       exFr:"« La lumière de la lune »" },
      { ar:"حب",   translit:"ḤUBB",   fr:"Amour",    def:"Un sentiment profond d'attachement et d'affection.",                              exAr:"الحب جميل",       exFr:"« L'amour est beau »" },
      { ar:"سماء", translit:"SAMĀʾ",  fr:"Ciel",     def:"La voûte céleste, souvent associée à la contemplation.",                          exAr:"السماء صافية",    exFr:"« Le ciel est clair »" },
      { ar:"قمر",  translit:"QAMAR",  fr:"Lune",     def:"Astre nocturne, symbole de beauté et de poésie en arabe.",                        exAr:"قمر جميل",        exFr:"« Belle comme la lune »" },
      { ar:"شمس",  translit:"SHAMS",  fr:"Soleil",   def:"L'astre du jour, source de chaleur et de vie.",                                   exAr:"شمس مشرقة",       exFr:"« Un soleil radieux »" },
      { ar:"ماء",  translit:"MĀʾ",    fr:"Eau",      def:"L'élément de la vie, présent partout dans le Coran.",                             exAr:"الماء بارد",      exFr:"« L'eau est froide »" }
    ];
    const idx = new Date().getDate() % list.length;
    return list[idx];
  }

  /* =========================================================
     CACHE CONTROL
     ========================================================= */
  function clearCache() {
    for (const key in cache) delete cache[key];
  }

  /* -------- API publique -------- */
  return {
    getThemesIndex: getThemesIndex,
    getTheme: getTheme,
    getLetters: getLetters,
    getBadges: getBadges,
    getWordOfTheDay: getWordOfTheDay,
    sendContact: sendContact,
    subscribeNewsletter: subscribeNewsletter,
    syncProgress: syncProgress,
    sendToAI: sendToAI,
    verifyPayment: verifyPayment,
    isOnline: isOnline,
    hasBackend: hasBackend,
    clearCache: clearCache
  };
})();

window.Api = Api;
console.log("✓ API layer chargée (backend: " + (Api.hasBackend() ? "ON" : "OFF — fallback JSON local") + ")");
