/* =========================================================
   DAR AL LOUGHAH - STATE MANAGER v3 (100% CLOUD-FIRST)
   - Plus de localStorage
   - Cache mémoire + sync Supabase debounced
   - Pull au login, push automatique au changement
   - Mode invité = RAM uniquement (promotion possible)
   - Realtime sync entre onglets via Supabase
   ========================================================= */

const State = (function() {

  // ===== STATE PAR DÉFAUT (RAM) =====
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
    // Compteurs hebdo/mensuel pour leaderboards
    xpThisWeek: 0,
    xpThisMonth: 0,
    wordsThisWeek: 0,
    wordsThisMonth: 0,
    unlocksThisWeek: 0,
    unlocksThisMonth: 0,
    weekKey: "",
    monthKey: "",
    unlocksTotal: 0,
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

  // ===== CACHE MÉMOIRE (pas de localStorage) =====
  let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

  // ===== ÉTAT INTERNE =====
  let pushTimer = null;
  const PUSH_DEBOUNCE_MS = 1000;
  let pendingPush = false;
  let isPushingNow = false;
  let realtimeSub = null;

  // ===== HELPERS BASIQUES =====
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
    schedulePush();
    refreshBindings();
  }

  function update(updater) {
    if (typeof updater === "function") updater(state);
    else if (typeof updater === "object") Object.assign(state, updater);
    schedulePush();
    refreshBindings();
  }

  // ===== MAPPING STATE -> COLONNES SUPABASE =====
  // Convertit notre state JS en format DB
  function stateToDbPayload() {
    return {
      pseudo: state.pseudo,
      avatar: state.avatar,
      auth_method: state.authMethod,
      newsletter: state.newsletter,
      xp: state.xp,
      level: state.level,
      streak: state.streak,
      last_active_day: state.lastActiveDay,
      xp_this_week: state.xpThisWeek,
      xp_this_month: state.xpThisMonth,
      words_this_week: state.wordsThisWeek,
      words_this_month: state.wordsThisMonth,
      unlocks_this_week: state.unlocksThisWeek,
      unlocks_this_month: state.unlocksThisMonth,
      week_key: state.weekKey,
      month_key: state.monthKey,
      words_learned: state.wordsLearned,
      letters_learned: state.lettersLearned,
      mastered_words: state.masteredWords,
      unlocks_total: state.unlocksTotal,
      review_counts: state.reviewCounts,
      quiz_validations: state.quizValidations,
      theme_progress: state.themeProgress,
      unlocked_badges: state.unlockedBadges,
      stats: state.stats,
      preferences: state.settings
      // NOTE: is_premium, is_admin, email = champs sensibles, jamais envoyés depuis le client
    };
  }

  // Convertit une ligne DB en format state JS
  function dbRowToState(row) {
    if (!row) return;
    state.pseudo = row.pseudo || state.pseudo;
    state.email = row.email || state.email;
    state.avatar = row.avatar || "";
    state.authMethod = row.auth_method || state.authMethod;
    state.newsletter = !!row.newsletter;
    state.createdAt = row.created_at ? new Date(row.created_at).getTime() : null;
    state.xp = Number(row.xp) || 0;
    state.level = Number(row.level) || 1;
    state.streak = Number(row.streak) || 0;
    state.lastActiveDay = row.last_active_day || null;
    state.isPremium = !!row.is_premium;
    state.premiumSince = row.premium_since ? new Date(row.premium_since).getTime() : null;
    state.xpThisWeek = Number(row.xp_this_week) || 0;
    state.xpThisMonth = Number(row.xp_this_month) || 0;
    state.wordsThisWeek = Number(row.words_this_week) || 0;
    state.wordsThisMonth = Number(row.words_this_month) || 0;
    state.unlocksThisWeek = Number(row.unlocks_this_week) || 0;
    state.unlocksThisMonth = Number(row.unlocks_this_month) || 0;
    state.weekKey = row.week_key || "";
    state.monthKey = row.month_key || "";
    state.wordsLearned = Array.isArray(row.words_learned) ? row.words_learned : [];
    state.lettersLearned = Array.isArray(row.letters_learned) ? row.letters_learned : [];
    state.masteredWords = Number(row.mastered_words) || 0;
    state.unlocksTotal = Number(row.unlocks_total) || 0;
    state.reviewCounts = row.review_counts || {};
    state.quizValidations = row.quiz_validations || {};
    state.themeProgress = row.theme_progress || {};
    state.unlockedBadges = Array.isArray(row.unlocked_badges) ? row.unlocked_badges : [];
    if (row.stats) state.stats = Object.assign({}, DEFAULT_STATE.stats, row.stats);
    if (row.preferences) state.settings = Object.assign({}, DEFAULT_STATE.settings, row.preferences);
  }

  // ===== SYNC CLOUD : PULL =====
  async function pullFromCloud() {
    if (!window.FB || !window.FB.isReady) return false;
    const client = window.FB.getClient && window.FB.getClient();
    if (!client) return false;
    const user = window.FB.getCurrentUser();
    if (!user) return false;

    try {
      const { data, error } = await client
        .from("profiles")
        .select("*")
        .eq("id", user.uid)
        .maybeSingle();

      if (error) {
        console.warn("pullFromCloud error:", error);
        return false;
      }
      if (data) {
        dbRowToState(data);
        state.loggedIn = true;
        state.uid = user.uid;
        refreshBindings();
        console.log("State chargé depuis Supabase");
        return true;
      }
      return false;
    } catch (e) {
      console.warn("pullFromCloud exception:", e);
      return false;
    }
  }

  // ===== SYNC CLOUD : PUSH (debounced) =====
  function schedulePush() {
    // Mode invité = pas de push cloud, on garde tout en RAM
    if (!state.loggedIn || state.authMethod === "guest") return;
    if (pushTimer) clearTimeout(pushTimer);
    pendingPush = true;
    pushTimer = setTimeout(function() {
      pushToCloud();
    }, PUSH_DEBOUNCE_MS);
  }

  async function pushToCloud() {
    if (isPushingNow) return;
    if (!window.FB || !window.FB.isReady) return;
    const client = window.FB.getClient && window.FB.getClient();
    if (!client) return;
    const user = window.FB.getCurrentUser();
    if (!user) return;

    isPushingNow = true;
    pendingPush = false;
    try {
      const payload = stateToDbPayload();
      const { error } = await client
        .from("profiles")
        .update(payload)
        .eq("id", user.uid);
      if (error) {
        console.warn("pushToCloud error:", error);
        // Re-tentative si erreur réseau ?
      }
    } catch (e) {
      console.warn("pushToCloud exception:", e);
    } finally {
      isPushingNow = false;
    }
  }

  // Force le push immédiat (utile avant logout ou unload)
  async function flushPending() {
    if (pushTimer) {
      clearTimeout(pushTimer);
      pushTimer = null;
    }
    if (pendingPush) {
      await pushToCloud();
    }
  }

  // ===== REALTIME : sync entre onglets =====
  function subscribeRealtime() {
    if (!window.FB || !window.FB.isReady) return;
    const client = window.FB.getClient && window.FB.getClient();
    if (!client) return;
    const user = window.FB.getCurrentUser();
    if (!user) return;
    if (realtimeSub) return; // déjà abonné

    realtimeSub = client
      .channel("profile-changes-" + user.uid)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: "id=eq." + user.uid
      }, function(payload) {
        // On évite de réinjecter notre propre push
        if (isPushingNow) return;
        if (payload && payload.new) {
          dbRowToState(payload.new);
          refreshBindings();
        }
      })
      .subscribe();
  }

  function unsubscribeRealtime() {
    if (realtimeSub) {
      const client = window.FB.getClient && window.FB.getClient();
      if (client) client.removeChannel(realtimeSub);
      realtimeSub = null;
    }
  }

  // ===== PROMOTION INVITÉ -> USER (à appeler après inscription) =====
  async function promoteGuestToUser() {
    if (!window.FB || !window.FB.isReady) return false;
    const client = window.FB.getClient && window.FB.getClient();
    if (!client) return false;
    const user = window.FB.getCurrentUser();
    if (!user) return false;

    state.uid = user.uid;
    state.email = user.email;
    state.loggedIn = true;
    // authMethod sera "email" ou "google", géré par auth.js

    try {
      const payload = stateToDbPayload();
      const { error } = await client
        .from("profiles")
        .update(payload)
        .eq("id", user.uid);
      if (error) {
        console.warn("promoteGuestToUser error:", error);
        return false;
      }
      subscribeRealtime();
      return true;
    } catch (e) {
      console.warn("promoteGuestToUser exception:", e);
      return false;
    }
  }

  // ===== RESET COMPLET =====
  async function reset() {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    refreshBindings();
    // En mode connecté, on push le reset au cloud
    if (state.loggedIn && state.authMethod !== "guest") {
      await pushToCloud();
    }
  }

  // ===== STREAK =====
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
    schedulePush();
    refreshBindings();
  }

  // ===== QUOTA CHAT IA =====
  async function checkChatQuota() {
    const tk = todayKey();
    if (state.chatDate !== tk) {
      state.chatDate = tk;
      state.chatCount = 0;
      // Sync vers Supabase table ia_usage
      await syncIaUsage(tk, 0);
    }
  }

  async function syncIaUsage(date, count) {
    if (!state.loggedIn || state.authMethod === "guest") return;
    if (!window.FB || !window.FB.isReady) return;
    const client = window.FB.getClient && window.FB.getClient();
    if (!client) return;
    const user = window.FB.getCurrentUser();
    if (!user) return;
    try {
      await client.from("ia_usage").upsert({
        user_id: user.uid,
        date: date,
        count: count
      });
    } catch (e) {
      console.warn("syncIaUsage error:", e);
    }
  }

  async function incrementChatCount() {
    await checkChatQuota();
    state.chatCount += 1;
    await syncIaUsage(state.chatDate, state.chatCount);
  }

  function canSendChat() {
    if (window.CONFIG && window.CONFIG.FEATURES && window.CONFIG.FEATURES.PREMIUM_VISIBLE === false) return true;
    if (state.isPremium) return true;
    if (state.chatDate !== todayKey()) return true;
    const limit = (window.CONFIG && window.CONFIG.CHAT_DAILY_LIMIT) || 10;
    return state.chatCount < limit;
  }

  function getChatRemaining() {
    if (window.CONFIG && window.CONFIG.FEATURES && window.CONFIG.FEATURES.PREMIUM_VISIBLE === false) return Infinity;
    if (state.isPremium) return Infinity;
    const limit = (window.CONFIG && window.CONFIG.CHAT_DAILY_LIMIT) || 10;
    return Math.max(0, limit - state.chatCount);
  }

  // ===== BINDINGS UI =====
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

  // ===== LISTES (en table séparée Supabase : user_lists + list_words) =====
  async function createList(name) {
    if (!name || !name.trim()) return null;

    // Mode invité : RAM uniquement
    if (!state.loggedIn || state.authMethod === "guest") {
      const list = { id: "guest_list_" + Date.now(), name: name.trim(), words: [], createdAt: Date.now() };
      state.lists.push(list);
      refreshBindings();
      return list;
    }

    // Mode connecté : insert dans Supabase
    if (!window.FB || !window.FB.isReady) return null;
    const client = window.FB.getClient && window.FB.getClient();
    if (!client) return null;
    const user = window.FB.getCurrentUser();
    if (!user) return null;

    try {
      const { data, error } = await client
        .from("user_lists")
        .insert({ name: name.trim(), user_id: user.uid })
        .select("*")
        .single();
      if (error) { console.warn("createList error:", error); return null; }
      const list = {
        id: data.id,
        name: data.name,
        words: [],
        createdAt: new Date(data.created_at).getTime()
      };
      state.lists.push(list);
      refreshBindings();
      return list;
    } catch (e) {
      console.warn("createList exception:", e);
      return null;
    }
  }

  async function deleteList(id) {
    state.lists = state.lists.filter(function(l) { return l.id !== id; });
    refreshBindings();

    if (!state.loggedIn || state.authMethod === "guest") return true;
    if (id.indexOf("guest_") === 0) return true; // ancienne liste invité

    const client = window.FB && window.FB.getClient && window.FB.getClient();
    if (!client) return false;
    try {
      await client.from("user_lists").delete().eq("id", id);
      return true;
    } catch (e) {
      console.warn("deleteList exception:", e);
      return false;
    }
  }

  function getList(id) {
    return state.lists.find(function(l) { return l.id === id; });
  }

  async function addWordToList(listId, word) {
    const list = getList(listId);
    if (!list) return null;

    const baseWord = {
      ar: word.ar || "",
      translit: word.translit || "",
      fr: word.fr || "",
      example: word.example || "",
      reviews: 0
    };

    // Mode invité : RAM uniquement
    if (!state.loggedIn || state.authMethod === "guest" || listId.indexOf("guest_") === 0) {
      const newWord = Object.assign({
        id: "guest_word_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        addedAt: Date.now()
      }, baseWord);
      list.words.push(newWord);
      refreshBindings();
      return newWord;
    }

    // Mode connecté : insert dans list_words
    const client = window.FB && window.FB.getClient && window.FB.getClient();
    if (!client) return null;
    const user = window.FB.getCurrentUser();
    if (!user) return null;

    try {
      const { data, error } = await client
        .from("list_words")
        .insert(Object.assign({}, baseWord, { list_id: listId, user_id: user.uid }))
        .select("*")
        .single();
      if (error) { console.warn("addWordToList error:", error); return null; }
      const newWord = {
        id: data.id,
        ar: data.ar,
        translit: data.translit,
        fr: data.fr,
        example: data.example,
        reviews: data.reviews,
        addedAt: new Date(data.added_at).getTime()
      };
      list.words.push(newWord);
      refreshBindings();
      return newWord;
    } catch (e) {
      console.warn("addWordToList exception:", e);
      return null;
    }
  }

  async function removeWordFromList(listId, wordId) {
    const list = getList(listId);
    if (!list) return false;
    list.words = list.words.filter(function(w) { return w.id !== wordId; });
    refreshBindings();

    if (!state.loggedIn || state.authMethod === "guest") return true;
    if (wordId.indexOf("guest_") === 0) return true;

    const client = window.FB && window.FB.getClient && window.FB.getClient();
    if (!client) return false;
    try {
      await client.from("list_words").delete().eq("id", wordId);
      return true;
    } catch (e) {
      console.warn("removeWordFromList exception:", e);
      return false;
    }
  }

  async function loadUserLists() {
    state.lists = [];
    if (!state.loggedIn || state.authMethod === "guest") return;
    const client = window.FB && window.FB.getClient && window.FB.getClient();
    if (!client) return;
    const user = window.FB.getCurrentUser();
    if (!user) return;

    try {
      const { data: lists, error: e1 } = await client
        .from("user_lists")
        .select("*")
        .eq("user_id", user.uid)
        .order("created_at", { ascending: true });
      if (e1) { console.warn("loadUserLists lists error:", e1); return; }

      const { data: words, error: e2 } = await client
        .from("list_words")
        .select("*")
        .eq("user_id", user.uid);
      if (e2) { console.warn("loadUserLists words error:", e2); return; }

      state.lists = (lists || []).map(function(l) {
        const myWords = (words || []).filter(function(w) { return w.list_id === l.id; }).map(function(w) {
          return {
            id: w.id, ar: w.ar, translit: w.translit, fr: w.fr,
            example: w.example, reviews: w.reviews,
            addedAt: w.added_at ? new Date(w.added_at).getTime() : Date.now()
          };
        });
        return {
          id: l.id, name: l.name, words: myWords,
          createdAt: new Date(l.created_at).getTime()
        };
      });
      refreshBindings();
    } catch (e) {
      console.warn("loadUserLists exception:", e);
    }
  }

  // ===== REVIEWS (mots maîtrisés) =====
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
    schedulePush();
  }

  function getReviewCount(wordId) { return state.reviewCounts[wordId] || 0; }
  function isWordMastered(wordId) { return state.wordsLearned.includes(wordId); }

  // ===== BADGES =====
  function unlockBadge(badgeId) {
    if (!state.unlockedBadges.includes(badgeId)) {
      state.unlockedBadges.push(badgeId);
      schedulePush();
      return true;
    }
    return false;
  }

  function isBadgeUnlocked(badgeId) {
    return state.unlockedBadges.indexOf(badgeId) !== -1;
  }

  // ===== ADMIN =====
  function isAdmin() {
    const email = state.email;
    if (!email || !window.CONFIG || !window.CONFIG.ADMIN_EMAILS) return false;
    const lowerEmail = email.toLowerCase();
    return window.CONFIG.ADMIN_EMAILS.some(function(e) {
      return e.toLowerCase() === lowerEmail;
    });
  }

  // ===== EXPORT / IMPORT =====
  function exportData() { return JSON.stringify(state, null, 2); }

  function importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      state = deepMerge(JSON.parse(JSON.stringify(DEFAULT_STATE)), parsed);
      schedulePush();
      refreshBindings();
      return true;
    } catch (e) { return false; }
  }

  // ===== ÉTAT DE SYNC =====
  function isGuest() { return !state.loggedIn || state.authMethod === "guest"; }
  function isCloudSyncing() { return isPushingNow || pendingPush; }

  // ===== ÉCOUTE AUTH SUPABASE =====
  // Quand un user se connecte → pull son profil + listes + abonnement realtime
  // Quand il se déconnecte → reset state
  document.addEventListener("firebase-user-changed", async function(e) {
    const detail = e.detail || {};
    const user = detail.user;

    if (user) {
      // Si on était en invité avec des données, on les promeut
      const wasGuestWithData = state.authMethod === "guest" && (state.xp > 0 || state.lists.length > 0);

      // Affiche le loader pendant le pull
      if (window.Main && window.Main.showLoader) window.Main.showLoader();

            // TOUJOURS pull le profil cloud d'abord
      state.uid = user.uid;
      state.email = user.email;
      state.loggedIn = true;

      const hadCloudProfile = await pullFromCloud();

      // On ne "promeut" l'invité QUE s'il n'existait PAS de profil cloud
      // (vrai nouveau compte) ET qu'on avait vraiment des données invité
      if (!hadCloudProfile && wasGuestWithData) {
        state.uid = user.uid;
        state.email = user.email;
        state.loggedIn = true;
        await pushToCloud();
      }

      await loadUserLists();


      subscribeRealtime();
      updateStreak();
      await checkChatQuota();

      if (window.Main && window.Main.hideLoader) window.Main.hideLoader();
    } else {
      // Logout
      unsubscribeRealtime();
      await flushPending();
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
      refreshBindings();
    }
  });

  // ===== FLUSH AVANT FERMETURE =====
  window.addEventListener("beforeunload", function() {
    // Best-effort : on tente le push final (synchrone pas possible, mais Supabase a un buffer)
    if (pendingPush) pushToCloud();
  });

  // ===== INIT =====
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      refreshBindings();
    });
  } else {
    refreshBindings();
  }

  // ===== API PUBLIQUE =====
  return {
    get: get,
    set: set,
    update: update,
    reset: reset,
    refreshBindings: refreshBindings,
    updateStreak: updateStreak,
    checkChatQuota: checkChatQuota,
    incrementChatCount: incrementChatCount,
    canSendChat: canSendChat,
    getChatRemaining: getChatRemaining,
    createList: createList,
    deleteList: deleteList,
    getList: getList,
    addWordToList: addWordToList,
    removeWordFromList: removeWordFromList,
    recordReview: recordReview,
    getReviewCount: getReviewCount,
    isWordMastered: isWordMastered,
    unlockBadge: unlockBadge,
    isBadgeUnlocked: isBadgeUnlocked,
    isAdmin: isAdmin,
    exportData: exportData,
    importData: importData,
    // Nouvelles méthodes cloud
    pullFromCloud: pullFromCloud,
    flushPending: flushPending,
    promoteGuestToUser: promoteGuestToUser,
    isGuest: isGuest,
    isCloudSyncing: isCloudSyncing,
    loadUserLists: loadUserLists
  };
})();

window.State = State;
console.log("State manager cloud-first chargé");
