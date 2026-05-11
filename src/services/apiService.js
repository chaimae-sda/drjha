import { aiService } from './aiService';
import { ocrService } from './ocrService';

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://pagfnzzrzwwbwyljlovo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_KBwGs_g-cjNAJnnfSY-ZMw_MpCmZkTH';

const USER_SYNC_EVENT = 'darija:user-updated';
const XP_PER_LEVEL = 300;
const STORAGE_KEYS = {
  user: 'darija.session.user',
  accessToken: 'darija.session.access_token',
  refreshToken: 'darija.session.refresh_token',
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
const MIN_QUALITY_WORD_COUNT = 2;
const MAX_SINGLE_WORD_OPTIONS = 1;
const QUIZ_TARGET_COUNT = 5;
const QUIZ_ENGINE_VERSION = 'smart-ai-v1';
const QUIZ_FALLBACK_ENGINE_VERSION = 'smart-fallback-v2';
const MAX_AI_SOURCE_LENGTH = 30000; // Increased context length for better document understanding
const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY || '';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MISTRAL_MODEL = 'mistral-large-latest';

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
  const clauses = text
    .split(/[.!?؟\n,;:()]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => {
      const words = chunk.split(/\s+/).filter(Boolean);
      return words.length >= 2 && words.length <= 12;
    });

  const phraseScores = new Map();
  const registerPhrase = (phrase, weight = 1) => {
    if (!phrase || phrase.length < MIN_PHRASE_LENGTH) {
      return;
    }
    
    const words = phrase.toLowerCase().split(/\s+/).filter(Boolean);
    const allStopwords = words.every((w) => FR_STOPWORDS.has(w) || DARIJA_STOPWORDS.has(w));
    if (allStopwords) {
      return;
    }

    const normalizedKey = normalizeToken(phrase);
    if (!normalizedKey || (phraseScores.size >= MAX_PHRASE_CANDIDATES && !phraseScores.has(normalizedKey))) {
      return;
    }
    
    phraseScores.set(phrase, (phraseScores.get(phrase) || 0) + weight);
  };

  if (title?.trim()) {
    registerPhrase(title.trim(), 4);
  }

  clauses.forEach((clause, index) => {
    registerPhrase(clause, Math.max(1, 5 - Math.floor(index / 4)));
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

const countWords = (value = '') =>
  value
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;

const filterByMinWordCount = (items = [], minWordCount = 1) => {
  if (minWordCount <= 1) {
    return items;
  }

  const filtered = items.filter((item) => countWords(item) >= minWordCount);
  return filtered.length >= 2 ? filtered : items;
};

const getPreferredConcepts = (concepts = [], fallbackConcepts = []) => {
  const merged = dedupeCaseInsensitive([...concepts, ...fallbackConcepts]);
  const multiWordConcepts = merged.filter((item) => countWords(item) >= MIN_QUALITY_WORD_COUNT);
  return multiWordConcepts.length ? multiWordConcepts : merged;
};

const hasArabicScript = (value = '') => /[\u0600-\u06FF]/u.test(String(value));

const getLocaleConcepts = (concepts = [], locale, fallbackConcepts = []) => {
  const localeFiltered =
    locale === 'darija'
      ? concepts.filter(hasArabicScript)
      : concepts.filter((item) => !hasArabicScript(item));
  const fallbackFiltered =
    locale === 'darija'
      ? fallbackConcepts.filter(hasArabicScript)
      : fallbackConcepts.filter((item) => !hasArabicScript(item));

  return dedupeCaseInsensitive([...localeFiltered, ...fallbackFiltered]);
};

const getBackupLabelsByLocale = (localeHint = '') => {
  if (/[\u0600-\u06FF]/u.test(localeHint)) {
    return ['معلومة مرتبطة بالنص', 'تفصيل مهم', 'موضوع قريب'];
  }

  if (/\b(off-topic|secondary|information)\b/i.test(localeHint)) {
    return ['related detail', 'secondary idea', 'connected topic'];
  }

  return ['idée secondaire', 'information complémentaire', 'sujet connexe'];
};

const buildFallbackOptions = (
  answer,
  keywords = [],
  fallbacks = ['معلومة عامة', 'تفصيل ثانوي'],
  { minWordCount = 1, locale = 'fr' } = {},
) => {
  const normalizedAnswer = normalizeToken(answer);
  const localeFallbacks =
    locale === 'darija'
      ? ['موضوع آخر', 'معلومة عامة', 'تفصيل إضافي']
      : locale === 'en'
        ? ['another topic', 'general information', 'additional detail']
        : ['autre sujet', 'information générale', 'détail complémentaire'];
  const localeMatches = (item) => (locale === 'darija' ? hasArabicScript(item) : !hasArabicScript(item));
  const candidates = dedupeCaseInsensitive([
    ...keywords.filter((item) => item && normalizeToken(item) !== normalizedAnswer && localeMatches(item)),
    ...fallbacks,
    ...localeFallbacks,
  ]).filter((item) => normalizeToken(item) !== normalizedAnswer);

  const qualityCandidates = filterByMinWordCount(candidates, minWordCount);
  const toTokenSet = (value = '') =>
    new Set(
      normalizeToken(value)
        .split(/\s+/)
        .filter((token) => token.length > 2),
    );

  const similarityScore = (a, b) => {
    const setA = toTokenSet(a);
    const setB = toTokenSet(b);

    if (setA.size === 0 || setB.size === 0) {
      return 0;
    }

    let overlap = 0;
    setA.forEach((token) => {
      if (setB.has(token)) {
        overlap += 1;
      }
    });

    return overlap / Math.max(setA.size, setB.size);
  };

  const isTooSimilar = (a, b) => similarityScore(a, b) >= 0.72;

  const distractors = [];
  for (const candidate of qualityCandidates) {
    if (isTooSimilar(candidate, answer)) {
      continue;
    }

    if (distractors.some((existing) => isTooSimilar(existing, candidate))) {
      continue;
    }

    distractors.push(candidate);
    if (distractors.length >= 2) {
      break;
    }
  }

  const localeHint = `${answer || ''} ${fallbacks.join(' ')}`;
  const backupLabels = getBackupLabelsByLocale(localeHint);

  while (distractors.length < 2) {
    const backupCandidate = backupLabels[distractors.length] || backupLabels[backupLabels.length - 1];
    if (!isTooSimilar(backupCandidate, answer)) {
      distractors.push(backupCandidate);
    } else {
      distractors.push(`${backupCandidate} ${distractors.length + 1}`);
    }
  }

  return shuffle([answer, distractors[0], distractors[1]]);
};

const generateBestQuestionsForText = async (text) => {
  // Try AI-generated questions first (most relevant and accurate)
  const aiQuestions = await generateQuestionsWithAI(text);
  if (Array.isArray(aiQuestions) && aiQuestions.length > 0 && !isLowQualityGeneratedQuiz(aiQuestions)) {
    return aiQuestions;
  }

  return generateQuestionsFromText(text);
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

  const frPreferredConcepts = getLocaleConcepts(getPreferredConcepts(frConcepts, allConcepts), 'fr', DEFAULT_CONCEPT_FALLBACKS.fr);
  const enPreferredConcepts = ['main idea', 'key information', 'important detail', 'useful idea', 'related theme'];
  const darijaPreferredConcepts = getLocaleConcepts(getPreferredConcepts(darijaConcepts, allConcepts), 'darija', DEFAULT_CONCEPT_FALLBACKS.darija);
  const frSentences = (originalText || sourceText)
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 24);

  const darijaSentences = (darijaText || sourceText)
    .split(/[.!?؟\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);

  const firstFrAnswer = frPreferredConcepts[0] || DEFAULT_CONCEPT_FALLBACKS.fr[0];
  const secondFrAnswer = frPreferredConcepts[1] || DEFAULT_CONCEPT_FALLBACKS.fr[0];
  const thirdFrAnswer = frPreferredConcepts[2] || DEFAULT_CONCEPT_FALLBACKS.fr[1];
  const fourthFrAnswer = frPreferredConcepts[3] || DEFAULT_CONCEPT_FALLBACKS.fr[0];
  const firstEnAnswer = enPreferredConcepts[0] || 'main idea';
  const secondEnAnswer = enPreferredConcepts[1] || 'key information';
  const thirdEnAnswer = enPreferredConcepts[2] || 'important detail';
  const fourthEnAnswer = enPreferredConcepts[3] || 'useful idea';
  const firstDarijaAnswer = darijaPreferredConcepts[0] || DEFAULT_CONCEPT_FALLBACKS.darija[0];
  const secondDarijaAnswer = darijaPreferredConcepts[1] || DEFAULT_CONCEPT_FALLBACKS.darija[0];
  const thirdDarijaAnswer = darijaPreferredConcepts[2] || DEFAULT_CONCEPT_FALLBACKS.darija[1];
  const fourthDarijaAnswer = darijaPreferredConcepts[3] || DEFAULT_CONCEPT_FALLBACKS.darija[0];

  const introFrSnippet = frSentences[0]
    ? `${frSentences[0].slice(0, 88)}${frSentences[0].length > 88 ? '...' : ''}`
    : firstFrAnswer;
  const introDarijaSnippet = darijaSentences[0]
    ? `${darijaSentences[0].slice(0, 88)}${darijaSentences[0].length > 88 ? '...' : ''}`
    : firstDarijaAnswer;

  const frFallbacks = ['thème secondaire', 'information hors sujet'];
  const enFallbacks = ['secondary theme', 'off-topic information'];
  const darijaFallbacks = ['موضوع ثانوي', 'معلومة خارج السياق'];

  return [
    {
      _id: `q_${text?._id || 'doc'}_1`,
      questionTextFr: `De quoi parle principalement "${title}" ?`,
      questionTextEn: `What is "${title}" mainly about?`,
      questionTextDarija: `ما هو الموضوع الرئيسي في "${title}"؟`,
      correctAnswerFr: firstFrAnswer,
      correctAnswerEn: firstEnAnswer,
      correctAnswerDarija: firstDarijaAnswer,
      optionsFr: buildFallbackOptions(firstFrAnswer, frPreferredConcepts, frFallbacks, { minWordCount: 2, locale: 'fr' }),
      optionsEn: buildFallbackOptions(firstEnAnswer, enPreferredConcepts, enFallbacks, { minWordCount: 2, locale: 'en' }),
      optionsDarija: buildFallbackOptions(firstDarijaAnswer, darijaPreferredConcepts, darijaFallbacks, { minWordCount: 2, locale: 'darija' }),
      correctAnswer: firstDarijaAnswer,
      options: buildFallbackOptions(firstDarijaAnswer, darijaPreferredConcepts, darijaFallbacks, { minWordCount: 2, locale: 'darija' }),
      xpReward: 25,
      engineVersion: QUIZ_FALLBACK_ENGINE_VERSION,
    },
    {
      _id: `q_${text?._id || 'doc'}_2`,
      questionTextFr: `Quel concept important est expliqué dans "${title}" ?`,
      questionTextEn: `Which key concept is explained in "${title}"?`,
      questionTextDarija: `شنو من مفهوم مهم متشرح فالنص "${title}"؟`,
      correctAnswerFr: secondFrAnswer,
      correctAnswerEn: secondEnAnswer,
      correctAnswerDarija: secondDarijaAnswer,
      optionsFr: buildFallbackOptions(secondFrAnswer, frPreferredConcepts.slice().reverse(), frFallbacks, { minWordCount: 2, locale: 'fr' }),
      optionsEn: buildFallbackOptions(secondEnAnswer, enPreferredConcepts.slice().reverse(), enFallbacks, { minWordCount: 2, locale: 'en' }),
      optionsDarija: buildFallbackOptions(secondDarijaAnswer, darijaPreferredConcepts.slice().reverse(), darijaFallbacks, { minWordCount: 2, locale: 'darija' }),
      correctAnswer: secondDarijaAnswer,
      options: buildFallbackOptions(secondDarijaAnswer, darijaPreferredConcepts.slice().reverse(), darijaFallbacks, { minWordCount: 2, locale: 'darija' }),
      xpReward: 25,
      engineVersion: QUIZ_FALLBACK_ENGINE_VERSION,
    },
    {
      _id: `q_${text?._id || 'doc'}_3`,
      questionTextFr: `Quelle reformulation respecte ce passage : "${introFrSnippet}" ?`,
      questionTextEn: `Which rephrasing matches this passage: "${introFrSnippet}"?`,
      questionTextDarija: `شنو الصياغة اللي كتبقى وفية لهاد المقطع: "${introDarijaSnippet}"؟`,
      correctAnswerFr: thirdFrAnswer,
      correctAnswerEn: thirdEnAnswer,
      correctAnswerDarija: thirdDarijaAnswer,
      optionsFr: buildFallbackOptions(thirdFrAnswer, frPreferredConcepts, frFallbacks, { minWordCount: 2, locale: 'fr' }),
      optionsEn: buildFallbackOptions(thirdEnAnswer, enPreferredConcepts, enFallbacks, { minWordCount: 2, locale: 'en' }),
      optionsDarija: buildFallbackOptions(thirdDarijaAnswer, darijaPreferredConcepts, darijaFallbacks, { minWordCount: 2, locale: 'darija' }),
      correctAnswer: thirdDarijaAnswer,
      options: buildFallbackOptions(thirdDarijaAnswer, darijaPreferredConcepts, darijaFallbacks, { minWordCount: 2, locale: 'darija' }),
      xpReward: 30,
      engineVersion: QUIZ_FALLBACK_ENGINE_VERSION,
    },
    {
      _id: `q_${text?._id || 'doc'}_4`,
      questionTextFr: `Pourquoi "${title}" est-il/elle utile à lire ?`,
      questionTextEn: `Why is "${title}" useful to read?`,
      questionTextDarija: `علاش قراية "${title}" مفيدة؟`,
      correctAnswerFr: fourthFrAnswer,
      correctAnswerEn: fourthEnAnswer,
      correctAnswerDarija: fourthDarijaAnswer,
      optionsFr: buildFallbackOptions(fourthFrAnswer, frPreferredConcepts, ['opinion sans lien', 'thème complètement différent'], { minWordCount: 2, locale: 'fr' }),
      optionsEn: buildFallbackOptions(fourthEnAnswer, enPreferredConcepts, ['unrelated opinion', 'completely different theme'], { minWordCount: 2, locale: 'en' }),
      optionsDarija: buildFallbackOptions(fourthDarijaAnswer, darijaPreferredConcepts, ['رأي بلا علاقة', 'موضوع مختلف بزاف'], { minWordCount: 2, locale: 'darija' }),
      correctAnswer: fourthDarijaAnswer,
      options: buildFallbackOptions(fourthDarijaAnswer, darijaPreferredConcepts, ['رأي بلا علاقة', 'موضوع مختلف بزاف'], { minWordCount: 2, locale: 'darija' }),
      xpReward: 30,
      engineVersion: QUIZ_FALLBACK_ENGINE_VERSION,
    },
    {
      _id: `q_${text?._id || 'doc'}_5`,
      questionTextFr: `Quelle affirmation correspond le mieux à "${title}" ?`,
      questionTextEn: `Which statement best matches "${title}"?`,
      questionTextDarija: `شنو الجملة اللي كتناسب "${title}" أكثر؟`,
      correctAnswerFr: firstFrAnswer,
      correctAnswerEn: firstEnAnswer,
      correctAnswerDarija: firstDarijaAnswer,
      optionsFr: buildFallbackOptions(firstFrAnswer, frPreferredConcepts, ['idée inventée', 'information non mentionnée'], { minWordCount: 2, locale: 'fr' }),
      optionsEn: buildFallbackOptions(firstEnAnswer, enPreferredConcepts, ['invented idea', 'not mentioned information'], { minWordCount: 2, locale: 'en' }),
      optionsDarija: buildFallbackOptions(firstDarijaAnswer, darijaPreferredConcepts, ['فكرة مخترعة', 'معلومة ما جا ذكرهاش'], { minWordCount: 2, locale: 'darija' }),
      correctAnswer: firstDarijaAnswer,
      options: buildFallbackOptions(firstDarijaAnswer, darijaPreferredConcepts, ['فكرة مخترعة', 'معلومة ما جا ذكرهاش'], { minWordCount: 2, locale: 'darija' }),
      xpReward: 35,
      engineVersion: QUIZ_FALLBACK_ENGINE_VERSION,
    },
  ].slice(0, QUIZ_TARGET_COUNT);
};

const parseJsonArray = (value = '') => {
  const cleaned = value.replace(/```json|```/gi, '').trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const normalizeAiQuestion = (rawQuestion, index, textId = 'doc') => {
  const normalizedOptions = dedupeCaseInsensitive(
    (Array.isArray(rawQuestion?.optionsFr) ? rawQuestion.optionsFr : rawQuestion?.options || [])
      .map((option) => String(option || '').trim())
      .filter((option) => option && !hasArabicScript(option)),
  );

  const normalizedOptionsDarija = dedupeCaseInsensitive(
    (Array.isArray(rawQuestion?.optionsDarija) ? rawQuestion.optionsDarija : rawQuestion?.options || [])
      .map((option) => String(option || '').trim())
      .filter((option) => option && hasArabicScript(option)),
  );

  if (normalizedOptions.length < 2 || normalizedOptionsDarija.length < 2) {
    return null;
  }

  const baseFrOptions = normalizedOptions.slice(0, 3);
  const baseDarijaOptions = normalizedOptionsDarija.slice(0, 3);

  const rawEnOptions = dedupeCaseInsensitive(
    (Array.isArray(rawQuestion?.optionsEn) ? rawQuestion.optionsEn : [])
      .map((option) => String(option || '').trim())
      .filter((option) => option && !hasArabicScript(option)),
  );

  if (rawEnOptions.length < 2) {
    return null;
  }
  const baseEnOptions = rawEnOptions.slice(0, 3);

  const getCorrect = (options, directAnswer) => {
    const indexFromText = options.findIndex((option) => normalizeToken(option) === normalizeToken(directAnswer));
    const indexFromRaw = Number.isInteger(rawQuestion?.correctIndex) ? rawQuestion.correctIndex : -1;
    const index =
      indexFromText >= 0
        ? indexFromText
        : indexFromRaw >= 0 && indexFromRaw < options.length
          ? indexFromRaw
          : 0;
    return options[index];
  };

  const correctFr = getCorrect(baseFrOptions, rawQuestion?.correctAnswerFr || rawQuestion?.correctAnswer);
  const correctEn = getCorrect(baseEnOptions, rawQuestion?.correctAnswerEn || rawQuestion?.correctAnswer || correctFr);
  const correctDarija = getCorrect(baseDarijaOptions, rawQuestion?.correctAnswerDarija || rawQuestion?.correctAnswer || correctFr);

  return {
    _id: rawQuestion?._id || `q_${textId}_${index + 1}`,
    questionTextFr: String(rawQuestion?.questionTextFr || rawQuestion?.questionFr || rawQuestion?.question || '').trim(),
    questionTextEn: String(rawQuestion?.questionTextEn || rawQuestion?.questionEn || rawQuestion?.question || '').trim(),
    questionTextDarija: String(rawQuestion?.questionTextDarija || rawQuestion?.questionDarija || rawQuestion?.question || '').trim(),
    correctAnswerFr: correctFr,
    correctAnswerEn: correctEn,
    correctAnswerDarija: correctDarija,
    optionsFr: baseFrOptions,
    optionsEn: baseEnOptions,
    optionsDarija: baseDarijaOptions,
    correctAnswer: correctDarija,
    options: baseDarijaOptions,
    xpReward: Number.isFinite(rawQuestion?.xpReward) ? rawQuestion.xpReward : 30,
    engineVersion: QUIZ_ENGINE_VERSION,
  };
};

const generateQuestionsWithAI = async (text) => {
  if (!MISTRAL_API_KEY) {
    return null;
  }

  const originalText = text?.originalText?.trim() || text?.original_text?.trim() || '';
  const darijaText = text?.darijaText?.trim() || text?.darija_text?.trim() || '';
  const title = text?.title?.trim() || 'document';
  const combinedText = `${originalText}\n${darijaText}`.trim().slice(0, MAX_AI_SOURCE_LENGTH);

  // Let shorter uploads still try AI; the fallback should only be a last resort.
  if (!combinedText || countWords(combinedText) < 12) {
    return null;
  }

  const prompt = `Create exactly ${QUIZ_TARGET_COUNT} high-quality multiple-choice quiz questions based on "${title}".

DocumentTitle: ${title}
Text:
${combinedText}

Return JSON array only. No markdown.
Each item must follow this schema:
{
  "questionTextFr": "...",
  "questionTextEn": "...",
  "questionTextDarija": "...",
  "optionsFr": ["A", "B", "C"],
  "optionsEn": ["A", "B", "C"],
  "optionsDarija": ["A", "B", "C"],
  "correctIndex": 0,
  "xpReward": 30
}

IMPORTANT INSTRUCTIONS:
- NEVER use generic phrases like "ce texte", "ce document", "this document", or "this text"
- ALWAYS reference the document title "${title}" when asking questions
- Example: "According to '${title}', what...", "In '${title}', which...", "What does '${title}' say about..."
- Rephrase in French: "D'après '${title}'", "Dans '${title}'", "Selon '${title}'"
- Rephrase in Darija: "حسب '${title}'", "شنو كيقول '${title}' على..."

Rules:
- Exactly 3 options per language.
- Questions MUST test actual facts and comprehension from "${title}". DO NOT ask generic questions like "Which sentence fits best?" or "What is the main idea?".
- Options MUST be natural-sounding, grammatically correct phrases. DO NOT just paste raw bullet points, headings, or literal word-for-word translations.
- For Darija: Use authentic, natural Moroccan Arabic. Do not use robotic or formal literal translations. The sentences must make sense when spoken.
- Questions should be of medium difficulty: not too easy, and not too difficult. They must test genuine understanding.
- Distractors must be plausible, relevant to the text content, but clearly wrong.
- Do not generate options that are just re-ordered words from the same phrase.
- correctIndex must point to the right option in each options array.
- Make questions specific and highly relevant to the actual factual content of "${title}".`;

  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: MISTRAL_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.35,
        top_p: 0.9,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const responseText = payload?.choices?.[0]?.message?.content;
    if (!responseText) {
      return null;
    }

    const parsed = parseJsonArray(responseText);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return null;
    }

    const normalized = parsed
      .slice(0, QUIZ_TARGET_COUNT)
      .map((item, index) => normalizeAiQuestion(item, index, text?._id || text?.id || 'doc'))
      .filter((question) => question.questionTextFr || question.questionTextDarija);

    if (normalized.length < 3 || isLowQualityGeneratedQuiz(normalized)) {
      return null;
    }

    return normalized;
  } catch {
    return null;
  }
};

const getOptionSimilarity = (a = '', b = '') => {
  const aTokens = new Set(
    normalizeToken(a)
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
  const bTokens = new Set(
    normalizeToken(b)
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );

  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  });

  return overlap / Math.max(aTokens.size, bTokens.size);
};

const isWeakOptionSet = (options = []) => {
  if (!Array.isArray(options) || options.length < 3) {
    return true;
  }

  const normalized = options
    .map((option) => String(option || '').trim())
    .filter(Boolean);

  if (normalized.length < 3) {
    return true;
  }

  if (dedupeCaseInsensitive(normalized).length < 3) {
    return true;
  }

  const tooManyOneWord =
    normalized.filter((option) => countWords(option) < MIN_QUALITY_WORD_COUNT).length > MAX_SINGLE_WORD_OPTIONS;
  if (tooManyOneWord) {
    return true;
  }

  for (let i = 0; i < normalized.length; i += 1) {
    for (let j = i + 1; j < normalized.length; j += 1) {
      if (getOptionSimilarity(normalized[i], normalized[j]) >= 0.72) {
        return true;
      }
    }
  }

  return false;
};

const hasWrongScriptForLocale = (values = [], locale) => {
  const normalized = values
    .flat()
    .filter(Boolean)
    .map((value) => String(value).replace(/"[^"]*"|'[^']*'/g, '').trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return true;
  }

  if (locale === 'darija') {
    return normalized.some((value) => !hasArabicScript(value));
  }

  return normalized.some(hasArabicScript);
};

const isLowQualityGeneratedQuiz = (questions = []) =>
  !Array.isArray(questions) ||
  questions.length === 0 ||
  questions.some((question) => {
    const answers = [question?.correctAnswerFr, question?.correctAnswerDarija, question?.correctAnswer]
      .filter(Boolean)
      .map((value) => String(value));
    const weakAnswer =
      answers.length > 0 && answers.every((answer) => countWords(answer) < MIN_QUALITY_WORD_COUNT);
    const weakOptions = [question?.optionsFr, question?.optionsDarija, question?.options].some(isWeakOptionSet);
    return weakAnswer || weakOptions; // Removed mixedLanguage check which was too aggressive
  });

const needsQuestionRefresh = (questions = []) =>
  !Array.isArray(questions) ||
  questions.length === 0 ||
  isLowQualityGeneratedQuiz(questions) ||
  questions.some((question) => question?.engineVersion !== QUIZ_ENGINE_VERSION && question?.engineVersion !== QUIZ_FALLBACK_ENGINE_VERSION);

const ensureHighQualityQuestions = (text, existingQuestions = []) => {
  const hasOldEngine = existingQuestions.some(
    (q) => q?.engineVersion !== QUIZ_ENGINE_VERSION && q?.engineVersion !== QUIZ_FALLBACK_ENGINE_VERSION
  );
  if (!Array.isArray(existingQuestions) || existingQuestions.length === 0 || isLowQualityGeneratedQuiz(existingQuestions) || hasOldEngine) {
    return [];
  }

  return existingQuestions;
};

const generateSmartQuestionsForText = async (text, existingQuestions = []) => {
  // Always use AI to generate questions. No fallback, no mock, no default.
  const aiQuestions = await generateQuestionsWithAI(text);
  if (Array.isArray(aiQuestions) && aiQuestions.length > 0 && !isLowQualityGeneratedQuiz(aiQuestions)) {
    return aiQuestions;
  }
  // If AI fails, return empty array (no fallback)
  return [];
};



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
    xpPerLevel: XP_PER_LEVEL,
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
  generatedQuestions: ensureHighQualityQuestions(record, record.generated_questions),
  readCount: record.read_count || 0,
  isFavorite: Boolean(record.is_favorite),
  createdAt: record.created_at || new Date().toISOString(),
  updatedAt: record.updated_at || record.created_at || new Date().toISOString(),
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

const supabaseRestRequest = async (path, { method = 'GET', body, token = getAccessToken(), prefer } = {}) => {
  if (!token) {
    throw new Error('Unauthorized');
  }

  return fetchJson(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      ...authHeaders(token),
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
};

const getSupabaseAuthUser = () =>
  supabaseAuthRequest('/user', {
    method: 'GET',
    headers: { Authorization: `Bearer ${getAccessToken()}` },
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
    const currentAuthUser = await getSupabaseAuthUser();
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

// ...existing code...

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
      generatedQuestions: await generateBestQuestionsForText({ title, originalText, darijaText }),
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
      return [];
    }

    const refreshedQuestions = await generateSmartQuestionsForText(text, text.generatedQuestions);

    text.generatedQuestions = refreshedQuestions;
    saveMockDb(db);

    return refreshedQuestions.length > 0 ? refreshedQuestions : [];
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

  restoreSession: restoreSupabaseSession,

  register: async (username, email, password) => registerWithSupabase(username, email, password),

  login: async (email, password) => loginWithSupabase(email, password),

  logout: () => {
    clearSession();
  },

  getProfile: async () => ({ user: await getSupabaseProfile() }),

  updateProfile: async (updates) => upsertSupabaseProfile(updates),

  addXP: async (xpAmount, metadata = {}) => {
    const user = await getSupabaseProfile();
    const texts = await getSupabaseTexts();
    const nextXp = (user.xp || 0) + xpAmount;

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
          perfectQuizzes:
            (user.stats?.perfectQuizzes || 0) +
            (metadata.quizCompleted && metadata.totalQuestions > 0 && metadata.correctAnswers === metadata.totalQuestions ? 1 : 0),
          completedTextIds,
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

  saveText: async (title, originalText, darijaText, language = 'fr', source = 'upload', fileName = '', mimeType = '') => {
    const authUser = await getSupabaseAuthUser();
    const user = await getSupabaseProfile(authUser);
    const payload = {
      owner_id: authUser.id,
      title,
      original_text: originalText,
      darija_text: darijaText,
      language,
      source,
      file_name: fileName,
      mime_type: mimeType,
      generated_questions: await generateBestQuestionsForText({ title, originalText, darijaText }),
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

  getTexts: async () => getSupabaseTexts(),

  getText: async (textId) => {
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

  toggleFavorite: async (textId) => {
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

  deleteText: async (textId) => {
    await supabaseRestRequest(`/texts?id=eq.${textId}`, {
      method: 'DELETE',
      prefer: 'return=minimal',
    });
    return { success: true };
  },

  translateText: async (text) => ({ translated: await aiService.translate(text) }),

  performOCR: async (base64Image, mimeType = 'image/jpeg') => ocrService.scanImage(base64Image, mimeType),

  getQuizQuestions: async (textId) => {
    const rows = await supabaseRestRequest(`/texts?id=eq.${textId}&select=*`);
    const record = rows?.[0];
    if (!record) {
      return { error: 'Text not found' };
    }

    const existingQuestions = Array.isArray(record.generated_questions) ? record.generated_questions : [];
    const refreshed = await generateSmartQuestionsForText(normalizeTextRecord(record), existingQuestions);

    try {
      await supabaseRestRequest(`/texts?id=eq.${textId}&select=*`, {
        method: 'PATCH',
        body: { generated_questions: refreshed },
        prefer: 'return=representation',
      });
    } catch (error) {
      console.warn('Unable to persist refreshed quiz questions to Supabase:', error);
    }

    return refreshed.length ? refreshed : { error: 'No quiz questions available' };
  },

  getJourneyProgress: async () => buildJourney(await getSupabaseProfile()),

  completeLevel: async (levelId) => apiClient.addXP(200, { levelId }),

  trackAudioSession: async () => {
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
};
