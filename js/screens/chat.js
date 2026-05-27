/* ============================================================
   CHAT IA — Branché sur Gemini via Edge Function Supabase
   ============================================================ */

(function() {
  'use strict';

  // Historique de la conversation (gardé en mémoire pendant la session)
  let chatHistory = [];

  // Compteur de messages (pour la quota bar, plus tard quand tu activeras la limite)
  let messagesUsed = 0;

  /* ---------- Helpers DOM ---------- */
  function $(id) { return document.getElementById(id); }

  function scrollChatToBottom() {
    const msgs = $('chatMsgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  /* ---------- Affichage des bulles ---------- */
  function addUserBubble(text) {
    const msgs = $('chatMsgs');
    if (!msgs) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-user';
    bubble.textContent = text;
    msgs.appendChild(bubble);
    scrollChatToBottom();
  }

  function addAiBubble(text) {
    const msgs = $('chatMsgs');
    if (!msgs) return;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-ai';
    bubble.setAttribute('dir', 'rtl');
    bubble.textContent = text;
    msgs.appendChild(bubble);
    scrollChatToBottom();

    // Lecture vocale si toggle activé
    const readAloud = $('chatReadAloud');
    if (readAloud && readAloud.checked && 'speechSynthesis' in window) {
      try {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'ar-SA';
        utter.rate = 0.9;
        window.speechSynthesis.speak(utter);
      } catch (e) {
        console.warn('TTS non disponible:', e);
      }
    }
  }

  function addTypingBubble() {
    const msgs = $('chatMsgs');
    if (!msgs) return null;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble chat-bubble-ai chat-bubble-typing';
    bubble.setAttribute('dir', 'rtl');
    bubble.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
    msgs.appendChild(bubble);
    scrollChatToBottom();
    return bubble;
  }

  /* ---------- Envoi du message ---------- */
  async function sendMessage() {
    const input = $('chatInput');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    // Vérifier que askGemini existe
    if (typeof window.askGemini !== 'function') {
      addAiBubble('عذرًا، الاتصال بالخادم غير متاح حاليًا.');
      console.error('window.askGemini est introuvable. Vérifie que le bloc Supabase est bien chargé dans index.html.');
      return;
    }

    // Affiche le message user, vide l'input
    addUserBubble(message);
    input.value = '';

    // Affiche l'indicateur "en train d'écrire..."
    const typingBubble = addTypingBubble();

    // Désactive le bouton envoyer le temps de la réponse
    const sendBtn = $('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      // Appel à Gemini via l'Edge Function
      const reply = await window.askGemini(message, chatHistory);

      // Retire l'indicateur "en train d'écrire..."
      if (typingBubble && typingBubble.parentNode) {
        typingBubble.parentNode.removeChild(typingBubble);
      }

      // Affiche la réponse de l'IA
      addAiBubble(reply);

      // Met à jour l'historique (format Gemini)
      chatHistory.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: reply }] }
      );

      // Limite l'historique aux 20 derniers échanges pour ne pas saturer
      if (chatHistory.length > 40) {
        chatHistory = chatHistory.slice(-40);
      }

      // Incrémente le compteur de messages
      messagesUsed++;
      const quotaUsed = $('quotaUsed');
      if (quotaUsed) quotaUsed.textContent = messagesUsed;

    } catch (e) {
      console.error('Erreur sendMessage:', e);
      if (typingBubble && typingBubble.parentNode) {
        typingBubble.parentNode.removeChild(typingBubble);
      }
      addAiBubble('عذرًا، حدث خطأ. حاول مرة أخرى.');
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  }

  /* ---------- Écouteurs d'événements ---------- */
  function initChatScreen() {
    const sendBtn = $('chatSendBtn');
    const input = $('chatInput');

    // Évite de doubler les listeners si la fonction est appelée plusieurs fois
    if (sendBtn && !sendBtn.dataset.geminiBound) {
      sendBtn.addEventListener('click', sendMessage);
      sendBtn.dataset.geminiBound = '1';
    }

    if (input && !input.dataset.geminiBound) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      input.dataset.geminiBound = '1';
    }

    // Message d'accueil de l'IA (seulement la première fois)
    const msgs = $('chatMsgs');
    if (msgs && msgs.children.length === 0) {
      addAiBubble('السلام عليكم! أنا "معلّم"، مساعدك لتعلّم العربية. اكتب جملة وأنا أصحّحها لك، أو اسألني عن قاعدة، أو اطلب كتابًا يناسب مستواك.');
    }
  }

  /* ---------- Auto-initialisation quand l'écran chat s'affiche ---------- */
  document.addEventListener('DOMContentLoaded', function() {
    // Si l'écran chat est déjà visible au chargement
    initChatScreen();

    // Réinitialise quand on navigue vers le chat
    document.addEventListener('click', function(e) {
      const target = e.target.closest('[data-target="chat"]');
      if (target) {
        setTimeout(initChatScreen, 200);
      }
    });
  });

  // Exposé global pour debug
  window.ChatGemini = {
    send: sendMessage,
    reset: function() { chatHistory = []; messagesUsed = 0; }
  };

})();
