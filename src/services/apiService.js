export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const USER_SYNC_EVENT = 'darija:user-updated';
const XP_PER_LEVEL = 500;
const STORAGE_KEYS = {
  user: 'darija.mock.user',
  users: 'darija.mock.users',
  texts: 'darija.mock.texts',
  token: 'authToken',
};

const LEVEL_DEFS = [
  { id: 1, name: 'Decouverte' },
  { id: 2, name: 'Apprenti' },
  { id: 3, name: 'Explorateur' },
  { id: 4, name: 'Savant' },
  { id: 5, name: 'Maitre' },
];

const BADGE_CATALOG = {
  first_scan: { id: 'first_scan', name: 'Premier pas', icon: 'star', color: '#f59e0b' },
  ten_pages: { id: 'ten_pages', name: '10 pages', icon: 'book', color: '#3b82f6' },
  quiz_master: { id: 'quiz_master', name: 'Quiz master', icon: 'shield', color: '#ef4444' },
  regular: { id: 'regular', name: 'Regulier', icon: 'sparkle', color: '#facc15' },
  night_reader: { id: 'night_reader', name: 'Lecteur du soir', icon: 'star', color: '#8b5cf6' },
  collector: { id: 'collector', name: 'Collectionneur', icon: 'book', color: '#14b8a6' },
};

const XP_RULES = {
  uploadDocument: 20,
  scanDocument: 25,
  firstRead: 10,
  repeatRead: 2,
  audioSession: 8,
};

const getLevelFromXp = (xp = 0) => Math.min(Math.floor(xp / XP_PER_LEVEL) + 1, LEVEL_DEFS.length);
const getLevelName = (level = 1) => LEVEL_DEFS[Math.max(0, Math.min(level, LEVEL_DEFS.length) - 1)]?.name || LEVEL_DEFS[0].name;

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const emitUserSync = (user) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(USER_SYNC_EVENT, { detail: user }));
  }
};

