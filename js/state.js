const State = (function() {

  const STORAGE_KEY = (window.CONFIG && window.CONFIG.STORAGE_KEY) || "dar_al_loughah_v2";

  const DEFAULT_STATE = {
    loggedIn: false,
    pseudo: "Apprenti",
    email: "",
    avatar: "",
    authMethod: "guest",
    uid: "",
    newsletter: false,
    createdAt: null,
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDay: null,
    isPremium: false,
    premiumSince: null,
    premiumPaymentRef: "",
    wordsLearned: [],
    lettersLearned: [],
    masteredWords: 0,
    reviewCounts: {},
    quizValidations: {},
    themeProgress: {},
    lists: [],
    chatCount: 0,
    chatDate: null,
    unlockedBadges: [],
    settings: {
      tapSound: true, feedbackSound: true, ambientSound: false,
      streakNotif: true, wotdNotif: true, showTranslit: true,
      offlineCache: true, shareProgress: false,
      chatLanguage: "fr", chatReadAloud: true
    },
    stats: {
      totalQuizAnswered: 0, totalCorrect: 0,
      perfectQuizzes: 0, bestRapidCombo: 0, themesCompleted: 0
    }
  };

  let state = loadState();

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
      }
    } catch (e) {
      console.warn("State load fail");
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("State save fail"); }
  }

  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        target[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  function get(key) {
    if (!key) return state;
    const parts = key.split(".");
    let val = state;
    for (const part of parts) {
      if (val == null) return undefined;
      val = val[part];
    }
    return val;
  }

  function set(key, value) {
    const parts = key.split(".");
    let obj = state;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
    saveState();
    refreshBindings();
  }

  function update(updater) {
    if (typeof updater === "function") updater(state);
    else if (typeof updater === "object") Object.assign(state, updater);
    saveState();
    refreshBindings();
  }

  function reset() {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    saveState();
    refreshBindings();
  }

  function todayKey() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  function yesterdayKey() {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return y.getFullYear() + "-" + (y.getMonth() + 1) + "-" + y.getDate();
  }

  function updateStreak() {
    const tk = todayKey();
    if (state.lastActiveDay === tk) return;
    if (state.lastActiveDay === yesterdayKey()) state.streak += 1;
    else state.streak = 1;
    state.lastActiveDay = tk;
    saveState();
    refreshBindings();
  }

  function checkChatQuota() {
    const tk = todayKey();
    if (state.chatDate !== tk) {
      state.chatDate = tk;
      state.chatCount = 0;
      saveState();
    }
  }

  function incrementChatCount() {
    checkChatQuota();
    state.chatCount += 1;
    saveState();
  }

  function canSendChat() {
    if (window.CONFIG && window.CONFIG.FEATURES && window.CONFIG.FEATURES.PREMIUM_VISIBLE === false) return true;
    if (state.isPremium) return true;
    checkChatQuota();
    const limit = (window.CONFIG && window.CONFIG.CHAT_DAILY_LIMIT) || 10;
    return state.chatCount < limit;
  }

  function getChatRemaining() {
    if (window.CONFIG && window.CONFIG.FEATURES && window.CONFIG.FEATURES.PREMIUM_VISIBLE === false) return Infinity;
    if (state.isPremium) return Infinity;
    checkChatQuota();
    const limit = (window.CONFIG && window.CONFIG.CHAT_DAILY_LIMIT) || 10;
    return Math.max(0, limit - state.chatCount);
  }

  function refreshBindings() {
    document.querySelectorAll("[data-bind]").forEach(function(el) {
      const key = el.getAttribute("data-bind");
      const value = resolveBinding(key);
      if (value !== undefined && value !== null) el.textContent = value;
    });
  }

  function resolveBinding(key) {
    switch (key) {
      case "pseudo": return state.pseudo;
      case "email": return state.email;
      case "xp": return state.xp.toLocaleString("fr-FR");
      case "level": return state.level;
      case "streak": return state.streak;
      case "premium-price": return ((window.CONFIG && window.CONFIG.PREMIUM_PRICE) || 7.99) + "EUR";
      default: return get(key);
    }
  }

  function createList(name) {
    const list = { id: "list_" + Date.now(), name: name, words: [], createdAt: Date.now() };
    state.lists.push(list);
    saveState();
    return list;
  }

  function deleteList(id) {
    state.lists = state.lists.filter(function(l) { return l.id !== id; });
    saveState();
  }

  function getList(id) {
    return state.lists.find(function(l) { return l.id === id; });
  }

  function addWordToList(listId, word) {
    const list = getList(listId);
    if (!list) return false;
    const newWord = {
      id: "word_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      ar: word.ar || "", translit: word.translit || "",
      fr: word.fr || "", example: word.example || "",
      addedAt: Date.now(), reviews: 0
    };
    list.words.push(newWord);
    saveState();
    return newWord;
  }

  function removeWordFromList(listId, wordId) {
    const list = getList(listId);
    if (!list) return false;
    list.words = list.words.filter(function(w) { return w.id !== wordId; });
    saveState();
    return true;
  }

  function recordReview(wordId, isKnown) {
    if (!state.reviewCounts[wordId]) state.reviewCounts[wordId] = 0;
    if (isKnown) {
      state.reviewCounts[wordId] += 1;
      const threshold = (window.CONFIG && window.CONFIG.WORD_MASTERY_REVIEWS) || 10;
      if (state.reviewCounts[wordId] === threshold && !state.wordsLearned.includes(wordId)) {
        state.wordsLearned.push(wordId);
        state.masteredWords = state.wordsLearned.length;
      }
    }
    saveState();
  }

  function getReviewCount(wordId) { return state.reviewCounts[wordId] || 0; }
  function isWordMastered(wordId) { return state.wordsLearned.includes(wordId); }

  function unlockBadge(badgeId) {
    if (!state.unlockedBadges.includes(badgeId)) {
      state.unlockedBadges.push(badgeId);
      saveState();
      return true;
    }
    return false;
  }

  function isBadgeUnlocked(badgeId) {
    return state.unlockedBadges.indexOf(badgeId) !== -1;
  }

  function isAdmin() {
    const email = state.email;
    if (!email || !window.CONFIG || !window.CONFIG.ADMIN_EMAILS) return false;
    const lowerEmail = email.toLowerCase();
    return window.CONFIG.ADMIN_EMAILS.some(function(e) {
      return e.toLowerCase() === lowerEmail;
    });
  }

  function exportData() { return JSON.stringify(state, null, 2); }

  function importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
      saveState();
      refreshBindings();
      return true;
    } catch (e) { return false; }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      updateStreak();
      checkChatQuota();
      refreshBindings();
    });
  } else {
    updateStreak();
    checkChatQuota();
    refreshBindings();
  }

  return {
    get: get, set: set, update: update, reset: reset,
    refreshBindings: refreshBindings,
    updateStreak: updateStreak,
    checkChatQuota: checkChatQuota,
    incrementChatCount: incrementChatCount,
    canSendChat: canSendChat,
    getChatRemaining: getChatRemaining,
    createList: createList, deleteList: deleteList, getList: getList,
    addWordToList: addWordToList, removeWordFromList: removeWordFromList,
    recordReview: recordReview,
    getReviewCount: getReviewCount,
    isWordMastered: isWordMastered,
    unlockBadge: unlockBadge,
    isBadgeUnlocked: isBadgeUnlocked,
    isAdmin: isAdmin,
    exportData: exportData,
    importData: importData
  };
})();

window.State = State;
