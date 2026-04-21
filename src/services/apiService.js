const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://pagfnzzrzwwbwyljlovo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_KBwGs_g-cjNAJnnfSY-ZMw_MpCmZkTH';

const USER_SYNC_EVENT = 'darija:user-updated';
const XP_PER_LEVEL = 500;
const STORAGE_KEYS = {
  user: 'darija.session.user',
  accessToken: 'darija.session.access_token',
  refreshToken: 'darija.session.refresh_token',
  users: 'darija.mock.users',
  texts: 'darija.mock.texts',
};

const STAGE_DEFS = [
  { id: 1, name: 'Decouverte' },
  { id: 2, name: 'Apprenti' },
  { id: 3, name: 'Curieux' },
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

const FR_STOPWORDS = new Set([
  'alors',
  'avec',
  'avoir',
  'cette',
  'dans',
  'depuis',
  'elle',
  'elles',
  'entre',
  'être',
  'fait',
  'font',
  'leur',
  'leurs',
  'mais',
  'même',
  'nous',
  'notre',
  'pour',
  'plus',
  'sans',
  'sont',
  'très',
  'tout',
  'tous',
  'une',
  'votre',
  'vous',
  'petit',
  'petite',
  'grand',
  'grande',
  'histoire',
]);

const DARIJA_STOPWORDS = new Set([
  'هذا',
  'هاد',
  'هادا',
  'هادي',
  'هادو',
  'ديال',
  'على',
  'في',
  'فهاد',
  'باش',
  'واش',
  'شنو',
  'كيفاش',
  'فين',
  'مهم',
  'بزاف',
  'النص',
  'الوثيقة',
]);

const DEFAULT_CONCEPT_FALLBACKS = {
  fr: ['idée principale', 'information essentielle'],
  darija: ['فكرة أساسية', 'معلومة مهمة'],
};

const MIN_PHRASE_LENGTH = 6;
const MAX_KEYWORD_WEIGHT = 8;
const KEYWORD_WEIGHT_DIVISOR = 4;
const MAX_SENTENCES_FOR_CONCEPTS = 18;
const MAX_PHRASE_CANDIDATES = 240;

const normalizeToken = (token = '') =>
  token
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(^[^\p{L}\p{N}\u0600-\u06FF]+|[^\p{L}\p{N}\u0600-\u06FF]+$)/gu, '')
    .trim();

const hasLetter = (token = '') => /[\p{L}\u0600-\u06FF]/u.test(token);

const isMeaningfulToken = (token = '') => {
  const normalized = normalizeToken(token);
  if (!normalized || normalized.length < 4 || !hasLetter(normalized)) {
    return false;
  }

  if (FR_STOPWORDS.has(normalized) || DARIJA_STOPWORDS.has(normalized)) {
    return false;
  }

  return true;
};