const getKeywordPool = (text = '') =>
  [
    ...new Set(
      text
        .replace(/[.,!?;:()[\]{}"'`’”“]/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length > 4),
    ),
  ];

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const buildFallbackOptions = (answer, keywords = [], fallbacks = ['معلومة عامة', 'تفصيل ثانوي']) => {
  const distractors = keywords.filter((item) => item && item !== answer).slice(0, 4);

  while (distractors.length < 2) {
    distractors.push(fallbacks[distractors.length] || 'تفصيل ثانوي');
  }

  return shuffle([answer, distractors[0], distractors[1]]);
};

const generateQuestionsFromText = (text) => {
  const originalText = text?.originalText?.trim() || '';
  const darijaText = text?.darijaText?.trim() || '';
  const title = text?.title?.trim() || 'هاد الوثيقة';
  const sourceText = `${originalText} ${darijaText}`.trim();

  if (!sourceText) {
    return [];
  }

  const frKeywords = getKeywordPool(originalText || sourceText);
  const darijaKeywords = getKeywordPool(darijaText || sourceText);
  const allKeywords = getKeywordPool(sourceText);

  const frSentences = (originalText || sourceText)
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 24);

  const darijaSentences = (darijaText || sourceText)
    .split(/[.!?؟\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  const firstFrAnswer = frKeywords[0] || allKeywords[0] || title;
  const secondFrAnswer = frKeywords[1] || allKeywords[1] || 'apprentissage';
  const thirdFrAnswer = frKeywords[2] || allKeywords[2] || 'connaissance';

  const firstDarijaAnswer = darijaKeywords[0] || allKeywords[0] || title;
  const secondDarijaAnswer = darijaKeywords[1] || allKeywords[1] || 'التعلم';
  const thirdDarijaAnswer = darijaKeywords[2] || allKeywords[2] || 'المعرفة';

  const frFallbacks = ['information générale', 'détail secondaire'];
  const enFallbacks = ['general info', 'secondary detail'];
  const darijaFallbacks = ['معلومة عامة', 'تفصيل ثانوي'];

  return [
    {
      _id: `q_${text?._id || 'doc'}_1`,
      questionTextFr: `De quoi parle principalement ce document ?`,
      questionTextEn: `What is this document mainly about?`,
      questionTextDarija: `هاد الوثيقة اللي سفتّي كتدور على شنو بالأساس؟`,
      correctAnswerFr: firstFrAnswer,
      correctAnswerEn: firstFrAnswer,
      correctAnswerDarija: firstDarijaAnswer,
      optionsFr: buildFallbackOptions(firstFrAnswer, frKeywords, frFallbacks),
      optionsEn: buildFallbackOptions(firstFrAnswer, frKeywords, enFallbacks),
      optionsDarija: buildFallbackOptions(firstDarijaAnswer, darijaKeywords, darijaFallbacks),
      correctAnswer: firstDarijaAnswer,
      options: buildFallbackOptions(firstDarijaAnswer, darijaKeywords, darijaFallbacks),
      xpReward: 20,
    },
    {
      _id: `q_${text?._id || 'doc'}_2`,
      questionTextFr: `Quel concept important apparaît dans "${title}" ?`,
      questionTextEn: `What key concept appears in "${title}"?`,
      questionTextDarija: `شنو من مفهوم بان مهم فالنص "${title}"؟`,
      correctAnswerFr: secondFrAnswer,
      correctAnswerEn: secondFrAnswer,
      correctAnswerDarija: secondDarijaAnswer,
      optionsFr: buildFallbackOptions(secondFrAnswer, frKeywords.slice().reverse(), frFallbacks),
      optionsEn: buildFallbackOptions(secondFrAnswer, frKeywords.slice().reverse(), enFallbacks),
      optionsDarija: buildFallbackOptions(secondDarijaAnswer, darijaKeywords.slice().reverse(), darijaFallbacks),
      correctAnswer: secondDarijaAnswer,
      options: buildFallbackOptions(secondDarijaAnswer, darijaKeywords.slice().reverse(), darijaFallbacks),
      xpReward: 20,
    },
    {
      _id: `q_${text?._id || 'doc'}_3`,
      questionTextFr: frSentences[0]
        ? `Quelle idée comprend-on de ce passage : "${frSentences[0].slice(0, 44)}..." ?`
        : `Quelle est l'idée principale de ce document ?`,
      questionTextEn: frSentences[0]
        ? `What idea do you get from this passage: "${frSentences[0].slice(0, 44)}..."?`
        : `What is the main idea of this document?`,
      questionTextDarija: darijaSentences[0]
        ? `شنو الفكرة اللي كتفهم من هاد الجزء: "${darijaSentences[0].slice(0, 44)}..."؟`
        : `شنو الفكرة الرئيسية فهاد الوثيقة؟`,
      correctAnswerFr: thirdFrAnswer,
      correctAnswerEn: thirdFrAnswer,
      correctAnswerDarija: thirdDarijaAnswer,
      optionsFr: buildFallbackOptions(thirdFrAnswer, frKeywords, frFallbacks),
      optionsEn: buildFallbackOptions(thirdFrAnswer, frKeywords, enFallbacks),
      optionsDarija: buildFallbackOptions(thirdDarijaAnswer, darijaKeywords, darijaFallbacks),
      correctAnswer: thirdDarijaAnswer,
      options: buildFallbackOptions(thirdDarijaAnswer, darijaKeywords, darijaFallbacks),
      xpReward: 30,
    },
  ];
};

const buildDefaultQuiz = () => [
  {
    _id: 'q1',
    questionTextFr: "Que fait l'intelligence artificielle dans ce texte ?",
    questionTextEn: 'What does artificial intelligence do in this text?',
    questionTextDarija: 'الذكاء الاصطناعي كيعاون على شنو فهاد النص؟',
    correctAnswerFr: "Analyser des données",
    correctAnswerEn: 'Analyse data',
    correctAnswerDarija: 'تحليل البيانات',
    optionsFr: ["Analyser des données", "Jouer à l'école", "Dormir beaucoup"],
    optionsEn: ['Analyse data', 'Play at school', 'Sleep a lot'],
    optionsDarija: ['تحليل البيانات', 'اللعب فالمدرسة', 'النوم الكثير'],
    correctAnswer: 'تحليل البيانات',
    options: ['تحليل البيانات', 'اللعب فالمدرسة', 'النوم الكثير'],
    xpReward: 20,
  },
  {
    _id: 'q2',
    questionTextFr: "Quel est le résultat de l'utilisation de l'IA ?",
    questionTextEn: 'What is the result of using AI?',
    questionTextDarija: 'شنو النتيجة ديال استعمال الذكاء الاصطناعي هنا؟',
    correctAnswerFr: 'De meilleures décisions',
    correctAnswerEn: 'Better decisions',
    correctAnswerDarija: 'قرارات احسن',
    optionsFr: ['Perte de temps', 'De meilleures décisions', 'Oublier les cours'],
    optionsEn: ['Waste of time', 'Better decisions', 'Forgetting lessons'],
    optionsDarija: ['ضياع الوقت', 'قرارات احسن', 'نسيان الدروس'],
    correctAnswer: 'قرارات احسن',
    options: ['ضياع الوقت', 'قرارات احسن', 'نسيان الدروس'],
    xpReward: 20,
  },
  {
    _id: 'q3',
    questionTextFr: 'Ce document est-il utile pour apprendre ?',
    questionTextEn: 'Is this document useful for learning?',
    questionTextDarija: 'واش هاد النص مفيد للتعلم؟',
    correctAnswerFr: 'Oui, il contient des informations',
    correctAnswerEn: 'Yes, it contains information',
    correctAnswerDarija: 'نعم، فيه معلومات',
    optionsFr: ['Non, juste du divertissement', 'Oui, il contient des informations', 'Je ne sais pas'],
    optionsEn: ["No, it's just entertainment", 'Yes, it contains information', "I don't know"],
    optionsDarija: ['لا، غير تفلية', 'نعم، فيه معلومات', 'ما عرفتش'],
    correctAnswer: 'نعم، فيه معلومات',
    options: ['لا، غير تفلية', 'نعم، فيه معلومات', 'ما عرفتش'],
    xpReward: 30,
  },
];

const normalizeStats = (stats = {}) => ({
  readingTime: stats.readingTime || 0,
  quizzesPassed: stats.quizzesPassed || 0,
  bestStreak: stats.bestStreak || 0,
  currentStreak: stats.currentStreak || 0,
  lastActiveDate: stats.lastActiveDate || null,
  pagesRead: stats.pagesRead || 0,
  importedCount: stats.importedCount || 0,
  scannedCount: stats.scannedCount || 0,
  perfectQuizzes: stats.perfectQuizzes || 0,
  audioSessions: stats.audioSessions || 0,
  completedTextIds: Array.isArray(stats.completedTextIds) ? stats.completedTextIds : [],
});

const normalizeUser = (user) => {
  const xp = user?.xp || 0;
  const level = user?.level || getLevelFromXp(xp);

  return {
    id: user.id || user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || '👧',
    avatarImage: user.avatarImage || '',
    level,
    levelName: user.levelName || getLevelName(level),
    xp,
    booksRead: user.booksRead || 0,
    badges: Array.isArray(user.badges) ? user.badges : [],
    stats: normalizeStats(user.stats),
  };
};

const estimatePageCount = (content = '') => {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 350));
};

const unlockBadgeIfNeeded = (user, badgeId) => {
  const badge = BADGE_CATALOG[badgeId];
  if (!badge) {
    return user;
  }

  if ((user.badges || []).some((item) => item.id === badgeId)) {
    return user;
  }

  return {
    ...user,
    badges: [...(user.badges || []), { ...badge, unlockedAt: new Date().toISOString() }],
  };
};

const applyAchievements = (user, texts = []) => {
  let nextUser = normalizeUser(user);

  if (texts.length >= 1) {
    nextUser = unlockBadgeIfNeeded(nextUser, 'first_scan');
  }

  if (texts.filter((item) => item.source === 'upload').length >= 3) {
    nextUser = unlockBadgeIfNeeded(nextUser, 'collector');
  }

  if ((nextUser.stats?.pagesRead || 0) >= 10) {
    nextUser = unlockBadgeIfNeeded(nextUser, 'ten_pages');
  }

  if ((nextUser.stats?.quizzesPassed || 0) >= 3) {
    nextUser = unlockBadgeIfNeeded(nextUser, 'quiz_master');
  }

  if ((nextUser.stats?.bestStreak || 0) >= 3) {
    nextUser = unlockBadgeIfNeeded(nextUser, 'regular');
  }

  if ((nextUser.stats?.audioSessions || 0) >= 1) {
    nextUser = unlockBadgeIfNeeded(nextUser, 'night_reader');
  }

  return normalizeUser(nextUser);
};

const createDemoData = () => {
  const now = new Date().toISOString();
  const text1 = {
    _id: 'text_1',
    ownerId: 'test_user_id',
    title: "L'intelligence artificielle transforme notre facon d'apprendre",
    originalText:
      "L'intelligence artificielle transforme notre facon d'apprendre et de comprendre le monde. Elle permet d'automatiser des taches et d'analyser des donnees pour prendre de meilleures decisions.",
    darijaText:
      'الذكاء الاصطناعي كيغير طريقة ديالنا فالتعلم وكيفهمنا العالم. كيعاون على الاتمتة وتحليل البيانات باش ناخدو قرارات احسن.',
    isFavorite: true,
    readCount: 12,
    source: 'upload',
    fileName: 'ia-learning.pdf',
    mimeType: 'application/pdf',
    createdAt: now,
  };
  const text2 = {
    _id: 'text_2',
    ownerId: 'test_user_id',
    title: 'Histoire du Maroc',
    originalText: "Le Maroc est un pays situe au nord-ouest de l'Afrique avec une histoire riche et diverse.",
    darijaText: 'لمغرب بلاد فشمال غرب افريقيا وعندو تاريخ غني ومتنوع بزاف.',
    isFavorite: false,
    readCount: 5,
    source: 'scan',
    createdAt: now,
  };

  text1.generatedQuestions = [
    {
      _id: 'text_1_q1',
      questionTextFr: "Sur quoi l'intelligence artificielle a-t-elle le plus grand impact selon ce texte ?",
      questionTextEn: 'What does artificial intelligence have the greatest impact on according to this text?',
      questionTextDarija: 'علاش الذكاء الاصطناعي مهم فهاد النص؟',
      correctAnswerFr: "La façon d'apprendre",
      correctAnswerEn: 'The way we learn',
      correctAnswerDarija: 'طريقة التعلم',
      optionsFr: ["La façon d'apprendre", 'La cuisine', 'Les transports'],
      optionsEn: ['The way we learn', 'Cooking', 'Transportation'],
      optionsDarija: ['طريقة التعلم', 'الطبخ', 'السفر'],
      correctAnswer: 'طريقة التعلم',
      options: ['طريقة التعلم', 'الطبخ', 'السفر'],
      xpReward: 20,
    },
    {
      _id: 'text_1_q2',
      questionTextFr: "Que permet d'analyser l'intelligence artificielle d'après ce texte ?",
      questionTextEn: 'What does AI help to analyse according to this text?',
      questionTextDarija: 'شنو كيحلل الذكاء الاصطناعي فهاد النص؟',
      correctAnswerFr: 'Des données',
      correctAnswerEn: 'Data',
      correctAnswerDarija: 'البيانات',
      optionsFr: ['Des données', 'Des images', 'De la musique'],
      optionsEn: ['Data', 'Images', 'Music'],
      optionsDarija: ['البيانات', 'الصور', 'الموسيقى'],
      correctAnswer: 'البيانات',
      options: ['البيانات', 'الصور', 'الموسيقى'],
      xpReward: 20,
    },
    {
      _id: 'text_1_q3',
      questionTextFr: "Quel est l'objectif de l'utilisation de l'intelligence artificielle ?",
      questionTextEn: 'What is the goal of using artificial intelligence?',
      questionTextDarija: 'شنو هو الهدف من استعمال الذكاء الاصطناعي؟',
      correctAnswerFr: 'Prendre de meilleures décisions',
      correctAnswerEn: 'Make better decisions',
      correctAnswerDarija: 'قرارات احسن',
      optionsFr: ['Prendre de meilleures décisions', 'Perdre du temps', 'Créer de la confusion'],
      optionsEn: ['Make better decisions', 'Waste time', 'Create confusion'],
      optionsDarija: ['قرارات احسن', 'نضيعو الوقت', 'نخلقو لبلبلة'],
      correctAnswer: 'قرارات احسن',
      options: ['قرارات احسن', 'نضيعو الوقت', 'نخلقو لبلبلة'],
      xpReward: 30,
    },
  ];
  text2.generatedQuestions = [
    {
      _id: 'text_2_q1',
      questionTextFr: 'Où se situe le Maroc géographiquement ?',
      questionTextEn: 'Where is Morocco located geographically?',
      questionTextDarija: 'فين كاين لمغرب جغرافيا؟',
      correctAnswerFr: "Nord-ouest de l'Afrique",
      correctAnswerEn: 'Northwest Africa',
      correctAnswerDarija: 'شمال غرب افريقيا',
      optionsFr: ["Nord-ouest de l'Afrique", "Asie centrale", "Amérique du Sud"],
      optionsEn: ['Northwest Africa', 'Central Asia', 'South America'],
      optionsDarija: ['شمال غرب افريقيا', 'وسط آسيا', 'امريكا الجنوبية'],
      correctAnswer: 'شمال غرب افريقيا',
      options: ['شمال غرب افريقيا', 'وسط آسيا', 'امريكا الجنوبية'],
      xpReward: 20,
    },
    {
      _id: 'text_2_q2',
      questionTextFr: "Comment l'histoire du Maroc est-elle décrite dans ce texte ?",
      questionTextEn: "How is Morocco's history described in this text?",
      questionTextDarija: 'كيفاش كيوصف النص تاريخ لمغرب؟',
      correctAnswerFr: 'Riche et diverse',
      correctAnswerEn: 'Rich and diverse',
      correctAnswerDarija: 'غني ومتنوع',
      optionsFr: ['Riche et diverse', 'Courte et simple', 'Inconnue et mystérieuse'],
      optionsEn: ['Rich and diverse', 'Short and simple', 'Unknown and mysterious'],
      optionsDarija: ['غني ومتنوع', 'قصير وبسيط', 'مجهول وغامض'],
      correctAnswer: 'غني ومتنوع',
      options: ['غني ومتنوع', 'قصير وبسيط', 'مجهول وغامض'],
      xpReward: 20,
    },
    {
      _id: 'text_2_q3',
      questionTextFr: 'Sur quel continent se trouve le Maroc ?',
      questionTextEn: 'On which continent is Morocco located?',
      questionTextDarija: 'فأي قارة كاين لمغرب؟',
      correctAnswerFr: "L'Afrique",
      correctAnswerEn: 'Africa',
      correctAnswerDarija: 'افريقيا',
      optionsFr: ["L'Afrique", "L'Europe", "L'Asie"],
      optionsEn: ['Africa', 'Europe', 'Asia'],
      optionsDarija: ['افريقيا', 'اوروبا', 'آسيا'],
      correctAnswer: 'افريقيا',
      options: ['افريقيا', 'اوروبا', 'آسيا'],
      xpReward: 30,
    },
  ];

  return {
    users: [
      {
        id: 'test_user_id',
        _id: 'test_user_id',
        username: 'Chaimae',
        email: 'test@example.com',
        password: 'password',
        avatar: '👧',
        level: getLevelFromXp(1250),
        levelName: getLevelName(getLevelFromXp(1250)),
        xp: 1250,
        booksRead: 5,
        badges: [
          { ...BADGE_CATALOG.first_scan, unlockedAt: now },
          { ...BADGE_CATALOG.ten_pages, unlockedAt: now },
          { ...BADGE_CATALOG.quiz_master, unlockedAt: now },
          { ...BADGE_CATALOG.regular, unlockedAt: now },
        ],
        stats: {
          readingTime: 330,
          quizzesPassed: 18,
          bestStreak: 7,
          pagesRead: 14,
          importedCount: 4,
          scannedCount: 1,
          perfectQuizzes: 5,
          audioSessions: 2,
        },
      },
    ],
    texts: [text1, text2],
  };
};

const mergeDemoData = (db) => {
  const defaults = createDemoData();
  const demoUser = defaults.users[0];
  const demoTexts = defaults.texts;

  const demoUserIndex = db.users.findIndex((user) => (user.id || user._id) === demoUser.id);
  if (demoUserIndex === -1) {
    db.users.unshift(demoUser);
  } else {
    db.users[demoUserIndex] = {
      ...demoUser,
      ...db.users[demoUserIndex],
      password: db.users[demoUserIndex].password || demoUser.password,
      stats: {
        ...demoUser.stats,
        ...db.users[demoUserIndex].stats,
      },
    };
  }

  for (const demoText of demoTexts) {
    const existingIndex = db.texts.findIndex((text) => text._id === demoText._id);
    if (existingIndex === -1) {
      db.texts.push(demoText);
    } else {
      // Always refresh seeded questions for demo texts so improvements are picked up
      db.texts[existingIndex] = {
        ...db.texts[existingIndex],
        generatedQuestions: demoText.generatedQuestions,
      };
    }
  }

  return db;
};

const loadMockDb = () => {
  const defaults = createDemoData();
  const rawUsers = safeJsonParse(localStorage.getItem(STORAGE_KEYS.users), defaults.users);
  const rawTexts = safeJsonParse(localStorage.getItem(STORAGE_KEYS.texts), defaults.texts);
  const mergedDb = mergeDemoData({ users: rawUsers, texts: rawTexts });

  const users = mergedDb.users.map((user) => ({
    ...user,
    id: user.id || user._id,
    _id: user._id || user.id,
    password: user.password || '',
    level: user.level || getLevelFromXp(user.xp || 0),
    levelName: user.levelName || getLevelName(user.level || getLevelFromXp(user.xp || 0)),
    stats: normalizeStats(user.stats),
  }));
  const texts = mergedDb.texts.map((text) => ({
    ...text,
    ownerId: text.ownerId || 'test_user_id',
    generatedQuestions:
      Array.isArray(text.generatedQuestions) && text.generatedQuestions.length > 0
        ? text.generatedQuestions
        : generateQuestionsFromText(text),
  }));

  if (!localStorage.getItem(STORAGE_KEYS.users)) {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  } else {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  }

  if (!localStorage.getItem(STORAGE_KEYS.texts)) {
    localStorage.setItem(STORAGE_KEYS.texts, JSON.stringify(texts));
  } else {
    localStorage.setItem(STORAGE_KEYS.texts, JSON.stringify(texts));
  }

  return { users, texts };
};

const saveMockDb = (db) => {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(db.users));
  localStorage.setItem(STORAGE_KEYS.texts, JSON.stringify(db.texts));
};

