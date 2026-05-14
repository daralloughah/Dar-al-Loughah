/* =========================================================
   DAR AL LOUGHAH — XP, NIVEAUX, BADGES (v2 hebdo/mensuel)
   - Formule: niveau N nécessite 35 × N × (N+1) XP cumulés
   - Niveau 200 ≈ 700 000 XP ≈ 7000 mots appris
   - Mouallim ≈ niveau ~250 ≈ 12 000 mots
   - Compteurs hebdo / mensuel pour classements
   ========================================================= */

const XP = (function() {

  const CFG = window.CONFIG || {};

  /* =========================================================
     FORMULE DE NIVEAU
     ========================================================= */
  function xpRequiredForLevel(level) {
    return 35 * level * (level + 1);
  }

  function xpToNextLevel(currentLevel) {
    return xpRequiredForLevel(currentLevel + 1) - xpRequiredForLevel(currentLevel);
  }

  function levelFromXP(totalXP) {
    if (totalXP < 70) return 1;
    let N = Math.floor((-1 + Math.sqrt(1 + 4 * totalXP / 35)) / 2);
    while (xpRequiredForLevel(N + 1) <= totalXP) N++;
    while (xpRequiredForLevel(N) > totalXP) N--;
    return Math.max(1, N);
  }

  function xpInCurrentLevel(totalXP) {
    const lvl = levelFromXP(totalXP);
    return totalXP - xpRequiredForLevel(lvl);
  }

  /* =========================================================
     TITRES DE NIVEAU
     ========================================================= */
  function levelTitle(level) {
    if (level >= 250) return "Mouallim — مُعَلِّم";
    if (level >= 200) return "Légende";
    if (level >= 150) return "Maître Calligraphe";
    if (level >= 100) return "Sage";
    if (level >= 75)  return "Érudit";
    if (level >= 50)  return "Lettré accompli";
    if (level >= 30)  return "Lettré";
    if (level >= 20)  return "Voyageur des mots";
    if (level >= 10)  return "Apprenti lettré";
    if (level >= 5)   return "Apprenti";
    return "Débutant";
  }

  /* =========================================================
     AJOUTER DE L'XP (avec compteurs hebdo/mensuel)
     ========================================================= */
  function addXP(amount, reason) {
    if (!window.State) return { gained: 0, levelUp: false };

    let gained = amount;
    if (window.State.get("isPremium")) {
      const mult = (CFG.XP && CFG.XP.PREMIUM_MULTIPLIER) || 2;
      gained = amount * mult;
    }

    const oldXP = window.State.get("xp") || 0;
    const oldLevel = window.State.get("level") || 1;
    const newXP = oldXP + gained;
    const newLevel = levelFromXP(newXP);

    // Compteurs hebdo / mensuel (avec auto-reset si periode changee)
    let xpThisWeek = window.State.get("xpThisWeek") || 0;
    let xpThisMonth = window.State.get("xpThisMonth") || 0;
    let weekKey = window.State.get("weekKey") || "";
    let monthKey = window.State.get("monthKey") || "";

    if (window.PeriodReset) {
      const currentWeek = window.PeriodReset.getCurrentWeekKey();
      const currentMonth = window.PeriodReset.getCurrentMonthKey();
      if (weekKey !== currentWeek) {
        xpThisWeek = 0;
        weekKey = currentWeek;
      }
      if (monthKey !== currentMonth) {
        xpThisMonth = 0;
        monthKey = currentMonth;
      }
    }

    xpThisWeek += gained;
    xpThisMonth += gained;

    window.State.update({
      xp: newXP,
      level: newLevel,
      xpThisWeek: xpThisWeek,
      xpThisMonth: xpThisMonth,
      weekKey: weekKey,
      monthKey: monthKey
    });

    const result = {
      gained: gained,
      reason: reason || "",
      levelUp: newLevel > oldLevel,
      newLevel: newLevel,
      oldLevel: oldLevel
    };

    document.dispatchEvent(new CustomEvent("xp-gained", { detail: result }));
    if (result.levelUp) {
      document.dispatchEvent(new CustomEvent("level-up", { detail: result }));
      if (window.Audio) window.Audio.levelUp();
    }

    checkBadges();
    return result;
  }

  /* =========================================================
     INCREMENT MOTS / DEBLOCABLES (avec auto-reset)
     ========================================================= */
  function incrementWordCount() {
    if (!window.State) return;
    const total = (window.State.get("masteredWords") || 0) + 1;
    let wordsThisWeek = window.State.get("wordsThisWeek") || 0;
    let wordsThisMonth = window.State.get("wordsThisMonth") || 0;
    let weekKey = window.State.get("weekKey") || "";
    let monthKey = window.State.get("monthKey") || "";

    if (window.PeriodReset) {
      const currentWeek = window.PeriodReset.getCurrentWeekKey();
      const currentMonth = window.PeriodReset.getCurrentMonthKey();
      if (weekKey !== currentWeek) { wordsThisWeek = 0; weekKey = currentWeek; }
      if (monthKey !== currentMonth) { wordsThisMonth = 0; monthKey = currentMonth; }
    }

    wordsThisWeek++;
    wordsThisMonth++;

    window.State.update({
      masteredWords: total,
      wordsThisWeek: wordsThisWeek,
      wordsThisMonth: wordsThisMonth,
      weekKey: weekKey,
      monthKey: monthKey
    });
  }

  function incrementUnlockCount() {
    if (!window.State) return;
    const total = (window.State.get("unlocksTotal") || 0) + 1;
    let unlocksThisWeek = window.State.get("unlocksThisWeek") || 0;
    let unlocksThisMonth = window.State.get("unlocksThisMonth") || 0;
    let weekKey = window.State.get("weekKey") || "";
    let monthKey = window.State.get("monthKey") || "";

    if (window.PeriodReset) {
      const currentWeek = window.PeriodReset.getCurrentWeekKey();
      const currentMonth = window.PeriodReset.getCurrentMonthKey();
      if (weekKey !== currentWeek) { unlocksThisWeek = 0; weekKey = currentWeek; }
      if (monthKey !== currentMonth) { unlocksThisMonth = 0; monthKey = currentMonth; }
    }

    unlocksThisWeek++;
    unlocksThisMonth++;

    window.State.update({
      unlocksTotal: total,
      unlocksThisWeek: unlocksThisWeek,
      unlocksThisMonth: unlocksThisMonth,
      weekKey: weekKey,
      monthKey: monthKey
    });
  }

  /* =========================================================
     LES 30 BADGES
     ========================================================= */
  const BADGES = [
    // ===== ASSIDUITÉ (6) =====
    { id: "streak_3",   cat: "assiduity", name: "Premier Élan",      desc: "3 jours consécutifs",     tier: "bronze",  shape: "lantern",  letter: "ث", check: function(s) { return s.streak >= 3; } },
    { id: "streak_7",   cat: "assiduity", name: "Une Semaine",       desc: "7 jours consécutifs",     tier: "bronze",  shape: "moon",     letter: "س", check: function(s) { return s.streak >= 7; } },
    { id: "streak_30",  cat: "assiduity", name: "Constance",         desc: "30 jours consécutifs",    tier: "silver",  shape: "octagon",  letter: "ث", check: function(s) { return s.streak >= 30; } },
    { id: "streak_100", cat: "assiduity", name: "Veilleur",          desc: "100 jours consécutifs",   tier: "gold",    shape: "star8",    letter: "ر", check: function(s) { return s.streak >= 100; } },
    { id: "streak_365", cat: "assiduity", name: "L'Année Sacrée",    desc: "365 jours consécutifs",   tier: "ruby",    shape: "medallion",letter: "ع", check: function(s) { return s.streak >= 365; } },
    { id: "streak_1000",cat: "assiduity", name: "L'Éternel",         desc: "1000 jours consécutifs",  tier: "rare",    shape: "sun",      letter: "خ", check: function(s) { return s.streak >= 1000; } },

    // ===== VOCABULAIRE (6) =====
    { id: "vocab_10",    cat: "vocab", name: "Premiers Mots",   desc: "10 mots appris",     tier: "bronze",  shape: "octagon",  letter: "أ", check: function(s) { return (s.masteredWords || 0) >= 10; } },
    { id: "vocab_50",    cat: "vocab", name: "Lexique Naissant", desc: "50 mots appris",    tier: "bronze",  shape: "octagon",  letter: "ب", check: function(s) { return (s.masteredWords || 0) >= 50; } },
    { id: "vocab_100",   cat: "vocab", name: "Centurion",       desc: "100 mots appris",    tier: "silver",  shape: "shield",   letter: "م", check: function(s) { return (s.masteredWords || 0) >= 100; } },
    { id: "vocab_500",   cat: "vocab", name: "Polyglotte",      desc: "500 mots appris",    tier: "gold",    shape: "star8",    letter: "خ", check: function(s) { return (s.masteredWords || 0) >= 500; } },
    { id: "vocab_1000",  cat: "vocab", name: "Érudit",          desc: "1 000 mots appris",  tier: "lapis",   shape: "book",     letter: "ع", check: function(s) { return (s.masteredWords || 0) >= 1000; } },
    { id: "vocab_5000",  cat: "vocab", name: "Maître des Mots", desc: "5 000 mots appris",  tier: "rare",    shape: "crown",    letter: "ح", check: function(s) { return (s.masteredWords || 0) >= 5000; } },

    // ===== XP (6) =====
    { id: "xp_1k",   cat: "xp", name: "Étincelle",       desc: "1 000 XP",     tier: "bronze",  shape: "star8",    letter: "١", check: function(s) { return (s.xp || 0) >= 1000; } },
    { id: "xp_10k",  cat: "xp", name: "Brasier",         desc: "10 000 XP",    tier: "silver",  shape: "star8",    letter: "٢", check: function(s) { return (s.xp || 0) >= 10000; } },
    { id: "xp_50k",  cat: "xp", name: "Phare",           desc: "50 000 XP",    tier: "gold",    shape: "star8",    letter: "٣", check: function(s) { return (s.xp || 0) >= 50000; } },
    { id: "xp_100k", cat: "xp", name: "Soleil Levant",   desc: "100 000 XP",   tier: "gold",    shape: "sun",      letter: "٤", check: function(s) { return (s.xp || 0) >= 100000; } },
    { id: "xp_300k", cat: "xp", name: "Étoile Polaire",  desc: "300 000 XP",   tier: "lapis",   shape: "compass",  letter: "٥", check: function(s) { return (s.xp || 0) >= 300000; } },
    { id: "xp_700k", cat: "xp", name: "Cosmos",          desc: "700 000 XP",   tier: "rare",    shape: "galaxy",   letter: "٧", check: function(s) { return (s.xp || 0) >= 700000; } },

    // ===== PERFORMANCE (4) =====
    { id: "perf_perfect_quiz", cat: "performance", name: "Œil de Faucon",   desc: "Quiz 10/10 sans faute",   tier: "silver", shape: "eye",     letter: "د", check: function(s) { return (s.stats && s.stats.perfectQuizzes >= 1); } },
    { id: "perf_combo_20",     cat: "performance", name: "Combo Maître",    desc: "Combo ×20 en révision",   tier: "gold",   shape: "lightning",letter: "ك", check: function(s) { return (s.stats && s.stats.bestRapidCombo >= 20); } },
    { id: "perf_combo_50",     cat: "performance", name: "Foudre Pure",     desc: "Combo ×50 en révision",   tier: "rare",   shape: "lightning",letter: "ق", check: function(s) { return (s.stats && s.stats.bestRapidCombo >= 50); } },
    { id: "perf_quiz_master",  cat: "performance", name: "Maître Quiziste", desc: "100 questions correctes", tier: "lapis",  shape: "scroll",   letter: "ج", check: function(s) { return (s.stats && s.stats.totalCorrect >= 100); } },

    // ===== LECTURE (3) =====
    { id: "read_10",   cat: "reading", name: "Premiers Tracés",  desc: "10 lettres apprises",   tier: "bronze", shape: "feather",  letter: "ا", check: function(s) { return (s.lettersLearned && s.lettersLearned.length >= 10); } },
    { id: "read_28",   cat: "reading", name: "Alphabet Complet", desc: "Les 28 lettres",        tier: "gold",   shape: "rosette",  letter: "ل", check: function(s) { return (s.lettersLearned && s.lettersLearned.length >= 28); } },
    { id: "read_word", cat: "reading", name: "Première Lecture", desc: "Premier mot lu seul",   tier: "silver", shape: "book",     letter: "ق", check: function(s) { return s.firstWordRead === true; } },

    // ===== THÈMES (3) =====
    { id: "theme_1",   cat: "themes", name: "Premier Voyage",   desc: "1 thème terminé",   tier: "bronze",  shape: "compass",  letter: "ف", check: function(s) { return (s.stats && s.stats.themesCompleted >= 1); } },
    { id: "theme_5",   cat: "themes", name: "Cinq Horizons",    desc: "5 thèmes terminés", tier: "gold",    shape: "compass",  letter: "ه", check: function(s) { return (s.stats && s.stats.themesCompleted >= 5); } },
    { id: "theme_all", cat: "themes", name: "Maître des Thèmes",desc: "Tous les thèmes",   tier: "rare",    shape: "crown",    letter: "ت", check: function(s) { return (s.stats && s.stats.themesCompleted >= 11); } },

    // ===== SPÉCIAL (2) =====
    { id: "special_premium",       cat: "special", name: "Pass Premium",  desc: "Membre Premium",     tier: "rare",   shape: "crown",     letter: "★", check: function(s) { return s.isPremium === true; } },
    { id: "special_early_adopter", cat: "special", name: "Early Adopter", desc: "Premier supporter",  tier: "rare",   shape: "medallion", letter: "أ", check: function(s) {
      if (!s.createdAt) return false;
      const monthMs = 30 * 24 * 3600 * 1000;
      return (Date.now() - s.createdAt) < monthMs && s.createdAt < new Date("2026-12-31").getTime();
    } }
  ];

  /* =========================================================
     COULEURS DES TIERS
     ========================================================= */
  const TIER_COLORS = {
    bronze:  { primary: "#E8B07A", secondary: "#7A4A1E", grad: "bronzeGrad"  },
    silver:  { primary: "#F0F4FA", secondary: "#8A96B2", grad: "silverGrad"  },
    gold:    { primary: "#F4D77A", secondary: "#A07A1C", grad: "goldGradV"   },
    lapis:   { primary: "#3A6BD4", secondary: "#0F2A6A", grad: "lapisGrad"   },
    emerald: { primary: "#5EE0A5", secondary: "#0F5A3A", grad: "emeraldGrad" },
    ruby:    { primary: "#FF7A9A", secondary: "#7A0F2A", grad: "rubyGrad"    },
    rare:    { primary: "#F4D77A", secondary: "#7A0F2A", grad: "goldGradV"   }
  };

  /* =========================================================
     GÉNÉRATION SVG DES BADGES
     ========================================================= */
  function getBadgeSVG(badge) {
    const tier = TIER_COLORS[badge.tier] || TIER_COLORS.gold;
    const grad = "url(#" + tier.grad + ")";
    const shape = badge.shape || "octagon";
    const letter = badge.letter || "★";
    const isRare = badge.tier === "rare";
    const rareGlow = isRare ? '<circle cx="50" cy="50" r="48" fill="none" stroke="#F4D77A" stroke-width="0.5" opacity="0.6"/>' : "";
    const innerStar = isRare ? '<circle cx="50" cy="14" r="2.5" fill="#FFFCE0"/>' : "";

    let shapeSVG = "";

    switch (shape) {
      case "lantern":
        shapeSVG =
          '<rect x="32" y="22" width="36" height="50" rx="8" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<rect x="36" y="26" width="28" height="42" rx="4" fill="rgba(0,0,0,0.15)"/>' +
          '<path d="M40 18 L60 18 L62 22 L38 22 Z" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1"/>' +
          '<path d="M50 12 L50 18" stroke="' + grad + '" stroke-width="1.5"/>';
        break;
      case "moon":
        shapeSVG =
          '<path d="M 70 20 A 30 30 0 1 0 70 80 A 22 22 0 1 1 70 20 Z" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>';
        break;
      case "octagon":
        shapeSVG =
          '<polygon points="35,15 65,15 85,35 85,65 65,85 35,85 15,65 15,35" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<polygon points="40,22 60,22 78,40 78,60 60,78 40,78 22,60 22,40" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="0.8"/>';
        break;
      case "star8":
        shapeSVG =
          '<polygon points="50,8 58,30 80,22 70,42 92,50 70,58 80,78 58,70 50,92 42,70 20,78 30,58 8,50 30,42 20,22 42,30" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<circle cx="50" cy="50" r="18" fill="rgba(0,0,0,0.18)"/>';
        break;
      case "medallion":
        shapeSVG =
          '<circle cx="50" cy="50" r="38" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.5"/>' +
          '<circle cx="50" cy="50" r="32" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="0.8"/>' +
          '<circle cx="50" cy="50" r="26" fill="rgba(0,0,0,0.12)"/>' +
          '<path d="M30 50 Q50 30 70 50 Q50 70 30 50" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>';
        break;
      case "sun":
        shapeSVG =
          '<g>' +
          '<circle cx="50" cy="50" r="22" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1"/>' +
          '<g stroke="' + tier.secondary + '" stroke-width="1.4" stroke-linecap="round">' +
          '<line x1="50" y1="14" x2="50" y2="22"/>' +
          '<line x1="50" y1="78" x2="50" y2="86"/>' +
          '<line x1="14" y1="50" x2="22" y2="50"/>' +
          '<line x1="78" y1="50" x2="86" y2="50"/>' +
          '<line x1="24" y1="24" x2="30" y2="30"/>' +
          '<line x1="70" y1="70" x2="76" y2="76"/>' +
          '<line x1="24" y1="76" x2="30" y2="70"/>' +
          '<line x1="70" y1="30" x2="76" y2="24"/>' +
          '</g></g>';
        break;
      case "shield":
        shapeSVG =
          '<path d="M50 10 L82 22 L82 50 Q82 75 50 90 Q18 75 18 50 L18 22 Z" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<path d="M50 18 L74 28 L74 52 Q74 70 50 82 Q26 70 26 52 L26 28 Z" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="0.6"/>';
        break;
      case "book":
        shapeSVG =
          '<path d="M14 22 Q50 14 86 22 L86 76 Q50 68 14 76 Z" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<line x1="50" y1="20" x2="50" y2="74" stroke="rgba(0,0,0,0.3)" stroke-width="1"/>' +
          '<path d="M22 32 H40 M22 40 H38 M60 32 H78 M62 40 H78" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>';
        break;
      case "crown":
        shapeSVG =
          '<path d="M14 32 L26 52 L38 24 L50 56 L62 24 L74 52 L86 32 L82 76 H18 Z" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<circle cx="14" cy="32" r="3" fill="' + tier.primary + '" stroke="' + tier.secondary + '" stroke-width="0.8"/>' +
          '<circle cx="86" cy="32" r="3" fill="' + tier.primary + '" stroke="' + tier.secondary + '" stroke-width="0.8"/>' +
          '<circle cx="50" cy="22" r="3" fill="' + tier.primary + '" stroke="' + tier.secondary + '" stroke-width="0.8"/>';
        break;
      case "eye":
        shapeSVG =
          '<path d="M10 50 Q50 18 90 50 Q50 82 10 50 Z" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<circle cx="50" cy="50" r="14" fill="rgba(0,0,0,0.7)"/>' +
          '<circle cx="50" cy="50" r="6" fill="' + tier.primary + '"/>';
        break;
      case "lightning":
        shapeSVG =
          '<polygon points="35,15 35,15 65,15 85,35 85,65 65,85 35,85 15,65 15,35" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<path d="M52 18 L34 50 L46 50 L40 82 L66 44 L52 44 Z" fill="rgba(0,0,0,0.7)" stroke="' + tier.primary + '" stroke-width="0.8"/>';
        break;
      case "scroll":
        shapeSVG =
          '<rect x="18" y="20" width="64" height="60" rx="6" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<line x1="18" y1="32" x2="82" y2="32" stroke="rgba(0,0,0,0.3)" stroke-width="0.6"/>' +
          '<line x1="18" y1="68" x2="82" y2="68" stroke="rgba(0,0,0,0.3)" stroke-width="0.6"/>' +
          '<path d="M28 42 H72 M28 50 H68 M28 58 H72" stroke="rgba(0,0,0,0.25)" stroke-width="0.6"/>';
        break;
      case "feather":
        shapeSVG =
          '<path d="M30 80 Q40 60 50 50 Q60 40 70 24 Q72 40 64 56 Q56 72 40 80 Z" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<line x1="30" y1="80" x2="65" y2="32" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>';
        break;
      case "rosette":
        shapeSVG =
          '<g>' +
          '<circle cx="50" cy="50" r="30" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<g stroke="rgba(0,0,0,0.25)" stroke-width="0.6" fill="none">' +
          '<circle cx="50" cy="32" r="8"/>' +
          '<circle cx="50" cy="68" r="8"/>' +
          '<circle cx="32" cy="50" r="8"/>' +
          '<circle cx="68" cy="50" r="8"/>' +
          '</g></g>';
        break;
      case "compass":
        shapeSVG =
          '<circle cx="50" cy="50" r="36" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<circle cx="50" cy="50" r="30" fill="none" stroke="rgba(0,0,0,0.25)" stroke-width="0.5"/>' +
          '<polygon points="50,18 56,50 50,82 44,50" fill="rgba(0,0,0,0.5)" stroke="' + tier.primary + '" stroke-width="0.5"/>' +
          '<polygon points="18,50 50,44 82,50 50,56" fill="rgba(0,0,0,0.3)"/>';
        break;
      case "galaxy":
        shapeSVG =
          '<circle cx="50" cy="50" r="40" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>' +
          '<path d="M20 50 Q50 20 80 50 Q50 80 20 50" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="0.8"/>' +
          '<circle cx="30" cy="36" r="1.5" fill="#FFFCE0"/>' +
          '<circle cx="70" cy="64" r="1.5" fill="#FFFCE0"/>' +
          '<circle cx="64" cy="34" r="1" fill="#FFFCE0"/>' +
          '<circle cx="36" cy="66" r="1" fill="#FFFCE0"/>';
        break;
      default:
        shapeSVG = '<circle cx="50" cy="50" r="36" fill="' + grad + '" stroke="' + tier.secondary + '" stroke-width="1.2"/>';
    }

    const letterColor = (badge.tier === "silver" || badge.tier === "bronze") ? "#2a1d00" : "#FFFCE0";
    const centerLetter =
      '<text x="50" y="60" text-anchor="middle" font-family="Amiri, serif" font-size="28" font-weight="700" fill="' + letterColor + '" opacity="0.85">' + letter + '</text>';

    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
      rareGlow +
      shapeSVG +
      centerLetter +
      innerStar +
      '</svg>';
  }

  /* =========================================================
     CHECK & DÉBLOCAGE DES BADGES
     ========================================================= */
  function checkBadges() {
    if (!window.State) return [];
    const stateData = window.State.get();
    const newlyUnlocked = [];

    for (const badge of BADGES) {
      if (window.State.isBadgeUnlocked(badge.id)) continue;
      try {
        if (badge.check(stateData)) {
          window.State.unlockBadge(badge.id);
          newlyUnlocked.push(badge);
          document.dispatchEvent(new CustomEvent("badge-unlocked", { detail: badge }));
          if (window.Audio) window.Audio.badge();
        }
      } catch (e) {
        console.warn("Erreur check badge", badge.id, e);
      }
    }

    return newlyUnlocked;
  }

  /* =========================================================
     ACCESSEURS
     ========================================================= */
  function getAllBadges() { return BADGES.slice(); }
  function getBadge(id)   { return BADGES.find(function(b) { return b.id === id; }); }
  function getBadgesByCategory(cat) {
    if (cat === "all" || !cat) return BADGES.slice();
    return BADGES.filter(function(b) { return b.cat === cat; });
  }

  function getTotalBadges() { return BADGES.length; }
  function getUnlockedCount() {
    if (!window.State) return 0;
    return (window.State.get("unlockedBadges") || []).length;
  }

  /* =========================================================
     GAINS XP PRÉ-CONFIGURÉS
     ========================================================= */
  function gainQCMCorrect()      { return addXP((CFG.XP && CFG.XP.QCM_CORRECT) || 10, "Bonne réponse QCM"); }
  function gainRapidCorrect(combo) {
    const base = (CFG.XP && CFG.XP.RAPID_BASE) || 5;
    const bonus = Math.min(combo * ((CFG.XP && CFG.XP.RAPID_COMBO_BONUS) || 2), (CFG.XP && CFG.XP.RAPID_COMBO_MAX) || 20);
    return addXP(base + bonus, "Combo ×" + combo);
  }
  function gainWordKnown()       { return addXP((CFG.XP && CFG.XP.WORD_KNOWN) || 10, "Mot connu"); }
  function gainLetterLearned()   { return addXP((CFG.XP && CFG.XP.LETTER_LEARNED) || 15, "Lettre apprise"); }
  function gainReadingMilestone(){ return addXP((CFG.XP && CFG.XP.READING_MILESTONE) || 50, "Palier lecture"); }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    if (window.State) {
      const xp = window.State.get("xp") || 0;
      const correctLevel = levelFromXP(xp);
      if (window.State.get("level") !== correctLevel) {
        window.State.set("level", correctLevel);
      }
      checkBadges();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* -------- API publique -------- */
  return {
    xpRequiredForLevel: xpRequiredForLevel,
    xpToNextLevel: xpToNextLevel,
    levelFromXP: levelFromXP,
    xpInCurrentLevel: xpInCurrentLevel,
    levelTitle: levelTitle,
    addXP: addXP,
    incrementWordCount: incrementWordCount,
    incrementUnlockCount: incrementUnlockCount,
    gainQCMCorrect: gainQCMCorrect,
    gainRapidCorrect: gainRapidCorrect,
    gainWordKnown: gainWordKnown,
    gainLetterLearned: gainLetterLearned,
    gainReadingMilestone: gainReadingMilestone,
    getAllBadges: getAllBadges,
    getBadge: getBadge,
    getBadgesByCategory: getBadgesByCategory,
    getTotalBadges: getTotalBadges,
    getUnlockedCount: getUnlockedCount,
    getBadgeSVG: getBadgeSVG,
    checkBadges: checkBadges
  };
})();

window.XP = XP;
console.log("✓ XP & Badges chargés (" + XP.getTotalBadges() + " badges disponibles)");