const dedupeCaseInsensitive = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeToken(item);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const getKeywordPool = (text = '') => {
  const frequency = new Map();

  text
    .replace(/[.,!?;:()[\]{}"'`’”“]/g, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(isMeaningfulToken)
    .forEach((token) => {
      const normalized = normalizeToken(token);
      frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
    });

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .map(([token]) => token);
};

const getConceptPool = (text = '', title = '') => {
  const sentences = text
    .split(/[.!?؟\n]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 18)
    .slice(0, MAX_SENTENCES_FOR_CONCEPTS);

  const phraseScores = new Map();
  const registerPhrase = (phrase, weight = 1) => {
    const normalized = normalizeToken(phrase);
    if (
      !normalized ||
      normalized.length < MIN_PHRASE_LENGTH ||
      FR_STOPWORDS.has(normalized) ||
      DARIJA_STOPWORDS.has(normalized) ||
      (phraseScores.size >= MAX_PHRASE_CANDIDATES && !phraseScores.has(normalized))
    ) {
      return;
    }
    phraseScores.set(normalized, (phraseScores.get(normalized) || 0) + weight);
  };

  if (title?.trim()) {
    registerPhrase(title.trim(), 4);
  }

  sentences.forEach((sentence, index) => {
    const rawTokens = sentence.split(/\s+/).map((token) => token.trim()).filter(Boolean);
    const tokens = rawTokens.map(normalizeToken).filter(isMeaningfulToken);

    for (let size = 2; size <= 3; size += 1) {
      for (let i = 0; i <= tokens.length - size; i += 1) {
        const phrase = tokens.slice(i, i + size).join(' ');
        registerPhrase(phrase, Math.max(1, 5 - Math.floor(index / 3)));
      }
    }

    if (tokens.length) {
      registerPhrase(tokens[0], Math.max(1, 4 - Math.floor(index / 3)));
    }
  });

  const keywordPool = getKeywordPool(text).map((token, index) => [
    token,
    Math.max(1, MAX_KEYWORD_WEIGHT - Math.floor(index / KEYWORD_WEIGHT_DIVISOR)),
  ]);
  keywordPool.forEach(([token, weight]) => registerPhrase(token, weight));

  return dedupeCaseInsensitive(
    [...phraseScores.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .map(([phrase]) => phrase),
  );
};

const shuffle = (items) => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const buildFallbackOptions = (answer, keywords = [], fallbacks = ['معلومة عامة', 'تفصيل ثانوي']) => {
  const normalizedAnswer = normalizeToken(answer);
  const candidates = dedupeCaseInsensitive([
    ...keywords.filter((item) => item && normalizeToken(item) !== normalizedAnswer),
    ...fallbacks,
    'موضوع آخر',
    'معلومة عامة',
    'تفصيل إضافي',
  ]).filter((item) => normalizeToken(item) !== normalizedAnswer);

  const distractors = candidates.slice(0, 2);
  const backupLabels = ['معلومة إضافية', 'تفصيل آخر', 'موضوع مرتبط'];
  while (distractors.length < 2) {
    distractors.push(backupLabels[distractors.length] || backupLabels[backupLabels.length - 1]);
  }

  return shuffle([answer, distractors[0], distractors[1]]);
};

const generateQuestionsFromText = (text) => {
  const originalText = text?.originalText?.trim() || text?.original_text?.trim() || '';
  const darijaText = text?.darijaText?.trim() || text?.darija_text?.trim() || '';
  const title = text?.title?.trim() || 'هاد الوثيقة';
  const sourceText = `${originalText} ${darijaText}`.trim();

  if (!sourceText) {
    return [];
  }

  const frConcepts = getConceptPool(originalText || sourceText, title);
  const darijaConcepts = getConceptPool(darijaText || sourceText, title);
  const allConcepts = getConceptPool(sourceText, title);

  const frSentences = (originalText || sourceText)
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 24);

  const darijaSentences = (darijaText || sourceText)
    .split(/[.!?؟\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  const firstFrAnswer = frConcepts[0] || allConcepts[0] || title;
  const secondFrAnswer = frConcepts[1] || allConcepts[1] || DEFAULT_CONCEPT_FALLBACKS.fr[0];
  const thirdFrAnswer = frConcepts[2] || allConcepts[2] || DEFAULT_CONCEPT_FALLBACKS.fr[1];

  const firstDarijaAnswer = darijaConcepts[0] || allConcepts[0] || title;
  const secondDarijaAnswer = darijaConcepts[1] || allConcepts[1] || DEFAULT_CONCEPT_FALLBACKS.darija[0];
  const thirdDarijaAnswer = darijaConcepts[2] || allConcepts[2] || DEFAULT_CONCEPT_FALLBACKS.darija[1];

  const frFallbacks = ['thème secondaire', 'information hors sujet'];
  const enFallbacks = ['secondary theme', 'off-topic information'];
  const darijaFallbacks = ['موضوع ثانوي', 'معلومة خارج السياق'];

  return [
    {
      _id: `q_${text?._id || 'doc'}_1`,
      questionTextFr: `De quoi parle principalement ce document ?`,
      questionTextEn: `What is this document mainly about?`,
      questionTextDarija: `هاد الوثيقة اللي سفتّي كتدور على شنو بالأساس؟`,
      correctAnswerFr: firstFrAnswer,
      correctAnswerEn: firstFrAnswer,
      correctAnswerDarija: firstDarijaAnswer,
      optionsFr: buildFallbackOptions(firstFrAnswer, frConcepts, frFallbacks),
      optionsEn: buildFallbackOptions(firstFrAnswer, frConcepts, enFallbacks),
      optionsDarija: buildFallbackOptions(firstDarijaAnswer, darijaConcepts, darijaFallbacks),
      correctAnswer: firstDarijaAnswer,
      options: buildFallbackOptions(firstDarijaAnswer, darijaConcepts, darijaFallbacks),
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
      optionsFr: buildFallbackOptions(secondFrAnswer, frConcepts.slice().reverse(), frFallbacks),
      optionsEn: buildFallbackOptions(secondFrAnswer, frConcepts.slice().reverse(), enFallbacks),
      optionsDarija: buildFallbackOptions(secondDarijaAnswer, darijaConcepts.slice().reverse(), darijaFallbacks),
      correctAnswer: secondDarijaAnswer,
      options: buildFallbackOptions(secondDarijaAnswer, darijaConcepts.slice().reverse(), darijaFallbacks),
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
      optionsFr: buildFallbackOptions(thirdFrAnswer, frConcepts, frFallbacks),
      optionsEn: buildFallbackOptions(thirdFrAnswer, frConcepts, enFallbacks),
      optionsDarija: buildFallbackOptions(thirdDarijaAnswer, darijaConcepts, darijaFallbacks),
      correctAnswer: thirdDarijaAnswer,
      options: buildFallbackOptions(thirdDarijaAnswer, darijaConcepts, darijaFallbacks),
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

const getLevelFromXp = (xp = 0) => Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
const getStageIndex = (level = 1) => (Math.max(level, 1) - 1) % STAGE_DEFS.length;
const getLoopCount = (level = 1) => Math.floor((Math.max(level, 1) - 1) / STAGE_DEFS.length);
const getLevelName = (level = 1) => STAGE_DEFS[getStageIndex(level)]?.name || STAGE_DEFS[0].name;

const normalizeUser = (user) => {
  const xp = user?.xp || 0;
  const level = user?.level || getLevelFromXp(xp);

  return {
    id: user.id || user._id,
    username: user.username || user.user_metadata?.username || user.email?.split('@')[0] || 'Learner',
    email: user.email,
    avatar: user.avatar || '👧',
    avatarImage: user.avatarImage || user.avatar_image || '',
    level,
    levelName: user.levelName || user.level_name || getLevelName(level),
    xp,
    booksRead: user.booksRead || user.books_read || 0,
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

  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  localStorage.setItem(STORAGE_KEYS.texts, JSON.stringify(texts));

  return { users, texts };
};

const saveMockDb = (db) => {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(db.users));
  localStorage.setItem(STORAGE_KEYS.texts, JSON.stringify(db.texts));
};

const getStoredSessionUser = () => safeJsonParse(sessionStorage.getItem(STORAGE_KEYS.user), null);

const persistSessionTokens = ({ accessToken, refreshToken }) => {
  if (accessToken) {
    localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  }
};

const persistSessionUser = (user) => {
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  emitUserSync(user);
};

const persistSession = ({ accessToken, refreshToken, user }) => {
  persistSessionTokens({ accessToken, refreshToken });
  persistSessionUser(user);
};

const clearSession = () => {
  sessionStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  emitUserSync(null);
};

const getAccessToken = () => localStorage.getItem(STORAGE_KEYS.accessToken);
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
  const stageIndex = getStageIndex(currentLevel);

  return {
    currentLevel,
    stageIndex,
    levelName: getLevelName(currentLevel),
    totalXp: user.xp || 0,
    nextLevelXp: currentLevel * XP_PER_LEVEL,
    currentLevelBaseXp: (currentLevel - 1) * XP_PER_LEVEL,
    xpProgress: (user.xp || 0) % XP_PER_LEVEL,
    loopCount: getLoopCount(currentLevel),
    stages: STAGE_DEFS.map((stage, index) => ({
      ...stage,
      isCurrentStage: index === stageIndex,
    })),
  };
};

const buildProfilePayload = (user) => ({
  id: user.id,
  email: user.email,
  username: user.username,
  avatar: user.avatar || '👧',
  avatar_image: user.avatarImage || '',
  level: user.level,
  level_name: user.levelName,
  xp: user.xp,
  books_read: user.booksRead,
  badges: user.badges || [],
  stats: {
    readingTime: user.stats?.readingTime || 0,
    quizzesPassed: user.stats?.quizzesPassed || 0,
    bestStreak: user.stats?.bestStreak || 0,
    pagesRead: user.stats?.pagesRead || 0,
    importedCount: user.stats?.importedCount || 0,
    scannedCount: user.stats?.scannedCount || 0,
    perfectQuizzes: user.stats?.perfectQuizzes || 0,
    audioSessions: user.stats?.audioSessions || 0,
  },
  updated_at: new Date().toISOString(),
});

const normalizeProfileRecord = (profile, authUser = null) =>
  normalizeUser({
    id: profile?.id || authUser?.id,
    username: profile?.username || authUser?.user_metadata?.username || authUser?.email?.split('@')[0],
    email: profile?.email || authUser?.email,
    avatar: profile?.avatar || '👧',
    avatarImage: profile?.avatar_image || '',
    level: profile?.level || getLevelFromXp(profile?.xp || 0),
    levelName: profile?.level_name || getLevelName(profile?.level || getLevelFromXp(profile?.xp || 0)),
    xp: profile?.xp || 0,
    booksRead: profile?.books_read || 0,
    badges: profile?.badges || [],
    stats: profile?.stats || {},
  });

const normalizeTextRecord = (record) => ({
  _id: record.id,
  ownerId: record.owner_id,
  title: record.title,
  originalText: record.original_text,
  darijaText: record.darija_text,
  language: record.language || 'fr',
  source: record.source || 'upload',
  fileName: record.file_name || '',
  mimeType: record.mime_type || '',
  generatedQuestions:
    Array.isArray(record.generated_questions) && record.generated_questions.length > 0
      ? record.generated_questions
      : generateQuestionsFromText(record),
  readCount: record.read_count || 0,
  isFavorite: Boolean(record.is_favorite),
  createdAt: record.created_at || new Date().toISOString(),
});

const parseErrorMessage = async (response) => {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (typeof body === 'string') {
    return body;
  }

  return body?.msg || body?.error_description || body?.message || body?.error || 'Request failed';
};

const authHeaders = (token) => ({
  apikey: SUPABASE_PUBLISHABLE_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const publicHeaders = () => ({
  apikey: SUPABASE_PUBLISHABLE_KEY,
  'Content-Type': 'application/json',
});

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response.text();
  }

  return response.json();
};

const isSupabaseConfigured = () => {
  // Always use the local fallback database to prevent split-brain issues 
  // where saveText falls back but getTexts succeeds on an empty remote table.
  return false; 
};

const supabaseAuthRequest = async (path, options) =>
  fetchJson(`${SUPABASE_URL}/auth/v1${path}`, {
    ...options,
    headers: {
      ...publicHeaders(),
      ...(options?.headers || {}),
    },
  });

const supabaseRestRequest = async (path, { method = 'GET', body, token = getAccessToken(), prefer } = {}) =>
  fetchJson(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      ...authHeaders(token),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

const ensureSupabaseProfile = async (authUser, overrides = {}) => {
  const initialUser = normalizeUser({
    id: authUser.id,
    email: authUser.email,
    username: overrides.username || authUser.user_metadata?.username || authUser.email?.split('@')[0],
    avatarImage: overrides.avatarImage || '',
    xp: overrides.xp || 0,
    booksRead: overrides.booksRead || 0,
    badges: overrides.badges || [],
    stats:
      overrides.stats || {
        readingTime: 0,
        quizzesPassed: 0,
        bestStreak: 0,
        pagesRead: 0,
        importedCount: 0,
        scannedCount: 0,
        perfectQuizzes: 0,
        audioSessions: 0,
      },
  });

  const payload = buildProfilePayload(initialUser);
  const rows = await supabaseRestRequest('/profiles?on_conflict=id&select=*', {
    method: 'POST',
    body: payload,
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  return normalizeProfileRecord(rows?.[0], authUser);
};

const getSupabaseProfile = async (authUser = null) => {
  const userId = authUser?.id || getCurrentUserId();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const rows = await supabaseRestRequest(`/profiles?id=eq.${userId}&select=*`);
  if (rows?.[0]) {
    return normalizeProfileRecord(rows[0], authUser);
  }

  if (!authUser) {
    const currentAuthUser = await supabaseAuthRequest('/user', {
      method: 'GET',
      headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    return ensureSupabaseProfile(currentAuthUser);
  }

  return ensureSupabaseProfile(authUser);
};

const getSupabaseTexts = async () => {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  const rows = await supabaseRestRequest(
    `/texts?owner_id=eq.${userId}&select=*&order=created_at.desc`,
  );
  return (rows || []).map(normalizeTextRecord);
};

const upsertSupabaseProfile = async (updates) => {
  const currentUser = await getSupabaseProfile();
  const mergedUser = normalizeUser({
    ...currentUser,
    ...updates,
    stats: {
      ...currentUser.stats,
      ...(updates.stats || {}),
    },
  });

  const rows = await supabaseRestRequest('/profiles?on_conflict=id&select=*', {
    method: 'POST',
    body: buildProfilePayload(mergedUser),
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  const nextUser = normalizeProfileRecord(rows?.[0] || buildProfilePayload(mergedUser));
  persistSessionUser(nextUser);
  return { user: nextUser };
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
    persistSession({
      accessToken: `mock-token-${newUser.id}`,
      refreshToken: `mock-refresh-${newUser.id}`,
      user: newUser,
    });

    return { token: getAccessToken(), user: newUser };
  },

  login: async ({ email, password }) => {
    const db = loadMockDb();
    const found = db.users.find((user) => user.email.toLowerCase() === email.toLowerCase());

    if (!found || found.password !== password) {
      return { error: 'Email ou mot de passe incorrect.' };
    }

    const user = normalizeUser(found);
    persistSession({
      accessToken: `mock-token-${user.id}`,
      refreshToken: `mock-refresh-${user.id}`,
      user,
    });
    return { token: getAccessToken(), user };
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
      stats: {
        ...(user.stats || {}),
        ...(updates.stats || {}),
      },
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
            pagesRead: (user.stats?.pagesRead || 0) + estimatePageCount(text.originalText || text.darijaText || ''),
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
          importedCount: (user.stats?.importedCount || 0) + (source === 'upload' ? 1 : 0),
          scannedCount: (user.stats?.scannedCount || 0) + (source === 'scan' ? 1 : 0),
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

const withFallback = async (primary, fallback) => {
  if (isSupabaseConfigured()) {
    try {
      return await primary();
    } catch (error) {
      console.warn('Supabase request failed, falling back to mock:', error);
      if (fallback) return fallback();
      return { error: error.message || 'Network error' };
    }
  }

  return fallback ? fallback() : { error: 'Service unavailable' };
};

const loginWithSupabase = async (email, password) => {
  const data = await supabaseAuthRequest('/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  persistSessionTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
  const profile = await ensureSupabaseProfile(data.user, {
    username: data.user?.user_metadata?.username,
  });

  persistSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: profile,
  });

  return { token: data.access_token, user: profile };
};

const registerWithSupabase = async (username, email, password) => {
  const data = await supabaseAuthRequest('/signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      data: { username },
    }),
  });

  if (!data.access_token) {
    return loginWithSupabase(email, password);
  }

  persistSessionTokens({ accessToken: data.access_token, refreshToken: data.refresh_token });
  const profile = await ensureSupabaseProfile(data.user, { username });
  persistSession({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    user: profile,
  });

  return { token: data.access_token, user: profile };
};

const restoreSupabaseSession = async () => {
  const accessToken = getAccessToken();
  if (!accessToken) {
    return { user: getStoredSessionUser(), token: null };
  }

  const authUser = await supabaseAuthRequest('/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = await getSupabaseProfile(authUser);
  persistSessionUser(profile);
  return { user: profile, token: accessToken };
};

export const apiClient = {
  USER_SYNC_EVENT,

  setToken: (token) => {
    persistSessionTokens({ accessToken: token });
  },

  getToken: () => getAccessToken(),

  getStoredUser: () => getStoredSessionUser(),

  restoreSession: async () =>
    withFallback(
      restoreSupabaseSession,
      async () => ({ user: getStoredSessionUser(), token: getAccessToken() }),
    ),

  register: async (username, email, password) =>
    withFallback(
      () => registerWithSupabase(username, email, password),
      () => mockHandlers.register({ username, email, password }),
    ),

  login: async (email, password) =>
    withFallback(
      () => loginWithSupabase(email, password),
      () => mockHandlers.login({ email, password }),
    ),

  loginDemo: async () => mockHandlers.login({ email: 'test@example.com', password: 'password' }),

  logout: () => {
    clearSession();
  },

  getProfile: async () =>
    withFallback(
      async () => ({ user: await getSupabaseProfile() }),
      mockHandlers.getProfile,
    ),

  updateProfile: async (updates) =>
    withFallback(
      () => upsertSupabaseProfile(updates),
      () => mockHandlers.updateProfile(updates),
    ),

  addXP: async (xpAmount, metadata = {}) =>
    withFallback(
      async () => {
        const user = await getSupabaseProfile();
        const texts = await getSupabaseTexts();
        const nextXp = (user.xp || 0) + xpAmount;
        const updatedUser = applyAchievements(
          {
            ...user,
            xp: nextXp,
            level: getLevelFromXp(nextXp),
            levelName: getLevelName(getLevelFromXp(nextXp)),
            stats: {
              ...(user.stats || {}),
              quizzesPassed: (user.stats?.quizzesPassed || 0) + (metadata.quizCompleted ? 1 : 0),
              bestStreak: Math.max((user.stats?.bestStreak || 0) + 1, 1),
              perfectQuizzes:
                (user.stats?.perfectQuizzes || 0) +
                (metadata.quizCompleted && metadata.totalQuestions > 0 && metadata.correctAnswers === metadata.totalQuestions ? 1 : 0),
            },
          },
          texts,
        );

        await upsertSupabaseProfile(updatedUser);

        return {
          xp: updatedUser.xp,
          level: updatedUser.level,
          levelName: updatedUser.levelName,
          message: 'XP added successfully',
        };
      },
      () => mockHandlers.addXP(xpAmount, metadata),
    ),

  unlockBadge: async () => ({ message: 'Badge unlocked' }),

  saveText: async (title, originalText, darijaText, language = 'fr', source = 'upload', fileName = '', mimeType = '') =>
    withFallback(
      async () => {
        const user = await getSupabaseProfile();
        const payload = {
          owner_id: user.id,
          title,
          original_text: originalText,
          darija_text: darijaText,
          language,
          source,
          file_name: fileName,
          mime_type: mimeType,
          generated_questions: generateQuestionsFromText({ title, originalText, darijaText }),
          read_count: 0,
          is_favorite: false,
        };

        const rows = await supabaseRestRequest('/texts?select=*', {
          method: 'POST',
          body: payload,
          prefer: 'return=representation',
        });

        const texts = [...(await getSupabaseTexts()), normalizeTextRecord(rows?.[0])];
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
              importedCount: (user.stats?.importedCount || 0) + (source === 'upload' ? 1 : 0),
              scannedCount: (user.stats?.scannedCount || 0) + (source === 'scan' ? 1 : 0),
            },
          },
          texts,
        );

        await upsertSupabaseProfile(updatedUser);

        return {
          message: 'Text saved successfully',
          text: normalizeTextRecord(rows?.[0]),
          questionsGenerated: payload.generated_questions.length,
        };
      },
      () => mockHandlers.saveText({ title, originalText, darijaText, language, source, fileName, mimeType }),
    ),

  getTexts: async () =>
    withFallback(
      getSupabaseTexts,
      mockHandlers.getTexts,
    ),

  getText: async (textId) =>
    withFallback(
      async () => {
        const rows = await supabaseRestRequest(`/texts?id=eq.${textId}&select=*`);
        const rawText = rows?.[0];
        if (!rawText) {
          return { error: 'Text not found' };
        }

        const normalizedText = normalizeTextRecord(rawText);
        const previousReadCount = normalizedText.readCount || 0;
        const nextReadCount = previousReadCount + 1;

        await supabaseRestRequest(`/texts?id=eq.${textId}&select=*`, {
          method: 'PATCH',
          body: { read_count: nextReadCount },
          prefer: 'return=representation',
        });

        const user = await getSupabaseProfile();
        const texts = await getSupabaseTexts();
        const updatedUser = applyAchievements(
          {
            ...user,
            xp: (user.xp || 0) + (previousReadCount === 0 ? XP_RULES.firstRead : XP_RULES.repeatRead),
            level: getLevelFromXp((user.xp || 0) + (previousReadCount === 0 ? XP_RULES.firstRead : XP_RULES.repeatRead)),
            levelName: getLevelName(getLevelFromXp((user.xp || 0) + (previousReadCount === 0 ? XP_RULES.firstRead : XP_RULES.repeatRead))),
            stats: {
              ...(user.stats || {}),
              readingTime: (user.stats?.readingTime || 0) + 4,
              pagesRead:
                (user.stats?.pagesRead || 0) +
                estimatePageCount(normalizedText.originalText || normalizedText.darijaText || ''),
            },
          },
          texts,
        );

        await upsertSupabaseProfile(updatedUser);
        return { ...normalizedText, readCount: nextReadCount };
      },
      () => mockHandlers.getText(textId),
    ),

  toggleFavorite: async (textId) =>
    withFallback(
      async () => {
        const rows = await supabaseRestRequest(`/texts?id=eq.${textId}&select=*`);
        const record = rows?.[0];
        if (!record) {
          return { error: 'Text not found' };
        }

        const nextValue = !record.is_favorite;
        await supabaseRestRequest(`/texts?id=eq.${textId}&select=*`, {
          method: 'PATCH',
          body: { is_favorite: nextValue },
          prefer: 'return=representation',
        });

        return { isFavorite: nextValue };
      },
      () => mockHandlers.toggleFavorite(textId),
    ),

  deleteText: async (textId) =>
    withFallback(
      async () => {
        await supabaseRestRequest(`/texts?id=eq.${textId}`, {
          method: 'DELETE',
          prefer: 'return=minimal',
        });
        return { success: true };
      },
      () => mockHandlers.deleteText(textId),
    ),

  translateText: async (text) => mockHandlers.translateText({ text }),

  performOCR: async (base64Image, mimeType = 'image/jpeg') =>
    mockHandlers.performOCR(base64Image, mimeType),

  getQuizQuestions: async (textId) =>
    withFallback(
      async () => {
        const rows = await supabaseRestRequest(`/texts?id=eq.${textId}&select=*`);
        const record = rows?.[0];
        if (!record) {
          return buildDefaultQuiz();
        }

        const text = normalizeTextRecord(record);
        return text.generatedQuestions?.length ? text.generatedQuestions : buildDefaultQuiz();
      },
      () => mockHandlers.getQuizQuestions(textId),
    ),

  getRandomQuiz: async () => mockHandlers.getQuizQuestions(),

  submitAnswer: async (questionId, userAnswer) => mockHandlers.submitAnswer(questionId, userAnswer),

  getJourneyProgress: async () =>
    withFallback(
      async () => buildJourney(await getSupabaseProfile()),
      mockHandlers.getJourneyProgress,
    ),

  completeLevel: async (levelId) =>
    withFallback(
      async () => apiClient.addXP(200, { levelId }),
      () => mockHandlers.completeLevel(levelId),
    ),

  trackAudioSession: async () =>
    withFallback(
      async () => {
        const user = await getSupabaseProfile();
        const texts = await getSupabaseTexts();
        const nextXp = (user.xp || 0) + XP_RULES.audioSession;
        const updatedUser = applyAchievements(
          {
            ...user,
            xp: nextXp,
            level: getLevelFromXp(nextXp),
            levelName: getLevelName(getLevelFromXp(nextXp)),
            stats: {
              ...(user.stats || {}),
              audioSessions: (user.stats?.audioSessions || 0) + 1,
            },
          },
          texts,
        );

        await upsertSupabaseProfile(updatedUser);
        return { success: true, xp: updatedUser.xp, level: updatedUser.level };
      },
      mockHandlers.trackAudioSession,
    ),
};
