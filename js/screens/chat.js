/* =========================================================
   DAR AL LOUGHAH — SCREEN: AI CHAT
   - Chat conversationnel
   - Reconnaissance vocale (Web Speech API)
   - Synthèse vocale (lecture à voix haute)
   - Bilingue FR / AR
   - Quota freemium 10 msg/jour
   ========================================================= */

const ChatScreen = (function() {

  let recognition = null;
  let isRecording = false;
  let history = [];
  let chatLanguage = "fr"; // "fr" ou "ar"

  /* =========================================================
     SHOW
     ========================================================= */
  function show() {
    setupRecognition();
    loadLanguagePreference();
    refreshQuota();
    refreshChatTools();

    if (history.length === 0) {
      // Message de bienvenue
      addMessage("bot", chatLanguage === "ar"
        ? "مرحباً! تكلم معي بالعربية أو الفرنسية. سأصحح لك بلطف."
        : "Marhaba ! Écris ou parle-moi en arabe ou en français. Je te corrigerai avec bienveillance.");
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
        : "Écrivez en arabe ou en français…";
      input.dir = chatLanguage === "ar" ? "rtl" : "ltr";
    }
  }

  /* =========================================================
     QUOTA
     ========================================================= */
  function refreshQuota() {
    if (!window.State) return;

    const isPremium = window.State.get("isPremium");
    const quotaBar = document.getElementById("quotaBar");

    if (isPremium) {
      if (quotaBar) {
        quotaBar.innerHTML = '<span>Premium</span><b>Messages illimités ✦</b>';
      }
      const sendBtn = document.getElementById("chatSendBtn");
      if (sendBtn) sendBtn.disabled = false;
      const input = document.getElementById("chatInput");
      if (input) input.disabled = false;
      return;
    }

    window.State.checkChatQuota();
    const used = window.State.get("chatCount") || 0;
    const limit = (window.CONFIG && window.CONFIG.CHAT_DAILY_LIMIT) || 10;
    const remaining = Math.max(0, limit - used);

    const usedEl = document.getElementById("quotaUsed");
    if (usedEl) usedEl.textContent = used;

    const overLimit = remaining === 0;
    const sendBtn = document.getElementById("chatSendBtn");
    const input = document.getElementById("chatInput");
    const micBtn = document.getElementById("chatMicBtn");

    if (sendBtn) sendBtn.disabled = overLimit;
    if (input) {
      input.disabled = overLimit;
      input.placeholder = overLimit
        ? "Quota atteint — passez Premium ✦"
        : (chatLanguage === "ar" ? "اكتب أو تكلم..." : "Écrivez en arabe ou en français…");
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
     ENVOI MESSAGE
     ========================================================= */
  async function sendMessage() {
    const input = document.getElementById("chatInput");
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    // Vérifier quota
    if (!window.State || !window.State.canSendChat()) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Quota gratuit atteint — passez Premium ✦");
      }
      return;
    }

    // Afficher le message de l'utilisateur
    addMessage("user", text);
    input.value = "";

    // Incrémenter quota
    window.State.incrementChatCount();
    refreshQuota();

    // Indicateur de saisie
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
        addMessage("bot", "Hmm, je n'ai pas bien compris. Réessayons ?");
      }
    } catch (e) {
      removeTypingIndicator();
      addMessage("bot", "Connexion impossible pour l'instant. Réessayez plus tard.");
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

    // Si le texte contient de l'arabe, mettre en RTL
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
    if (recognition) return; // déjà initialisé

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.warn("Speech recognition non supportée");
      const micBtn = document.getElementById("chatMicBtn");
      if (micBtn) {
        micBtn.style.opacity = "0.4";
        micBtn.disabled = true;
        micBtn.title = "Reconnaissance vocale non supportée sur ce navigateur";
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
      // Auto-envoyer
      setTimeout(sendMessage, 250);
    };

    recognition.onerror = function(event) {
      console.warn("Speech recognition error :", event.error);
      stopRecording();
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        if (window.Main && window.Main.toast) {
          window.Main.toast("Autorise le microphone pour parler à l'IA");
        }
      }
    };

    recognition.onend = function() {
      stopRecording();
    };
  }

  function toggleMic() {
    if (!recognition) {
      setupRecognition();
      if (!recognition) {
        if (window.Main && window.Main.toast) {
          window.Main.toast("Reconnaissance vocale non disponible");
        }
        return;
      }
    }

    // Vérifier quota
    if (!window.State || !window.State.canSendChat()) {
      if (window.Main && window.Main.toast) {
        window.Main.toast("Quota gratuit atteint");
      }
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
      console.warn("Impossible de démarrer la reco vocale :", e);
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
     SYNTHÈSE VOCALE (lecture à voix haute)
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
      // Détecter automatiquement la langue selon le contenu
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

  /* =========================================================
     QUITTER L'ÉCRAN → arrêter tout
     ========================================================= */
  function leave() {
    stopRecording();
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  }

  /* -------- API publique -------- */
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
console.log("✓ ChatScreen chargé (vocal + IA)");
