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

IMPORTANT:
- NEVER use generic phrases like "ce texte", "ce document", "this text", "this document"
- ALWAYS reference the actual content with specific details from the text
- Ask about SPECIFIC facts, events, people, dates, or ideas mentioned in the text
- Make questions RELEVANT and SPECIFIC, not generic

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
- Distractors should be plausible false answers, relevant to the text, but not absurd
- Use simple language suitable for learners
- Questions must be of medium difficulty: not too easy, and not too difficult.
- Questions must be SPECIFIC to the document content (mention key facts, not generic references)
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

    // Only use AI for quiz generation
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
      console.warn('AI generation returned insufficient questions. No fallback.');
    }

    // No fallback, return null if AI fails
    return null;
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