const getStoredSessionUser = () => safeJsonParse(sessionStorage.getItem(STORAGE_KEYS.user), null);

const persistSessionUser = (user) => {
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  emitUserSync(user);
};

const clearSessionUser = () => {
  sessionStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.user);
  emitUserSync(null);
};

const getCurrentUserId = () => getStoredSessionUser()?.id;
const getUserTexts = (db, userId = getCurrentUserId()) => db.texts.filter((item) => item.ownerId === userId);

const syncUserInDb = (db, updatedUser) => {
  const userIndex = db.users.findIndex((entry) => (entry.id || entry._id) === updatedUser.id);
  if (userIndex >= 0) {
    db.users[userIndex] = { ...db.users[userIndex], ...updatedUser };
  }
};

const buildJourney = (user) => {
  const currentLevel = getLevelFromXp(user.xp || 0);

  return {
    currentLevel,
    levelName: getLevelName(currentLevel),
    totalXp: user.xp || 0,
    levels: LEVEL_DEFS.map((level, index) => ({
      ...level,
      isUnlocked: index < currentLevel,
      isCurrentLevel: index + 1 === currentLevel,
      xpRequired: index * XP_PER_LEVEL,
      xpToNext: (index + 1) * XP_PER_LEVEL,
    })),
    nextLevelXp: Math.min(currentLevel + 1, LEVEL_DEFS.length) * XP_PER_LEVEL,
    xpProgress: (user.xp || 0) % XP_PER_LEVEL,
  };
};

