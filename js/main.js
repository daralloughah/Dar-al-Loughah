/* =========================================================
   DAR AL LOUGHAH — MAIN ORCHESTRATOR
   - Génère les étoiles
   - Gère la navigation entre écrans
   - Intercepte tous les data-action des boutons
   - Affiche modales et toasts
   - Démarre l'app
   ========================================================= */

const Main = (function() {

  let currentScreen = null;
  let toastTimeout = null;

  /* =========================================================
     STARFIELD (génération des 120 étoiles scintillantes)
     ========================================================= */
  function buildStarfield() {
    const sf = document.getElementById("starfield");
    if (!sf || sf.childElementCount > 0) return;

    const count = 120;
    for (let i = 0; i < count; i++) {
      const s = document.createElement("div");
      const r = Math.random();
      const isLarge = r < 0.2;
      const isSmall = r >= 0.5;
      const isGold = Math.random() < 0.12;

      let cls = "star";
      if (isLarge) cls += " lg";
      else if (isSmall) cls += " sm";
      if (isGold) cls += " gold";

      s.className = cls;
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      s.style.setProperty("--dur", (2 + Math.random() * 4) + "s");
      s.style.setProperty("--delay", (-Math.random() * 4) + "s");
      sf.appendChild(s);
    }
  }

  /* =========================================================
     NAVIGATION ENTRE ÉCRANS
     ========================================================= */
  function goto(screenName) {
    if (!screenName) return;

    // Quitter proprement l'écran actuel
    if (currentScreen === "chat" && window.ChatScreen && window.ChatScreen.leave) {
      window.ChatScreen.leave();
    }
    if (currentScreen === "rapid" && window.RapidScreen && window.RapidScreen.stop) {
      window.RapidScreen.stop();
    }

    // Cacher tous les écrans
    document.querySelectorAll(".screen").forEach(function(s) {
      s.classList.remove("active");
    });

    // Afficher le nouveau
    const target = document.getElementById("screen-" + screenName);
    if (target) {
      target.classList.add("active");
      currentScreen = screenName;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      console.warn("Écran inconnu :", screenName);
      return;
    }

    // Mettre à jour la nav du bas
    document.querySelectorAll(".nav-item").forEach(function(item) {
      const target = item.getAttribute("data-target");
      item.classList.toggle("active",
        target === screenName ||
        (target === "themes" && (screenName === "vocab" || screenName === "theme-levels" || screenName === "lesson")) ||
        (target === "profile" && (screenName === "badges" || screenName === "settings"))
      );
    });

    // Cacher la nav sur login/register
    const navBar = document.getElementById("navBar");
    if (navBar) {
      navBar.style.display = (screenName === "login" || screenName === "register") ? "none" : "grid";
    }

    // Appeler la fonction show() de l'écran
    callScreenShow(screenName);
  }

  function callScreenShow(screenName) {
    const map = {
      "home":         window.HomeScreen,
      "themes":       window.ThemesScreen,
      "theme-levels": window.ThemesScreen,
      "vocab":        window.VocabScreen,
      "reading":      window.ReadingScreen,
      "quiz":         window.QuizScreen,
      "rapid":        window.RapidScreen,
      "chat":         window.ChatScreen,
      "lists":        window.ListsScreen,
      "list-detail":  window.ListsScreen,
      "profile":      window.ProfileScreen,
      "badges":       window.BadgesScreen,
      "wotd":         window.WotdScreen,
      "contact":      window.ContactScreen,
      "premium":      window.PremiumScreen,
      "settings":     window.SettingsScreen,
      "admin":        window.AdminScreen,
      "lesson":       window.HomeScreen
    };

    const screenObj = map[screenName];
    if (!screenObj) return;

    // Cas spécial : list-detail appelle showDetail()
    if (screenName === "list-detail" && screenObj.showDetail) {
      screenObj.showDetail();
    } else if (screenObj.show) {
      try { screenObj.show(); } catch (e) {
        console.warn("Erreur show()", screenName, e);
      }
    }
  }

  /* =========================================================
     INTERCEPTEUR DE BOUTONS (data-action)
     ========================================================= */
  function bindActions() {
    document.addEventListener("click", function(e) {
      // Trouver l'élément le plus proche avec data-action
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.getAttribute("data-action");
      const data = target.dataset;

      // Son tap au clic (sauf sur certains boutons spéciaux)
      const noTapSound = ["chat-mic", "chat-send", "quiz-pick", "rapid-pick"];
      if (window.Audio && noTapSound.indexOf(action) === -1) {
        window.Audio.tap();
      }

      handleAction(action, data, target, e);
    });

    // Soumission des formulaires
    document.addEventListener("submit", function(e) {
      const form = e.target;
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        const action = submitBtn.getAttribute("data-action");
        if (action) {
          e.preventDefault();
          handleAction(action, submitBtn.dataset, submitBtn, e);
        }
      }
    });
  }

  function handleAction(action, data, target, event) {
    if (event && event.preventDefault) event.preventDefault();

    switch (action) {
      // ===== NAVIGATION =====
      case "goto":
        goto(data.target);
        break;

      // ===== AUTH =====
      case "login-google":
        if (window.Auth) {
          window.Auth.loginGoogle().then(function(r) {
            if (r && r.success) goto("home");
          });
        }
        break;
      case "login-apple":
        if (window.Auth) {
          window.Auth.loginApple().then(function(r) {
            if (r && r.success) goto("home");
          });
        }
        break;
      case "login-email":
        const loginEmail = document.getElementById("loginEmail");
        const loginPass = document.getElementById("loginPass");
        if (window.Auth && loginEmail && loginPass) {
          window.Auth.loginEmail(loginEmail.value, loginPass.value).then(function(r) {
            if (r && r.success) {
              goto("home");
            } else if (r && r.error) {
              toast(r.error);
            }
          });
        }
        break;
      case "login-guest":
        if (window.Auth) {
          window.Auth.loginGuest();
          goto("home");
        }
        break;
      case "show-register":
        goto("register");
        break;
      case "register":
        const regForm = {
          pseudo: getValue("regPseudo"),
          email: getValue("regEmail"),
          password: getValue("regPass"),
          passwordConfirm: getValue("regPassConfirm"),
          newsletter: getChecked("regNewsletter"),
          terms: getChecked("regTerms")
        };
        if (window.Auth) {
          window.Auth.register(regForm).then(function(r) {
            if (r && r.success) {
              goto("home");
            } else if (r && r.error) {
              toast(r.error);
            }
          });
        }
        break;
      case "logout":
        if (window.ProfileScreen) window.ProfileScreen.logout();
        break;
      case "save-pseudo":
        if (window.ProfileScreen) window.ProfileScreen.savePseudo();
        break;
      case "export-data":
        if (window.ProfileScreen) window.ProfileScreen.exportData();
        break;

      // ===== THÈMES & NIVEAUX =====
      case "open-theme":
        if (window.ThemesScreen) window.ThemesScreen.openTheme(data.themeId);
        break;
      case "select-level":
        if (window.ThemesScreen) window.ThemesScreen.selectLevel(data.levelId, data.themeId);
        break;
      case "practice-theme":
        if (window.ThemesScreen) window.ThemesScreen.practiceTheme(data.mode);
        break;

      // ===== VOCAB =====
      case "flip-card":
        if (window.VocabScreen) window.VocabScreen.flip();
        break;
            case "vocab-review":
        if (window.VocabScreen) window.VocabScreen.review(data.known === "true");
        break;
      case "vocab-mini-pick":
        if (window.VocabScreen) window.VocabScreen.pickMiniAnswer(parseInt(data.pickIndex, 10));
        break;
      case "speak-word":
        if (currentScreen === "wotd" && window.WotdScreen) {
          window.WotdScreen.speak();
        } else if (window.VocabScreen) {
          window.VocabScreen.speakCurrent();
        }
        break;

      // ===== READING =====
      case "select-letter":
        if (window.ReadingScreen) {
          window.ReadingScreen.selectLetter(parseInt(data.letterIndex, 10));
        }
        break;
      case "letter-review":
        if (window.ReadingScreen) {
          window.ReadingScreen.review(data.known === "true");
        }
        break;
      case "learn-milestone-word":
        if (window.ReadingScreen) window.ReadingScreen.learnMilestoneWord();
        break;
      case "letter-mini-pick":
        if (window.ReadingScreen) window.ReadingScreen.pickMiniAnswer(parseInt(data.pickIndex, 10));
        break;
      case "letter-quiz":
        if (window.ReadingScreen) window.ReadingScreen.launchLetterQuiz();
        break;
      case "letter-rapid":
        if (window.ReadingScreen) window.ReadingScreen.launchLetterRapid();
        break;

      // ===== QUIZ =====
      case "quiz-pick":
        if (window.QuizScreen) {
          window.QuizScreen.pickAnswer(parseInt(data.pickIndex, 10));
        }
        break;
      case "quiz-next":
        if (window.QuizScreen) window.QuizScreen.nextOrCheck();
        break;

      // ===== RAPID =====
      case "start-rapid":
        if (window.RapidScreen) window.RapidScreen.start();
        break;
      case "rapid-pick":
        if (window.RapidScreen) {
          window.RapidScreen.pickAnswer(parseInt(data.pickIndex, 10));
        }
        break;

      // ===== CHAT =====
      case "chat-send":
        if (window.ChatScreen) window.ChatScreen.sendMessage();
        break;
      case "chat-mic":
        if (window.ChatScreen) window.ChatScreen.toggleMic();
        break;
      case "chat-language-toggle":
        if (window.ChatScreen) window.ChatScreen.toggleLanguage();
        break;

      // ===== LISTES =====
      case "create-list":
        if (window.ListsScreen) window.ListsScreen.createList();
        break;
      case "open-list":
        if (window.ListsScreen) window.ListsScreen.openList(data.listId);
        break;
      case "delete-list":
        if (window.ListsScreen) window.ListsScreen.deleteList(data.listId);
        break;
      case "delete-current-list":
        if (window.ListsScreen) window.ListsScreen.deleteCurrentList();
        break;
      case "add-word-to-list":
        if (window.ListsScreen) window.ListsScreen.addWordToCurrentList();
        break;
      case "delete-word":
        if (window.ListsScreen) window.ListsScreen.deleteWord(data.wordId);
        break;
      case "learn-list":
        if (window.ListsScreen) window.ListsScreen.learnList(data.mode);
        break;

      // ===== BADGES =====
      case "show-badge-detail":
        if (window.BadgesScreen) window.BadgesScreen.showBadgeDetail(data.badgeId);
        break;

      // ===== WOTD =====
      case "add-wotd-to-list":
        if (window.WotdScreen) window.WotdScreen.addToList();
        break;

      // ===== CONTACT =====
      case "send-contact":
        if (window.ContactScreen) window.ContactScreen.send();
        break;

      // ===== PREMIUM =====
      case "pay-stripe":
        if (window.PremiumScreen) window.PremiumScreen.payStripe();
        break;
      case "pay-paypal":
        if (window.PremiumScreen) window.PremiumScreen.payPayPal();
        break;
      case "pay-apple":
        if (window.PremiumScreen) window.PremiumScreen.payApple();
        break;
      case "pay-google":
        if (window.PremiumScreen) window.PremiumScreen.payGoogle();
        break;
      case "redeem-code":
        if (window.PremiumScreen) window.PremiumScreen.redeemCode();
        break;

      // ===== SETTINGS =====
      case "reset-data":
        if (window.SettingsScreen) window.SettingsScreen.resetData();
        break;

      // ===== MODALES =====
      case "close-modal":
        closeModal(data.modal);
        break;

      default:
        console.warn("Action inconnue :", action);
    }
  }

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  }

  function getChecked(id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  }

  /* =========================================================
     TOAST
     ========================================================= */
  function toast(msg, duration) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() {
      t.classList.remove("show");
    }, duration || 2000);
  }

  /* =========================================================
     MODALES
     ========================================================= */
  function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.hidden = false;
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.hidden = true;
  }

  function confirm(title, message, onOk) {
    const modal = document.getElementById("modalConfirm");
    if (!modal) return;

    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMsg");
    const okBtn = document.getElementById("confirmOkBtn");

    if (titleEl) titleEl.textContent = title || "Confirmer";
    if (msgEl) msgEl.textContent = message || "";

    if (okBtn) {
      okBtn.onclick = function() {
        closeModal("modalConfirm");
        if (typeof onOk === "function") onOk();
      };
    }

    modal.hidden = false;
  }

  /* =========================================================
     ÉVÉNEMENTS GLOBAUX
     ========================================================= */
  function setupEventListeners() {
    // Badge débloqué → modale
    document.addEventListener("badge-unlocked", function(e) {
      const badge = e.detail;
      if (!badge || !window.XP) return;

      const visualEl = document.getElementById("unlockBadgeVisual");
      const nameEl = document.getElementById("unlockBadgeName");
      const descEl = document.getElementById("unlockBadgeDesc");
      const modal = document.getElementById("modalBadgeUnlock");
      const titleEl = modal ? modal.querySelector(".panel-title") : null;

      if (visualEl) visualEl.innerHTML = window.XP.getBadgeSVG(badge);
      if (nameEl) nameEl.textContent = badge.name;
      if (descEl) descEl.textContent = badge.desc;
      if (titleEl) titleEl.textContent = "Nouveau badge !";
      if (visualEl) {
        visualEl.style.opacity = "1";
        visualEl.style.filter = "";
      }

      showModal("modalBadgeUnlock");
    });

    // Level up → modale
    document.addEventListener("level-up", function(e) {
      const detail = e.detail;
      if (!detail) return;

      const numEl = document.getElementById("levelUpNum");
      const titleEl = document.getElementById("levelUpTitle");

      if (numEl) numEl.textContent = detail.newLevel;
      if (titleEl && window.XP) {
        titleEl.textContent = window.XP.levelTitle(detail.newLevel);
      }

      showModal("modalLevelUp");
    });

    // XP gagnée → animation flottante
    document.addEventListener("xp-gained", function(e) {
      const detail = e.detail;
      if (!detail || !detail.gained) return;
      floatXP(detail.gained);
    });

    // Premium activé → toast
    document.addEventListener("premium-activated", function() {
      toast("✦ Premium activé — bienvenue !");
    });

    // Auth login
    document.addEventListener("auth-login", function() {
      // Le pseudo est mis à jour automatiquement via les bindings
    });
  }

  function floatXP(amount) {
    const el = document.createElement("div");
    el.className = "xp-pop";
    el.textContent = "+" + amount + " XP";
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1300);
  }

  /* =========================================================
     INITIALISATION
     ========================================================= */
  function init() {
    buildStarfield();
    bindActions();
    setupEventListeners();

    // Démarrer sur login si pas connecté, sinon home
    const isLoggedIn = window.State && window.State.get("loggedIn");

    if (isLoggedIn) {
      goto("home");
    } else {
      goto("login");
    }

    // Forcer un refresh des bindings
    if (window.State && window.State.refreshBindings) {
      window.State.refreshBindings();
    }

    console.log("🌙 Dar Al Loughah — App prête");
  }

  // Démarrer quand le DOM est chargé
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* -------- API publique -------- */
  return {
    goto: goto,
    toast: toast,
    confirm: confirm,
    showModal: showModal,
    closeModal: closeModal,
    floatXP: floatXP,
    getCurrentScreen: function() { return currentScreen; }
  };
})();

window.Main = Main;
console.log("✓ Main orchestrator chargé");
