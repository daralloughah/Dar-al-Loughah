/* ============================================================
   CHAT IA — Mouallim (Gemini + audio vocal)
   ============================================================ */

(function() {
  'use strict';

  let chatHistory = [];
  let messagesUsed = 0;
  let chatInitialized = false;

  // Variables pour l'enregistrement audio
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;

  /* ---------- Helpers DOM ---------- */
  function $(id) { return document.getElementById(id); }

  function scrollChatToBottom() {
    const msgs = $('chatMsgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  /* ---------- Affichage des bulles ---------- */
  function addUserBubble(text, isAudio) {
    const msgs = $('chatMsgs');
    if (!msgs) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-user';
    if (isAudio) {
      bubble.innerHTML = '🎤 <em>Message vocal envoyé</em>';
    } else {
      bubble.textContent = text;
    }
    msgs.appendChild(bubble);
    scrollChatToBottom();
  }

  function addAiBubble(text) {
    const msgs = $('chatMsgs');
    if (!msgs) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-ai';
    bubble.setAttribute('dir', 'auto');
    bubble.textContent = text;
    msgs.appendChild(bubble);
    scrollChatToBottom();

    const readAloud = $('chatReadAloud');
    if (readAloud && readAloud.checked) {
      speakMultilang(text);
    }
  }

  function addTypingBubble() {
    const msgs = $('chatMsgs');
    if (!msgs) return null;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-ai chat-bubble-typing';
    bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    msgs.appendChild(bubble);
    scrollChatToBottom();
    return bubble;
  }

  /* ---------- TTS multi-langue (arabe + français) ---------- */
  function speakMultilang(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const segments = [];
    let currentText = '';
    let currentLang = null;

    for (const char of text) {
      const isArabic = arabicRegex.test(char);
      const isLetter = /[a-zA-ZÀ-ÿ\u0600-\u06FF]/.test(char);

      if (isLetter) {
        const charLang = isArabic ? 'ar' : 'fr';
        if (currentLang === null) {
          currentLang = charLang;
          currentText += char;
        } else if (charLang === currentLang) {
          currentText += char;
        } else {
          if (currentText.trim()) {
            segments.push({ text: currentText.trim(), lang: currentLang });
          }
          currentText = char;
          currentLang = charLang;
        }
      } else {
        currentText += char;
      }
    }

    if (currentText.trim()) {
      segments.push({ text: currentText.trim(), lang: currentLang || 'fr' });
    }

    segments.forEach((segment) => {
      try {
        const utter = new SpeechSynthesisUtterance(segment.text);
        utter.lang = segment.lang === 'ar' ? 'ar-SA' : 'fr-FR';
        utter.rate = segment.lang === 'ar' ? 0.85 : 1.0;
        utter.pitch = 1.0;
        window.speechSynthesis.speak(utter);
      } catch (e) {
        console.warn('TTS erreur:', e);
      }
    });
  }

  /* ---------- Envoi message texte ---------- */
  async function sendMessage() {
    const input = $('chatInput');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    if (typeof window.askGemini !== 'function') {
      addAiBubble('Désolé, la connexion au serveur est indisponible. Réessaye dans un instant.');
      return;
    }

    addUserBubble(message, false);
    input.value = '';

    const typingBubble = addTypingBubble();
    const sendBtn = $('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const reply = await window.askGemini(message, chatHistory);
      if (typingBubble && typingBubble.parentNode) typingBubble.parentNode.removeChild(typingBubble);
      addAiBubble(reply);

      chatHistory.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: reply }] }
      );
      if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);

      messagesUsed++;
      const quotaUsed = $('quotaUsed');
      if (quotaUsed) quotaUsed.textContent = messagesUsed;
    } catch (e) {
      console.error('Erreur sendMessage:', e);
      if (typingBubble && typingBubble.parentNode) typingBubble.parentNode.removeChild(typingBubble);
      addAiBubble('Une erreur est survenue. Réessaye s\'il te plaît.');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /* ---------- Enregistrement audio ---------- */
  async function startRecording() {
    if (isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
        await sendAudioMessage(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      showVoiceIndicator(true);
      updateMicButton(true);
    } catch (err) {
      console.error('Erreur micro:', err);
      addAiBubble('Je n\'ai pas pu accéder au micro. Autorise l\'accès dans les paramètres du navigateur.');
    }
  }

  function stopRecording() {
    if (!isRecording || !mediaRecorder) return;
    mediaRecorder.stop();
    isRecording = false;
    showVoiceIndicator(false);
    updateMicButton(false);
  }

  function getSupportedMimeType() {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  }

  function showVoiceIndicator(show) {
    const indicator = $('voiceIndicator');
    if (indicator) indicator.hidden = !show;
  }

  function updateMicButton(recording) {
    const btn = $('chatMicBtn');
    if (!btn) return;
    if (recording) {
      btn.classList.add('recording');
      btn.setAttribute('aria-label', 'Arrêter l\'enregistrement');
    } else {
      btn.classList.remove('recording');
      btn.setAttribute('aria-label', 'Parler');
    }
  }

  /* ---------- Envoi audio à Gemini ---------- */
  async function sendAudioMessage(audioBlob) {
    if (typeof window.askGeminiAudio !== 'function') {
      addAiBubble('Le mode vocal n\'est pas disponible. Vérifie la configuration.');
      return;
    }

    addUserBubble('', true);

    const typingBubble = addTypingBubble();
    const sendBtn = $('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const base64 = await blobToBase64(audioBlob);
      const reply = await window.askGeminiAudio(base64, audioBlob.type, chatHistory);

      if (typingBubble && typingBubble.parentNode) typingBubble.parentNode.removeChild(typingBubble);
      addAiBubble(reply);

      chatHistory.push(
        { role: 'user', parts: [{ text: '[Message vocal de l\'élève]' }] },
        { role: 'model', parts: [{ text: reply }] }
      );
      if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);

      messagesUsed++;
      const quotaUsed = $('quotaUsed');
      if (quotaUsed) quotaUsed.textContent = messagesUsed;
    } catch (e) {
      console.error('Erreur audio:', e);
      if (typingBubble && typingBubble.parentNode) typingBubble.parentNode.removeChild(typingBubble);
      addAiBubble('Je n\'ai pas pu traiter le message vocal. Réessaye.');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /* ---------- Vérification écran chat ---------- */
  function isChatScreenVisible() {
    const chatScreen = document.getElementById('screen-chat');
    if (!chatScreen) return false;
    return chatScreen.classList.contains('active');
  }

  /* ---------- Initialisation ---------- */
  function initChatScreen() {
    if (!isChatScreenVisible()) return;

    const sendBtn = $('chatSendBtn');
    const input = $('chatInput');
    const micBtn = $('chatMicBtn');
    const msgs = $('chatMsgs');

    if (!sendBtn || !input || !msgs) return;

    if (!sendBtn.dataset.geminiBound) {
      sendBtn.addEventListener('click', sendMessage);
      sendBtn.dataset.geminiBound = '1';
    }

    if (!input.dataset.geminiBound) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      input.dataset.geminiBound = '1';
    }

    if (micBtn && !micBtn.dataset.geminiBound) {
      micBtn.addEventListener('click', function() {
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      });
      micBtn.dataset.geminiBound = '1';
    }

    if (!chatInitialized && msgs.children.length === 0) {
      addAiBubble(
        "As-salāmu ʿalaykum ! Je suis Mouallim, ton professeur d'arabe.\n\n" +
        "Je peux t'aider à :\n" +
        "• Corriger tes phrases (à l'écrit ou à l'oral 🎤)\n" +
        "• Expliquer la grammaire (nahw), la morphologie (sarf), le tajwid\n" +
        "• Te conseiller des livres adaptés à ton niveau\n" +
        "• Te proposer des matn à mémoriser et des exercices\n" +
        "• Te raconter l'étymologie des mots\n\n" +
        "Pour commencer, dis-moi : quel est ton niveau (débutant, intermédiaire, avancé) et quel est ton objectif (lire le Coran, parler, étudier les classiques...) ?"
      );
      chatInitialized = true;
    }
  }

  /* ---------- Écouteurs ---------- */
  document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('click', function(e) {
      const target = e.target.closest('[data-target="chat"]');
      if (target) setTimeout(initChatScreen, 300);
    });
  });

  document.addEventListener('click', function(e) {
    const leavingChat = e.target.closest('[data-target]:not([data-target="chat"])');
    if (leavingChat) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (isRecording) stopRecording();
    }
  });

  // Debug
  window.ChatGemini = {
    send: sendMessage,
    startMic: startRecording,
    stopMic: stopRecording,
    reset: function() {
      chatHistory = [];
      messagesUsed = 0;
      chatInitialized = false;
      const msgs = $('chatMsgs');
      if (msgs) msgs.innerHTML = '';
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    },
    init: initChatScreen
  };

})();