const mockHandlers = {
  register: async ({ username, email, password }) => {
    const db = loadMockDb();
    if (db.users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'Un compte existe deja avec cet email.' };
    }

    const newUser = normalizeUser({
      id: `user_${Date.now()}`,
      username,
      email,
      password,
      level: 1,
      levelName: getLevelName(1),
      xp: 0,
      booksRead: 0,
      badges: [],
      stats: { readingTime: 0, quizzesPassed: 0, bestStreak: 0, pagesRead: 0, importedCount: 0, scannedCount: 0, perfectQuizzes: 0, audioSessions: 0 },
    });

    db.users.push({ ...newUser, password });
    saveMockDb(db);
    persistSessionUser(newUser);
    sessionStorage.setItem(STORAGE_KEYS.token, `mock-token-${newUser.id}`);

    return { token: sessionStorage.getItem(STORAGE_KEYS.token), user: newUser };
  },

  login: async ({ email, password }) => {
    const db = loadMockDb();
    const found = db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());

    if (!found || found.password !== password) {
      return { error: 'Email ou mot de passe incorrect.' };
    }

    const user = normalizeUser(found);
    persistSessionUser(user);
    sessionStorage.setItem(STORAGE_KEYS.token, `mock-token-${user.id}`);
    return { token: sessionStorage.getItem(STORAGE_KEYS.token), user };
  },

  getProfile: async () => {
    const user = getStoredSessionUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    return { user };
  },

  updateProfile: async (updates) => {
    const db = loadMockDb();
    const user = getStoredSessionUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const updatedUser = normalizeUser({
      ...user,
      ...updates,
    });

    persistSessionUser(updatedUser);
    syncUserInDb(db, updatedUser);
    saveMockDb(db);

    return { user: updatedUser };
  },

  getTexts: async () => {
    const db = loadMockDb();
    return getUserTexts(db);
  },

  getText: async (textId) => {
    const db = loadMockDb();
    const text = getUserTexts(db).find((item) => item._id === textId);
    if (!text) {
      return { error: 'Text not found' };
    }

    const previousReadCount = text.readCount || 0;
    text.readCount = previousReadCount + 1;

    const user = getStoredSessionUser();
    if (user) {
      const updatedUser = applyAchievements(
        {
          ...user,
          xp: (user.xp || 0) + (previousReadCount === 0 ? XP_RULES.firstRead : XP_RULES.repeatRead),
          level: getLevelFromXp((user.xp || 0) + (previousReadCount === 0 ? XP_RULES.firstRead : XP_RULES.repeatRead)),
          levelName: getLevelName(getLevelFromXp((user.xp || 0) + (previousReadCount === 0 ? XP_RULES.firstRead : XP_RULES.repeatRead))),
          stats: {
            ...(user.stats || {}),
            readingTime: (user.stats?.readingTime || 0) + 4,
            quizzesPassed: user.stats?.quizzesPassed || 0,
            bestStreak: user.stats?.bestStreak || 0,
            pagesRead: (user.stats?.pagesRead || 0) + estimatePageCount(text.originalText || text.darijaText || ''),
            importedCount: user.stats?.importedCount || 0,
            scannedCount: user.stats?.scannedCount || 0,
            perfectQuizzes: user.stats?.perfectQuizzes || 0,
            audioSessions: user.stats?.audioSessions || 0,
          },
        },
        getUserTexts(db, user.id),
      );
      persistSessionUser(updatedUser);
      syncUserInDb(db, updatedUser);
    }

    saveMockDb(db);
    return text;
  },

  saveText: async ({ title, originalText, darijaText, language = 'fr', source = 'upload', fileName = '', mimeType = '' }) => {
    const db = loadMockDb();
    const user = getStoredSessionUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const text = {
      _id: `text_${Date.now()}`,
      ownerId: user.id,
      title,
      originalText,
      darijaText,
      language,
      source,
      fileName,
      mimeType,
      generatedQuestions: generateQuestionsFromText({ title, originalText, darijaText }),
      readCount: 0,
      isFavorite: false,
      createdAt: new Date().toISOString(),
    };

    db.texts.unshift(text);

    const updatedUser = applyAchievements(
      {
        ...user,
        xp: (user.xp || 0) + (source === 'scan' ? XP_RULES.scanDocument : XP_RULES.uploadDocument),
        level: getLevelFromXp((user.xp || 0) + (source === 'scan' ? XP_RULES.scanDocument : XP_RULES.uploadDocument)),
        levelName: getLevelName(getLevelFromXp((user.xp || 0) + (source === 'scan' ? XP_RULES.scanDocument : XP_RULES.uploadDocument))),
        booksRead: (user.booksRead || 0) + 1,
        stats: {
          ...(user.stats || {}),
          bestStreak: Math.max(user.stats?.bestStreak || 0, 1),
          quizzesPassed: user.stats?.quizzesPassed || 0,
          readingTime: user.stats?.readingTime || 0,
          pagesRead: user.stats?.pagesRead || 0,
          importedCount: (user.stats?.importedCount || 0) + (source === 'upload' ? 1 : 0),
          scannedCount: (user.stats?.scannedCount || 0) + (source === 'scan' ? 1 : 0),
          perfectQuizzes: user.stats?.perfectQuizzes || 0,
          audioSessions: user.stats?.audioSessions || 0,
        },
      },
      getUserTexts(db, user.id),
    );

    persistSessionUser(updatedUser);
    syncUserInDb(db, updatedUser);
    saveMockDb(db);

    return {
      message: 'Text saved successfully',
      text,
      questionsGenerated: text.generatedQuestions.length,
    };
  },

  toggleFavorite: async (textId) => {
    const db = loadMockDb();
    const text = getUserTexts(db).find((item) => item._id === textId);
    if (!text) {
      return { error: 'Text not found' };
    }

    text.isFavorite = !text.isFavorite;
    saveMockDb(db);
    return { isFavorite: text.isFavorite };
  },

  deleteText: async (textId) => {
    const db = loadMockDb();
    const userId = getCurrentUserId();
    const nextTexts = db.texts.filter((item) => item._id !== textId || item.ownerId !== userId);
    if (nextTexts.length === db.texts.length) {
      return { error: 'Text not found' };
    }

    db.texts = nextTexts;
    saveMockDb(db);
    return { success: true };
  },

  getQuizQuestions: async (textId) => {
    const db = loadMockDb();
    const text = getUserTexts(db).find((item) => item._id === textId);

    if (!text) {
      return buildDefaultQuiz();
    }

    if (!Array.isArray(text.generatedQuestions) || text.generatedQuestions.length === 0) {
      text.generatedQuestions = generateQuestionsFromText(text);
      saveMockDb(db);
    }

    return text.generatedQuestions.length > 0 ? text.generatedQuestions : buildDefaultQuiz();
  },

  getJourneyProgress: async () => {
    const user = normalizeUser(getStoredSessionUser() || loadMockDb().users[0]);
    return buildJourney(user);
  },

  addXP: async (xpAmount, metadata = {}) => {
    const db = loadMockDb();
    const user = getStoredSessionUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const nextXp = (user.xp || 0) + xpAmount;

    // Daily streak tracking
    const today = new Date().toDateString();
    const lastActiveDate = user.stats?.lastActiveDate;
    let currentStreak = user.stats?.currentStreak || 0;
    if (!lastActiveDate) {
      currentStreak = 1;
    } else if (lastActiveDate === today) {
      currentStreak = Math.max(currentStreak, 1);
    } else {
      const prevDay = new Date();
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDayString = prevDay.toDateString();
      currentStreak = lastActiveDate === prevDayString ? currentStreak + 1 : 1;
    }
    const bestStreak = Math.max(user.stats?.bestStreak || 0, currentStreak);

    // Track completed text quizzes
    const completedTextIds = [...(user.stats?.completedTextIds || [])];
    if (metadata.quizCompleted && metadata.textId && !completedTextIds.includes(metadata.textId)) {
      completedTextIds.push(metadata.textId);
    }

    const updatedUser = applyAchievements(
      {
        ...user,
        xp: nextXp,
        level: getLevelFromXp(nextXp),
        levelName: getLevelName(getLevelFromXp(nextXp)),
        stats: {
          ...(user.stats || {}),
          quizzesPassed: (user.stats?.quizzesPassed || 0) + (metadata.quizCompleted ? 1 : 0),
          bestStreak,
          currentStreak,
          lastActiveDate: today,
          readingTime: user.stats?.readingTime || 0,
          pagesRead: user.stats?.pagesRead || 0,
          importedCount: user.stats?.importedCount || 0,
          scannedCount: user.stats?.scannedCount || 0,
          perfectQuizzes:
            (user.stats?.perfectQuizzes || 0) +
            (metadata.quizCompleted && metadata.totalQuestions > 0 && metadata.correctAnswers === metadata.totalQuestions ? 1 : 0),
          audioSessions: user.stats?.audioSessions || 0,
          completedTextIds,
        },
      },
      getUserTexts(db, user.id),
    );

    persistSessionUser(updatedUser);
    syncUserInDb(db, updatedUser);
    saveMockDb(db);

    return {
      xp: updatedUser.xp,
      level: updatedUser.level,
      levelName: updatedUser.levelName,
      message: 'XP added successfully',
    };
  },

  submitAnswer: async () => {
    const result = await mockHandlers.addXP(50);
    return {
      isCorrect: true,
      correctAnswer: 'تحليل البيانات',
      xpEarned: 50,
      totalXp: result.xp || 0,
      level: result.level || 1,
      message: 'Great job!',
    };
  },

  completeLevel: async () => mockHandlers.addXP(200),

  trackAudioSession: async () => {
    const db = loadMockDb();
    const user = getStoredSessionUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const nextXp = (user.xp || 0) + XP_RULES.audioSession;
    const updatedUser = applyAchievements(
      {
        ...user,
        xp: nextXp,
        level: getLevelFromXp(nextXp),
        levelName: getLevelName(getLevelFromXp(nextXp)),
        stats: {
          ...(user.stats || {}),
          readingTime: user.stats?.readingTime || 0,
          quizzesPassed: user.stats?.quizzesPassed || 0,
          bestStreak: user.stats?.bestStreak || 0,
          pagesRead: user.stats?.pagesRead || 0,
          importedCount: user.stats?.importedCount || 0,
          scannedCount: user.stats?.scannedCount || 0,
          perfectQuizzes: user.stats?.perfectQuizzes || 0,
          audioSessions: (user.stats?.audioSessions || 0) + 1,
        },
      },
      getUserTexts(db, user.id),
    );

    persistSessionUser(updatedUser);
    syncUserInDb(db, updatedUser);
    saveMockDb(db);

    return { success: true, xp: updatedUser.xp, level: updatedUser.level };
  },

  translateText: async ({ text }) => ({
    translated: `ترجمة مبسطة: ${text}`,
  }),

  performOCR: async () => ({
    title: 'Document Scanne',
    originalText: "L'intelligence artificielle transforme notre facon d'apprendre et de comprendre le monde.",
    darijaText: 'الذكاء الاصطناعي كيبدل الطريقة باش كنتعلمو وكنفهمو العالم.',
  }),
};

