const Main = (function() {

  let currentScreen = null;
  let toastTimeout = null;

  function buildStarfield() {
    const sf = document.getElementById("starfield");
    if (!sf || sf.childElementCount > 0) return;
    for (let i = 0; i < 120; i++) {
      const s = document.createElement("div");
      const r = Math.random();
      let cls = "star";
      if (r < 0.2) cls += " lg";
      else if (r >= 0.5) cls += " sm";
      if (Math.random() < 0.12) cls += " gold";
      s.className = cls;
      s.style.left = Math.random() * 100 + "%";
      s.style.top = Math.random() * 100 + "%";
      s.style.setProperty("--dur", (2 + Math.random() * 4) + "s");
      s.style.setProperty("--delay", (-Math.random() * 4) + "s");
      sf.appendChild(s);
    }
  }
  let loaderTimer = null;
  let loaderShownAt = 0;
  const LOADER_MIN_DURATION = 500;

  function showLoader() {
    const el = document.getElementById("loadingScreen");
    if (!el) return;
    if (loaderTimer) { clearTimeout(loaderTimer); loaderTimer = null; }
    el.classList.remove("hide");
    loaderShownAt = Date.now();
  }

  function hideLoader() {
    const el = document.getElementById("loadingScreen");
    if (!el) return;
    const elapsed = Date.now() - loaderShownAt;
    const remaining = Math.max(0, LOADER_MIN_DURATION - elapsed);
    if (loaderTimer) clearTimeout(loaderTimer);
    loaderTimer = setTimeout(function() {
      el.classList.add("hide");
    }, remaining);
  }

    function goto(screenName) {
    if (!screenName) return;
    showLoader();
    if (currentScreen === "chat" && window.ChatScreen && window.ChatScreen.leave) window.ChatScreen.leave();
    if (currentScreen === "rapid" && window.RapidScreen && window.RapidScreen.stop) window.RapidScreen.stop();
    document.querySelectorAll(".screen").forEach(function(s) { s.classList.remove("active"); });

    const target = document.getElementById("screen-" + screenName);
    if (target) {
      target.classList.add("active");
      currentScreen = screenName;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else { return; }
    document.querySelectorAll(".nav-item").forEach(function(item) {
      const t = item.getAttribute("data-target");
      item.classList.toggle("active",
        t === screenName ||
        (t === "themes" && (screenName === "vocab" || screenName === "theme-levels" || screenName === "lesson")) ||
        (t === "profile" && (screenName === "badges" || screenName === "settings"))
      );
    });
    const navBar = document.getElementById("navBar");
    if (navBar) navBar.style.display = (screenName === "login" || screenName === "register") ? "none" : "grid";
        callScreenShow(screenName);
    hideLoader();
  }


  function callScreenShow(screenName) {
    const map = {
      "home": window.HomeScreen, "themes": window.ThemesScreen, "theme-levels": window.ThemesScreen,
      "vocab": window.VocabScreen, "reading": window.ReadingScreen, "quiz": window.QuizScreen,
      "rapid": window.RapidScreen, "chat": window.ChatScreen, "lists": window.ListsScreen,
      "list-detail": window.ListsScreen, "groups": window.GroupsScreen, "profile": window.ProfileScreen, "badges": window.BadgesScreen,
      "wotd": window.WotdScreen, "contact": window.ContactScreen, "premium": window.PremiumScreen,
      "settings": window.SettingsScreen, "admin": window.AdminScreen, "lesson": window.HomeScreen
    };
    const screenObj = map[screenName];
    if (!screenObj) return;
    if (screenName === "list-detail" && screenObj.showDetail) screenObj.showDetail();
    else if (screenObj.show) { try { screenObj.show(); } catch (e) { console.error("Erreur show()", screenName, e); } }
  }

  function bindActions() {
    document.addEventListener("click", function(e) {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      const action = target.getAttribute("data-action");
      const data = target.dataset;
      const noTapSound = ["chat-mic", "chat-send", "quiz-pick", "rapid-pick"];
      if (window.Audio && noTapSound.indexOf(action) === -1) window.Audio.tap();
      handleAction(action, data, target, e);
    });
    document.addEventListener("submit", function(e) {
      const form = e.target;
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) {
        const action = submitBtn.getAttribute("data-action");
        if (action) { e.preventDefault(); handleAction(action, submitBtn.dataset, submitBtn, e); }
      }
    });
  }

  function handleAction(action, data, target, event) {
    if (event && event.preventDefault) event.preventDefault();
    switch (action) {
      case "goto": goto(data.target); break;

      case "login-google":
        if (!window.Auth) { toast("Auth non charge"); break; }
        window.Auth.loginGoogle().then(function(r) {
          if (r && r.success) goto("home");
          else if (r && r.error) toast(r.error);
          else toast("Connexion Google echouee");
        }).catch(function(err) { toast("Erreur Google: " + (err.message || err)); });
        break;

      case "login-apple":
        if (!window.Auth) { toast("Auth non charge"); break; }
        window.Auth.loginApple().then(function(r) {
          if (r && r.success) goto("home");
          else if (r && r.error) toast(r.error);
        }).catch(function(err) { toast("Erreur Apple: " + (err.message || err)); });
        break;

      case "login-email":
        const lE = document.getElementById("loginEmail");
        const lP = document.getElementById("loginPass");
        if (!window.Auth) { toast("Auth non charge"); break; }
        if (!lE || !lP) { toast("Champs introuvables"); break; }
        if (!lE.value || !lP.value) { toast("Remplis email et mot de passe"); break; }
        window.Auth.loginEmail(lE.value, lP.value).then(function(r) {
          if (r && r.success) goto("home");
          else if (r && r.error) toast(r.error);
          else toast("Connexion echouee");
        }).catch(function(err) { toast("Erreur: " + (err.message || err)); });
        break;

      case "login-guest":
        if (window.Auth) { window.Auth.loginGuest(); goto("home"); }
        break;

      case "show-register": goto("register"); break;

      case "register":
        const rF = {
          pseudo: getValue("regPseudo"), email: getValue("regEmail"),
          password: getValue("regPass"), passwordConfirm: getValue("regPassConfirm"),
          newsletter: getChecked("regNewsletter"), terms: getChecked("regTerms")
        };
        if (!window.Auth) { toast("Auth non charge"); break; }
        window.Auth.register(rF).then(function(r) {
          if (r && r.success) goto("home");
          else if (r && r.error) toast(r.error);
        }).catch(function(err) { toast("Erreur: " + (err.message || err)); });
        break;

      case "logout": if (window.ProfileScreen) window.ProfileScreen.logout(); break;
      case "save-pseudo": if (window.ProfileScreen) window.ProfileScreen.savePseudo(); break;
      case "export-data": if (window.ProfileScreen) window.ProfileScreen.exportData(); break;

      case "open-theme": if (window.ThemesScreen) window.ThemesScreen.openTheme(data.themeId); break;
      case "select-level": if (window.ThemesScreen) window.ThemesScreen.selectLevel(data.levelId, data.themeId); break;
      case "practice-theme": if (window.ThemesScreen) window.ThemesScreen.practiceTheme(data.mode); break;

      case "flip-card": if (window.VocabScreen) window.VocabScreen.flip(); break;
      case "vocab-review": if (window.VocabScreen) window.VocabScreen.review(data.known === "true"); break;
      case "vocab-mini-pick": if (window.VocabScreen) window.VocabScreen.pickMiniAnswer(parseInt(data.pickIndex, 10)); break;
      case "speak-word":
        if (currentScreen === "wotd" && window.WotdScreen) window.WotdScreen.speak();
        else if (window.VocabScreen) window.VocabScreen.speakCurrent();
        break;

      case "select-letter": if (window.ReadingScreen) window.ReadingScreen.selectLetter(parseInt(data.letterIndex, 10)); break;
      case "letter-review": if (window.ReadingScreen) window.ReadingScreen.review(data.known === "true"); break;
      case "learn-milestone-word": if (window.ReadingScreen) window.ReadingScreen.learnMilestoneWord(); break;
      case "letter-mini-pick": if (window.ReadingScreen) window.ReadingScreen.pickMiniAnswer(parseInt(data.pickIndex, 10)); break;
      case "letter-quiz": if (window.ReadingScreen) window.ReadingScreen.launchLetterQuiz(); break;
      case "letter-rapid": if (window.ReadingScreen) window.ReadingScreen.launchLetterRapid(); break;

      case "quiz-pick": if (window.QuizScreen) window.QuizScreen.pickAnswer(parseInt(data.pickIndex, 10)); break;
      case "quiz-next": if (window.QuizScreen) window.QuizScreen.nextOrCheck(); break;

      case "start-rapid": if (window.RapidScreen) window.RapidScreen.start(); break;
      case "rapid-pick": if (window.RapidScreen) window.RapidScreen.pickAnswer(parseInt(data.pickIndex, 10)); break;

      case "chat-send": if (window.ChatScreen) window.ChatScreen.sendMessage(); break;
      case "chat-mic": if (window.ChatScreen) window.ChatScreen.toggleMic(); break;
      case "chat-language-toggle": if (window.ChatScreen) window.ChatScreen.toggleLanguage(); break;

      case "create-list": if (window.ListsScreen) window.ListsScreen.createList(); break;
      case "open-list": if (window.ListsScreen) window.ListsScreen.openList(data.listId); break;
      case "delete-list": if (window.ListsScreen) window.ListsScreen.deleteList(data.listId); break;
      case "delete-current-list": if (window.ListsScreen) window.ListsScreen.deleteCurrentList(); break;
      case "add-word-to-list": if (window.ListsScreen) window.ListsScreen.addWordToCurrentList(); break;
      case "delete-word": if (window.ListsScreen) window.ListsScreen.deleteWord(data.wordId); break;
      case "learn-list": if (window.ListsScreen) window.ListsScreen.learnList(data.mode); break;

      case "show-badge-detail": if (window.BadgesScreen) window.BadgesScreen.showBadgeDetail(data.badgeId); break;

      case "add-wotd-to-list": if (window.WotdScreen) window.WotdScreen.addToList(); break;

      case "send-contact": if (window.ContactScreen) window.ContactScreen.send(); break;

      case "pay-stripe": if (window.PremiumScreen) window.PremiumScreen.payStripe(); break;
      case "pay-paypal": if (window.PremiumScreen) window.PremiumScreen.payPayPal(); break;
      case "pay-apple": if (window.PremiumScreen) window.PremiumScreen.payApple(); break;
      case "pay-google": if (window.PremiumScreen) window.PremiumScreen.payGoogle(); break;
      case "redeem-code": if (window.PremiumScreen) window.PremiumScreen.redeemCode(); break;

      case "reset-data": if (window.SettingsScreen) window.SettingsScreen.resetData(); break;

      case "close-modal": closeModal(data.modal); break;

      default: console.warn("Action inconnue :", action);
    }
  }

  function getValue(id) { const el = document.getElementById(id); return el ? el.value : ""; }
  function getChecked(id) { const el = document.getElementById(id); return el ? el.checked : false; }

  function toast(msg, duration) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() { t.classList.remove("show"); }, duration || 3000);
  }

  function showModal(modalId) { const m = document.getElementById(modalId); if (m) m.hidden = false; }
  function closeModal(modalId) { const m = document.getElementById(modalId); if (m) m.hidden = true; }

  function confirm(title, message, onOk) {
    const modal = document.getElementById("modalConfirm");
    if (!modal) return;
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMsg");
    const okBtn = document.getElementById("confirmOkBtn");
    if (titleEl) titleEl.textContent = title || "Confirmer";
    if (msgEl) msgEl.textContent = message || "";
    if (okBtn) okBtn.onclick = function() { closeModal("modalConfirm"); if (typeof onOk === "function") onOk(); };
    modal.hidden = false;
  }

  function setupEventListeners() {
    document.addEventListener("firebase-user-changed", function(e) {
      const adminItem = document.getElementById("adminMenuItem");
      if (adminItem) adminItem.hidden = !(e.detail && e.detail.isAdmin);
    });

    document.addEventListener("badge-unlocked", function(e) {
      const badge = e.detail;
      if (!badge || !window.XP) return;
      const visualEl = document.getElementById("unlockBadgeVisual");
      const nameEl = document.getElementById("unlockBadgeName");
      const descEl = document.getElementById("unlockBadgeDesc");
      if (visualEl) visualEl.innerHTML = window.XP.getBadgeSVG(badge);
      if (nameEl) nameEl.textContent = badge.name;
      if (descEl) descEl.textContent = badge.desc;
      showModal("modalBadgeUnlock");
    });

    document.addEventListener("level-up", function(e) {
      const detail = e.detail;
      if (!detail) return;
      const numEl = document.getElementById("levelUpNum");
      const titleEl = document.getElementById("levelUpTitle");
      if (numEl) numEl.textContent = detail.newLevel;
      if (titleEl && window.XP) titleEl.textContent = window.XP.levelTitle(detail.newLevel);
      showModal("modalLevelUp");
    });

    document.addEventListener("xp-gained", function(e) {
      if (e.detail && e.detail.gained) floatXP(e.detail.gained);
    });

    document.addEventListener("premium-activated", function() { toast("Premium active"); });
  }

  function floatXP(amount) {
    const el = document.createElement("div");
    el.className = "xp-pop";
    el.textContent = "+" + amount + " XP";
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1300);
  }

  function init() {
    buildStarfield();
    bindActions();
    setupEventListeners();
    const isLoggedIn = window.State && window.State.get("loggedIn");
    goto(isLoggedIn ? "home" : "login");
    if (window.State && window.State.refreshBindings) window.State.refreshBindings();
    console.log("Dar Al Loughah - App prete");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

    return {
    goto: goto, toast: toast, confirm: confirm,
    showModal: showModal, closeModal: closeModal, floatXP: floatXP,
    showLoader: showLoader, hideLoader: hideLoader,
    getCurrentScreen: function() { return currentScreen; }
  };

})();

window.Main = Main;
