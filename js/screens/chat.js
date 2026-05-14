/* =========================================================
   DAR AL LOUGHAH - SCREEN: AI CHAT
   - Chat conversationnel
   - Reconnaissance vocale (Web Speech API)
   - Synthese vocale (lecture a voix haute)
   - Bilingue FR / AR
   - Quota freemium pilote depuis admin
   - Kill switch + limites globales
   ========================================================= */

const ChatScreen = (function() {

  let recognition = null;
  let isRecording = false;
  let history = [];
  let chatLanguage = "fr";
  let aiConfig = null;
  let aiConfigLoadedAt = 0;

  /* =========================================================
     SHOW
     ========================================================= */
  async function show() {
    setupRecognition();
    loadLanguagePreference();
    await loadAiConfig();
    await refreshQuota();
    refreshChatTools();

    if (history.length === 0) {
      addMessage("bot", chatLanguage === "ar"
        ? "مرحباً! تكلم معي بالعربية أو الفرنسية. سأصحح لك بلطف."
        : "Marhaba ! Ecris ou parle-moi en arabe ou en francais. Je te corrigerai avec bienveillance.");
    }
  }

  /* =========================================================
     CONFIG IA (depuis admin)
     ========================================================= */
  async function loadAiConfig() {
    const now = Date.now();
    if (aiConfig && (now - aiConfigLoadedAt) < 60000) return aiConfig;
    try {
      if (window.FB && window.FB.getDocument) {
        const cfg = await window.FB.getDocument("config", "global");
        aiConfig = cfg || {};
        aiConfigLoadedAt = now;
      }
    } catch (e) {
      console.warn("Impossible de charger config IA :", e);
      aiConfig = aiConfig || {};
    }
    return aiConfig;
  }

  function getAiEnabled() {
    return !aiConfig || aiConfig.aiEnabled !== false;
  }

  function getUserLimit() {
    const isPremium = window.State && window.State.get("isPremium");
    if (isPremium) {
      return (aiConfig && aiConfig.chatDailyLimitPremium) || 100;
    }
    return (aiConfig && aiConfig.chatDailyLimit) || 10;
  }

  function getGlobalLimit() {
    return (aiConfig && aiConfig.chatGlobalDailyLimit) || 5000;
  }

  /* =========================================================
     COMPTAGE FIRESTORE
     ========================================================= */
  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  async function getTodayGlobalCount() {
    try {
      const doc = await window.FB.getDocument("ia_usage", todayKey());
      return doc && doc.count ? doc.count : 0;
    } catch (e) { return 0; }
  }

  async function getTodayUserCount() {
    const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;
    if (!user || !user.uid) return 0;
    try {
      const doc = await window.FB.getDocument("ia_usage_users", todayKey() + "_" + user.uid);
      return doc && doc.count ? doc.count : 0;
    } catch (e) { return 0; }
  }

  async function incrementCounts() {
    const key = todayKey();
    const user = window.Auth && window.Auth.getUser ? window.Auth.getUser() : null;
    try {
      const globalDoc = await window.FB.getDocument("ia_usage", key) || { count: 0 };
      await window.FB.setDocument("ia_usage", key, {
        count: (globalDoc.count || 0) + 1,
        date: key,
        lastUpdated: Date.now()
      });
      if (user && user.uid) {
        const userDocId = key + "_" + user.uid;
        const userDoc = await window.FB.getDocument("ia_usage_users", userDocId) || { count: 0 };
        await window.FB.setDocument("ia_usage_users", userDocId, {
          count: (userDoc.count || 0) + 1,
          date: key,
          userId: user.uid,
          pseudo: window.State ? window.State.get("pseudo") : "",
          lastUpdated: Date.now()
        });
      }
    } catch (e) {
      console.warn("Erreur increment counts :", e);
    }
  }

  /* =========================================================
     LANGUE
     ========================================================= */
  function loadLanguagePreference() {
    if (window.State) {
      chatLanguage = window.State.get("settings.chatLanguage") || "fr";
    }
    updateLanguageBadge();
  }

  function toggleLanguage() {
    chatLanguage = chatLanguage === "fr" ? "ar" : "fr";
    if (window.State) {
      window.State.set("settings.chatLanguage", chatLanguage);
    }
    updateLanguageBadge();
    if (window.Audio) window.Audio.tap();
  }

  function updateLanguageBadge() {
    const badge = document.getElementById("chatLangBadge");
    if (badge) {
      badge.textContent = chatLanguage === "ar" ? "AR" : "FR";
    }
    const input = document.getElementById("chatInput");
    if (input) {
      input.placeholder = chatLanguage === "ar"
        ? "اكتب أو تكلم..."
        : "Ecrivez en arabe ou en francais...";
      input.dir = chatLanguage === "ar" ? "rtl" : "ltr";
    }
  }

  /* =========================================================
     QUOTA AFFICHAGE
     ========================================================= */
  async function refreshQuota() {
    if (!window.State) return;

    await loadAiConfig();

    const isPremium = window.State.get("isPremium");
    const quotaBar = document.getElementById("quotaBar");
    const sendBtn = document.getElementById("chatSendBtn");
    const input = document.getElementById("chatInput");
    const micBtn = document.getElementById("chatMicBtn");

    if (!getAiEnabled()) {
      if (quotaBar) quotaBar.innerHTML = '<span style="color:#ff9aa5;">IA temporairement desactivee</span>';
      if (sendBtn) sendBtn.disabled = true;
      if (input) {
        input.disabled = true;
        input.placeholder = "IA temporairement indisponible";
      }
      if (micBtn) micBtn.disabled = true;
      return;
    }

    const userLimit = getUserLimit();
    const userUsed = await getTodayUserCount();
    const userRemaining = Math.max(0, userLimit - userUsed);

    const globalLimit = getGlobalLimit();
    const globalUsed = await getTodayGlobalCount();
    const globalReached = globalUsed >= globalLimit;

    const overLimit = userRemaining === 0 || globalReached;

    if (quotaBar) {
      if (isPremium) {
        quotaBar.innerHTML = '<span>Premium</span><b>' + userRemaining + ' / ' + userLimit + ' messages restants</b>';
      } else {
        quotaBar.innerHTML = '<span>Gratuit</span><b>' + userRemaining + ' / ' + userLimit + ' messages restants aujourd hui</b>';
      }
    }

    if (sendBtn) sendBtn.disabled = overLimit;
    if (input) {
      input.disabled = overLimit;
      if (globalReached) {
        input.placeholder = "Limite globale atteinte. Reessaye demain.";
      } else if (userRemaining === 0) {
        input.placeholder = isPremium ? "Limite premium atteinte" : "Quota atteint - passe Premium";
      } else {
        input.placeholder = chatLanguage === "ar" ? "اكتب أو تكلم..." : "Ecrivez en arabe ou en francais...";
      }
    }
    if (micBtn) micBtn.disabled = overLimit;
  }

  function refreshChatTools() {
    const readAloudCheckbox = document.getElementById("chatReadAloud");
    if (readAloudCheckbox && window.State) {
      const enabled = window.State.get("settings.chatReadAloud") !== false;
      readAloudCheckbox.checked = enabled;
      readAloudCheckbox.onchange = function() {
        window.State.set("settings.chatReadAloud", readAloudCheckbox.checked);
      };
    }
  }

  /* =========================================================
     ENVOI MESSAGE - avec verifications quota
     ========================================================= */
  async function sendMessage() {
    const input = document.getElementById("chatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    await loadAiConfig();

    if (!getAiEnabled()) {
      if (window.Main) window.Main.toast("Le chat IA est temporairement indisponible");
      return;
    }

    const globalUsed = await getTodayGlobalCount();
    if (globalUsed >= getGlobalLimit()) {
      if (window.Main) window.Main.toast("Limite globale atteinte aujourd hui. Reessaye demain.");
      await refreshQuota();
      return;
    }

    const userUsed = await getTodayUserCount();
    const userLimit = getUserLimit();
    if (userUsed >= userLimit) {
      const isPremium = window.State && window.State.get("isPremium");
      if (window.Main) {
        window.Main.toast(isPremium
          ? "Limite premium atteinte (" + userLimit + " msg/jour)"
          : "Quota gratuit atteint - passe Premium pour " + getUserLimit.call({}, true) + " messages/jour");
      }
      await refreshQuota();
      return;
    }

    addMessage("user", text);
    input.value = "";

    await incrementCounts();
    await refreshQuota();

    addTypingIndicator();

    try {
      const response = await window.Api.sendToAI(text, history.slice(-10));
      removeTypingIndicator();

      if (response && response.success) {
        addMessage("bot", response.reply);
        if (shouldReadAloud()) {
          speak(response.reply);
        }
      } else {
        addMessage("bot", "Hmm, je n ai pas bien compris. Reessayons ?");
      }
    } catch (e) {
      removeTypingIndicator();
      addMessage("bot", "Connexion impossible pour l instant. Reessaye plus tard.");
      console.warn("Erreur IA :", e);
    }
  }

  /* =========================================================
     AJOUTER MESSAGE
     ========================================================= */
  function addMessage(who, text) {
    const box = document.getElementById("chatMsgs");
    if (!box) return;

    const el = document.createElement("div");
    el.className = "msg " + (who === "user" ? "user" : "bot");

    const iconText = who === "user"
      ? ((window.State && window.State.get("pseudo") || "A").charAt(0).toUpperCase())
      : "✦";

    el.innerHTML =
      '<span class="msg-icon">' + escapeHTML(iconText) + '</span>' +
      escapeHTML(text);

    if (containsArabic(text)) {
      el.style.direction = "rtl";
      el.style.textAlign = "right";
      el.style.fontFamily = "'Amiri', serif";
      el.style.fontSize = "18px";
    }

    box.appendChild(el);
    box.scrollTop = box.scrollHeight;

    history.push({ role: who, content: text });
    if (history.length > 20) history = history.slice(-20);
  }

  function addTypingIndicator() {
    const box = document.getElementById("chatMsgs");
    if (!box) return;
    const el = document.createElement("div");
    el.className = "msg bot";
    el.id = "typing-indicator";
    el.innerHTML = '<span class="msg-icon">✦</span><span class="voice-wave" style="display:inline-flex; gap:3px;"><span style="width:4px; height:4px; background:var(--gold); border-radius:50%; animation: wave 1.2s ease-in-out infinite;"></span><span style="width:4px; height:4px; background:var(--gold); border-radius:50%; animation: wave 1.2s ease-in-out infinite .15s;"></span><span style="width:4px; height:4px; background:var(--gold); border-radius:50%; animation: wave 1.2s ease-in-out infinite .3s;"></span></span>';
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById("typing-indicator");
    if (el) el.remove();
  }

  /* =========================================================
     RECONNAISSANCE VOCALE
     ========================================================= */
  function setupRecognition() {
    if (recognition) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn("Speech recognition non supportee");
      const micBtn = document.getElementById("chatMicBtn");
      if (micBtn) {
        micBtn.style.opacity = "0.4";
        micBtn.disabled = true;
        micBtn.title = "Reconnaissance vocale non supportee sur ce navigateur";
      }
      return;
    }

    recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = function(event) {
      const transcript = event.results[0][0].transcript;
      const input = document.getElementById("chatInput");
      if (input) input.value = transcript;
      stopRecording();
      setTimeout(sendMessage, 250);
    };

    recognition.onerror = function(event) {
      console.warn("Speech recognition error :", event.error);
      stopRecording();
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        if (window.Main) window.Main.toast("Autorise le microphone pour parler a l IA");
      }
    };

    recognition.onend = function() {
      stopRecording();
    };
  }

  async function toggleMic() {
    if (!recognition) {
      setupRecognition();
      if (!recognition) {
        if (window.Main) window.Main.toast("Reconnaissance vocale non disponible");
        return;
      }
    }

    await loadAiConfig();
    if (!getAiEnabled()) {
      if (window.Main) window.Main.toast("IA temporairement desactivee");
      return;
    }

    const userUsed = await getTodayUserCount();
    if (userUsed >= getUserLimit()) {
      if (window.Main) window.Main.toast("Quota atteint");
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  function startRecording() {
    if (!recognition) return;
    try {
      recognition.lang = chatLanguage === "ar" ? "ar-SA" : "fr-FR";
      recognition.start();
      isRecording = true;
      const micBtn = document.getElementById("chatMicBtn");
      const indicator = document.getElementById("voiceIndicator");
      if (micBtn) micBtn.classList.add("recording");
      if (indicator) indicator.hidden = false;
      if (window.Audio) window.Audio.tap();
    } catch (e) {
      console.warn("Impossible de demarrer la reco vocale :", e);
      isRecording = false;
    }
  }

  function stopRecording() {
    if (recognition && isRecording) {
      try { recognition.stop(); } catch (e) {}
    }
    isRecording = false;
    const micBtn = document.getElementById("chatMicBtn");
    const indicator = document.getElementById("voiceIndicator");
    if (micBtn) micBtn.classList.remove("recording");
    if (indicator) indicator.hidden = true;
  }

  /* =========================================================
     SYNTHESE VOCALE
     ========================================================= */
  function shouldReadAloud() {
    if (!window.State) return true;
    return window.State.get("settings.chatReadAloud") !== false;
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    if (!text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = containsArabic(text) ? "ar-SA" : "fr-FR";
      utter.rate = 0.9;
      utter.pitch = 1.0;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    } catch (e) {
      console.warn("Erreur speak :", e);
    }
  }

  /* =========================================================
     UTILS
     ========================================================= */
  function containsArabic(text) {
    return /[\u0600-\u06FF]/.test(text);
  }

  function escapeHTML(s) {
    return (s + "").replace(/[&<>"']/g, function(c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function leave() {
    stopRecording();
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  }

  return {
    show: show,
    sendMessage: sendMessage,
    toggleMic: toggleMic,
    toggleLanguage: toggleLanguage,
    leave: leave,
    refreshQuota: refreshQuota
  };
})();

window.ChatScreen = ChatScreen;
console.log("OK ChatScreen charge (vocal + IA + quotas)");