const parseResponse = async (res) => {
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    throw new Error(typeof data === 'string' ? data : data?.error || 'Request failed');
  }

  return data;
};

const request = async ({ path, method = 'GET', body, fallback }) => {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionStorage.getItem(STORAGE_KEYS.token)
          ? { Authorization: `Bearer ${sessionStorage.getItem(STORAGE_KEYS.token)}` }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    return await parseResponse(res);
  } catch (error) {
    if (fallback) {
      return fallback();
    }

    return { error: error.message || 'Network error' };
  }
};

export const apiClient = {
  USER_SYNC_EVENT,

  setToken: (token) => {
    sessionStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.removeItem(STORAGE_KEYS.token);
  },

  getToken: () => sessionStorage.getItem(STORAGE_KEYS.token),

  getStoredUser: () => getStoredSessionUser(),

  clearLegacyStorage: () => {
    localStorage.removeItem(STORAGE_KEYS.user);
    localStorage.removeItem(STORAGE_KEYS.token);
  },

  register: async (username, email, password) =>
    request({
      path: '/auth/register',
      method: 'POST',
      body: { username, email, password },
      fallback: () => mockHandlers.register({ username, email, password }),
    }),

  login: async (email, password) =>
    request({
      path: '/auth/login',
      method: 'POST',
      body: { email, password },
      fallback: () => mockHandlers.login({ email, password }),
    }),

  loginDemo: async () => mockHandlers.login({ email: 'test@example.com', password: 'password' }),

  logout: () => {
    sessionStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.token);
    clearSessionUser();
  },

  getProfile: async () =>
    request({
      path: '/users/profile',
      fallback: mockHandlers.getProfile,
    }),

  updateProfile: async (updates) =>
    request({
      path: '/users/profile',
      method: 'PATCH',
      body: updates,
      fallback: () => mockHandlers.updateProfile(updates),
    }),

  addXP: async (xpAmount, metadata = {}) =>
    request({
      path: '/users/addxp',
      method: 'POST',
      body: { xpAmount, ...metadata },
      fallback: () => mockHandlers.addXP(xpAmount, metadata),
    }),

  unlockBadge: async (badgeId, badgeName, badgeIcon, badgeColor) =>
    request({
      path: '/users/badge',
      method: 'POST',
      body: { badgeId, badgeName, badgeIcon, badgeColor },
      fallback: async () => ({ message: 'Badge unlocked' }),
    }),

  saveText: async (title, originalText, darijaText, language = 'fr', source = 'upload', fileName = '', mimeType = '') =>
    request({
      path: '/texts/save',
      method: 'POST',
      body: { title, originalText, darijaText, language, source, fileName, mimeType },
      fallback: () => mockHandlers.saveText({ title, originalText, darijaText, language, source, fileName, mimeType }),
    }),

  getTexts: async () =>
    request({
      path: '/texts/list',
      fallback: mockHandlers.getTexts,
    }),

  getText: async (textId) =>
    request({
      path: `/texts/${textId}`,
      fallback: () => mockHandlers.getText(textId),
    }),

  toggleFavorite: async (textId) =>
    request({
      path: `/texts/${textId}/favorite`,
      method: 'POST',
      fallback: () => mockHandlers.toggleFavorite(textId),
    }),

  deleteText: async (textId) =>
    request({
      path: `/texts/${textId}`,
      method: 'DELETE',
      fallback: () => mockHandlers.deleteText(textId),
    }),

  translateText: async (text) =>
    request({
      path: '/texts/translate',
      method: 'POST',
      body: { text },
      fallback: () => mockHandlers.translateText({ text }),
    }),

  performOCR: async (base64Image, mimeType = 'image/jpeg') =>
    request({
      path: '/texts/ocr',
      method: 'POST',
      body: { image: base64Image, mimeType },
      fallback: mockHandlers.performOCR,
    }),

  getQuizQuestions: async (textId) =>
    request({
      path: `/quiz/text/${textId}`,
      fallback: () => mockHandlers.getQuizQuestions(textId),
    }),

  getRandomQuiz: async () => mockHandlers.getQuizQuestions(),

  submitAnswer: async (questionId, userAnswer) =>
    request({
      path: '/quiz/submit',
      method: 'POST',
      body: { questionId, userAnswer },
      fallback: mockHandlers.submitAnswer,
    }),

  getJourneyProgress: async () =>
    request({
      path: '/journey/progress',
      fallback: mockHandlers.getJourneyProgress,
    }),

  completeLevel: async (levelId) =>
    request({
      path: `/journey/complete-level/${levelId}`,
      method: 'POST',
      fallback: () => mockHandlers.completeLevel(levelId),
    }),

  trackAudioSession: async () => mockHandlers.trackAudioSession(),
};
