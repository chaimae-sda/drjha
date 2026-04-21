/**
 * SMART Quiz Generation Service
 * Uses AI-first approach for intelligent comprehension questions
 * Falls back to basic generation only if AI is unavailable
 */

// Generate questions using Gemini API - primary method
const generateWithAI = async (text, apiKey) => {
  if (!apiKey || !text || text.length < 50) return null;

  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a professional language teacher creating comprehension questions for French/Darija learners.

TEXT TO ANALYZE:
"""
${text}
"""

Create exactly 5 multiple-choice comprehension questions that:
1. Test genuine understanding of the text (not just word spotting)
2. Have clearly correct answers based on text content
3. Include plausible but distinctly different distractors
4. Vary in difficulty (easy, medium, hard)
5. Cover different aspects: main idea, details, inference, vocabulary, theme

Return ONLY a valid JSON array (no markdown, no comments):
[
  {
    "question": "Main question in French or simple English",
    "questionDarija": "Question in Moroccan Darija Arabic",
    "options": ["option A", "option B", "option C"],
    "correct": 0,
    "type": "comprehension|factual|inference|vocabulary|theme",
    "difficulty": "easy|medium|hard"
  }
]

Rules:
- All 3 options must be grammatically similar
- Correct answer must be factually in the text
- Distractors should be plausible false answers, not absurd
- Use simple language suitable for learners
- Return ONLY the JSON array, nothing else`;

    const result = await model.generateContent({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    });

    const responseText = result.response?.text?.() || result.response?.text;
    if (!responseText) {
      console.warn('No response from Gemini');
      return null;
    }

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      console.warn('Could not find JSON in response:', responseText.slice(0, 200));
      return null;
    }

    const aiQuestions = JSON.parse(jsonMatch[0]);
    
    // Validate and format
    return aiQuestions
      .slice(0, 5)
      .filter(q => q.options && q.options.length === 3 && q.correct !== undefined)
      .map((q, idx) => ({
        id: idx + 1,
        type: q.type || 'comprehension',
        question: q.question,
        questionDarija: q.questionDarija || '',
        options: q.options,
        correct: q.correct,
        difficulty: q.difficulty || 'medium'
      }));
  } catch (error) {
    console.error('AI generation error:', error);
    return null;
  }
};

// Fallback: Basic extraction of important content
const extractTextStructure = (text) => {
  // Get sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 15)
    .slice(0, 15);

  // Get all significant words and phrases
  const allWords = text
    .toLowerCase()
    .split(/[\s.,!?;:—-]+/)
    .filter(w => w.length > 3 && w.length < 25)
    .filter(w => !/^(the|and|that|this|from|with|for|are|was|were|have|has|been|about|which)$/.test(w));

  // Find key multi-word phrases (2-3 words)
  const multiWordPhrases = [];
  for (let i = 0; i < sentences.length; i++) {
    const words = sentences[i].split(/\s+/).filter(w => w.length > 3);
    for (let j = 0; j < words.length - 1; j++) {
      const phrase = words.slice(j, Math.min(j + 2, words.length)).join(' ');
      if (phrase.length > 5 && phrase.length < 40) {
        multiWordPhrases.push(phrase);
      }
    }
  }

  // Frequency analysis
  const wordFreq = {};
  allWords.forEach(w => {
    wordFreq[w] = (wordFreq[w] || 0) + 1;
  });

  const topWords = Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([w]) => w);

  return { sentences, topWords, multiWordPhrases };
};

// Fallback generation - much smarter version
const generateBasicQuestions = (text) => {
  const { sentences, topWords, multiWordPhrases } = extractTextStructure(text);
  
  if (sentences.length < 2 || topWords.length < 3) {
    console.warn('Text structure insufficient for questions');
    return null;
  }

  const questions = [];
  const usedConcepts = new Set();

  // Q1: Main topic from first sentence
  if (sentences[0]) {
    const firstSentence = sentences[0];
    const mainConcept = multiWordPhrases[0] || topWords[0];
    
    // Create 3 distinct alternatives
    const concept1 = mainConcept;
    const concept2 = multiWordPhrases[2] || topWords[2] || 'something different';
    const concept3 = multiWordPhrases[4] || topWords[4] || 'another topic';

    if (concept1 && concept1 !== concept2 && concept1 !== concept3) {
      questions.push({
        id: 1,
        type: 'comprehension',
        question: `What is the first thing discussed in this text?`,
        questionDarija: `شنو أول حاجة اللي كتهضر عليها النص؟`,
        options: [concept1, concept2, concept3],
        correct: 0,
        difficulty: 'easy'
      });
      usedConcepts.add(concept1);
    }
  }

  // Q2: Key detail from middle
  if (sentences.length > 2) {
    const middleSentence = sentences[Math.floor(sentences.length / 2)];
    const detailConcept = multiWordPhrases[Math.floor(multiWordPhrases.length / 2)] || topWords[1];
    const alt1 = topWords[3] || 'secondary topic';
    const alt2 = topWords[5] || 'general concept';

    if (detailConcept && detailConcept !== alt1 && detailConcept !== alt2) {
      questions.push({
        id: 2,
        type: 'factual',
        question: `Which of these is specifically mentioned in the text?`,
        questionDarija: `واش هاد الحاجة مكتوبة بالضبط فالنص؟`,
        options: [detailConcept, alt1, alt2],
        correct: 0,
        difficulty: 'easy'
      });
      usedConcepts.add(detailConcept);
    }
  }

  // Q3: Relationship/Connection question
  if (sentences.length > 1 && topWords.length > 1) {
    questions.push({
      id: 3,
      type: 'inference',
      question: `What is the relationship between the main ideas in this text?`,
      questionDarija: `شنو العلاقة بين الأفكار المهمة فالنص؟`,
      options: [
        'They explain different aspects of the same topic',
        'They contradict each other',
        'They are completely unrelated'
      ],
      correct: 0,
      difficulty: 'medium'
    });
  }

  // Q4: Most important concept
  if (topWords.length > 2) {
    const important = topWords[0];
    const lessImportant1 = topWords[2];
    const lessImportant2 = topWords[4] || 'supporting detail';

    if (important && important !== lessImportant1 && important !== lessImportant2) {
      questions.push({
        id: 4,
        type: 'vocabulary',
        question: `Which concept appears most frequently in this text?`,
        questionDarija: `شنو الحاجة الللي تتكرر بزاف فالنص؟`,
        options: [important, lessImportant1, lessImportant2],
        correct: 0,
        difficulty: 'medium'
      });
    }
  }

  // Q5: Purpose/Theme
  questions.push({
    id: 5,
    type: 'comprehension',
    question: `What is the overall purpose of this text?`,
    questionDarija: `شنو القصد من هاد النص؟`,
    options: [
      'To explain and inform the reader about a topic',
      'To entertain without any educational value',
      'To confuse the reader intentionally'
    ],
    correct: 0,
    difficulty: 'medium'
  });

  return questions.filter(q => 
    q.options && q.options.length === 3 && q.options.every(o => o && o.length > 0)
  );
};

/**
 * Main quiz service export
 * Tries AI-first, falls back to extraction-based if AI unavailable
 */
export const quizService = {
  /**
   * Generate quiz from text
   * - First tries Gemini AI if API key available
   * - Falls back to extraction-based generation
   * Returns null if text is too short
   */
  generateFromText: async (text, useAI = true, apiKey = null) => {
    if (!text || text.length < 50) {
      console.warn('Text too short for quiz generation');
      return null;
    }

    // Try AI first if available
    if (useAI && apiKey) {
      console.log('Attempting AI-powered quiz generation...');
      const aiQuestions = await generateWithAI(text, apiKey);
      if (aiQuestions && aiQuestions.length >= 3) {
        console.log('✅ AI quiz generated successfully');
        return {
          title: 'Smart Quiz',
          desc: 'AI-generated comprehension questions',
          questionCount: aiQuestions.length,
          questions: aiQuestions
        };
      }
      console.warn('AI generation returned insufficient questions, falling back to basic');
    }

    // Fallback to basic extraction
    console.log('Using extraction-based quiz generation...');
    const questions = generateBasicQuestions(text);

    if (!questions || questions.length === 0) {
      console.warn('Could not generate basic questions');
      return null;
    }

    // Shuffle for variety
    const shuffled = questions
      .sort(() => Math.random() - 0.5)
      .map((q, idx) => ({ ...q, id: idx + 1 }));

    return {
      title: 'Comprehension Quiz',
      desc: 'Questions based on text content',
      questionCount: shuffled.length,
      questions: shuffled
    };
  },

  getQuizMetadata: (quiz) => {
    if (!quiz) return null;
    return {
      title: quiz.title,
      questionCount: quiz.questions.length,
      estimatedDuration: `${Math.ceil(quiz.questions.length * 1.5)} minutes`
    };
  }
};
