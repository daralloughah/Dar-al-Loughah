/* ============================================================
   CHAT IA — Branché sur Gemini via Edge Function Supabase
   ============================================================ */

(function() {
  'use strict';

  let chatHistory = [];
  let messagesUsed = 0;
  let chatInitialized = false;

  function $(id) { return document.getElementById(id); }

  function scrollChatToBottom() {
    const msgs = $('chatMsgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

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

  async function sendMessage() {
    const input = $('chatInput');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    if (typeof window.askGemini !== 'function') {
      addAiBubble('عذرًا، الاتصال بالخادم غير متاح حاليًا.');
      console.error('window.askGemini introuvable. Vérifie le bloc Supabase dans index.html.');
      return;
    }

    addUserBubble(message);
    input.value = '';

    const typingBubble = addTypingBubble();
    const sendBtn = $('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      const reply = await window.askGemini(message, chatHistory);

      if (typingBubble && typingBubble.parentNode) {
        typingBubble.parentNode.removeChild(typingBubble);
      }

      addAiBubble(reply);

      chatHistory.push(
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: reply }] }
      );

      if (chatHistory.length > 40) {
        chatHistory = chatHistory.slice(-40);
      }

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

  /* ---------- Vérifie si on est VRAIMENT sur l'écran chat ---------- */
  function isChatScreenVisible() {
    const chatScreen = document.getElementById('screen-chat');
    if (!chatScreen) return false;
    // L'écran chat doit avoir la classe "active" pour être visible
    return chatScreen.classList.contains('active');
  }

  /* ---------- Initialise SEULEMENT quand on arrive sur le chat ---------- */
  function initChatScreen() {
    // SÉCURITÉ : ne fait rien si on n'est pas sur l'écran chat
    if (!isChatScreenVisible()) return;

    const sendBtn = $('chatSendBtn');
    const input = $('chatInput');
    const msgs = $('chatMsgs');

    // SÉCURITÉ : ne fait rien si les éléments n'existent pas encore
    if (!sendBtn || !input || !msgs) return;

    // Attache les écouteurs une seule fois
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

    // Message d'accueil UNE SEULE FOIS au premier affichage
    if (!chatInitialized && msgs.children.length === 0) {
      addAiBubble('السلام عليكم! أنا "معلّم"، مساعدك لتعلّم العربية. اكتب جملة وأنا أصحّحها لك، أو اسألني عن قاعدة، أو اطلب كتابًا يناسب مستواك.');
      chatInitialized = true;
    }
  }

  /* ---------- Écoute les navigations vers le chat ---------- */
  document.addEventListener('DOMContentLoaded', function() {
    // Quand l'user clique sur un bouton qui mène au chat
    document.addEventListener('click', function(e) {
      const target = e.target.closest('[data-target="chat"]');
      if (target) {
        // Attend que l'écran chat soit affiché avant d'initialiser
        setTimeout(initChatScreen, 300);
      }
    });
  });

  // Exposé global pour debug
  window.ChatGemini = {
    send: sendMessage,
    reset: function() {
      chatHistory = [];
      messagesUsed = 0;
      chatInitialized = false;
      const msgs = $('chatMsgs');
      if (msgs) msgs.innerHTML = '';
    },
    init: initChatScreen
  };

})();
