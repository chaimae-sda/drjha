import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { quizService } from '../../src/services/quizService.js';
import Text from '../models/Text.js';
import Question from '../models/Question.js';
import User from '../models/User.js';
import { findUserById } from '../config/mockDb.js';

const router = express.Router();

/**
 * Generate or retrieve quiz questions for a text
 * If questions don't exist, generate them using quizService
 * Supports optional AI-powered generation when API key is provided
 */
router.get('/text/:textId', authenticateToken, async (req, res) => {
  try {
    const { textId } = req.params;
    const { useAI } = req.query; // Query param to enable AI generation

    // Try to fetch existing questions from DB
    let questions = await Question.find({ textId }).sort({ id: 1 });

    // If no questions exist, generate them
    if (!questions || questions.length === 0) {
      // Fetch the text from database
      const text = await Text.findById(textId);

      if (!text) {
        return res.status(404).json({ error: 'Text not found' });
      }

      // Get API key from environment - enable AI by default
      const apiKey = process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
      const useAI = apiKey ? true : false; // Automatically use AI if key available

      // Use quizService to generate questions from the text
      const generatedQuiz = await quizService.generateFromText(
        text.originalText,
        useAI,
        apiKey
      );

      if (!generatedQuiz) {
        return res.status(400).json({ 
          error: 'Could not generate quiz - text too short or unsuitable' 
        });
      }

      // Save generated questions to database
      const questionsToSave = generatedQuiz.questions.map(q => ({
        textId,
        questionText: q.question,
        questionTextDarija: q.questionDarija || '',
        correctAnswer: q.options[q.correct],
        options: q.options.map(opt => ({ text: opt, isDarija: false })),
        difficulty: q.difficulty || 'medium',
        type: q.type || 'comprehension',
        xpReward: q.difficulty === 'hard' ? 50 : q.difficulty === 'medium' ? 30 : 10
      }));

      questions = await Question.insertMany(questionsToSave);
    }

    // Format response
    const formattedQuestions = questions.map((q, idx) => ({
      _id: q._id,
      id: idx + 1,
      textId: q.textId,
      questionText: q.questionText,
      questionTextDarija: q.questionTextDarija,
      options: q.options.map(opt => opt.text),
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty || 'medium',
      type: q.type || 'comprehension',
      xpReward: q.xpReward || 10
    }));

    res.json({
      questionCount: formattedQuestions.length,
      questions: formattedQuestions
    });
  } catch (error) {
    console.error('Quiz retrieval error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Submit quiz answer and calculate XP rewards
 */
router.post('/submit', authenticateToken, async (req, res) => {
  try {
    const { questionId, userAnswer, textId } = req.body;

    // Fetch the question from database
    const question = await Question.findById(questionId);

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Check if answer is correct (case-insensitive, trim whitespace)
    const normalizeAnswer = (str) => str.toLowerCase().trim();
    const isCorrect = normalizeAnswer(userAnswer) === normalizeAnswer(question.correctAnswer);

    // Calculate XP reward
    const baseXp = question.xpReward || 10;
    const xpEarned = isCorrect ? baseXp : 0;

    // Update user stats
    let user = await User.findById(req.user.id);
    
    if (user) {
      user.xp = (user.xp || 0) + xpEarned;
      user.stats = user.stats || {};
      user.stats.quizzesPassed = (user.stats.quizzesPassed || 0) + (isCorrect ? 1 : 0);
      user.stats.totalAttempts = (user.stats.totalAttempts || 0) + 1;

      // Calculate level based on XP
      const newLevel = Math.floor(user.xp / 1000) + 1;
      user.level = newLevel;

      await user.save();
    }

    // Also update mock DB for consistency
    const mockUser = findUserById(req.user.id);
    if (mockUser) {
      mockUser.xp += xpEarned;
      mockUser.stats.quizzesPassed += 1;
      mockUser.level = Math.floor(mockUser.xp / 1000) + 1;
    }

    const successMessage = isCorrect 
      ? `✅ Correct! +${xpEarned} XP` 
      : `❌ Incorrect. The correct answer is: ${question.correctAnswer}`;

    res.json({
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || '',
      xpEarned,
      totalXp: user?.xp || 0,
      level: user?.level || 1,
      message: successMessage
    });
  } catch (error) {
    console.error('Quiz submission error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get quiz statistics for a text
 */
router.get('/stats/:textId', authenticateToken, async (req, res) => {
  try {
    const { textId } = req.params;

    const questions = await Question.find({ textId });
    const questionCount = questions.length;
    const averageDifficulty = questions.length > 0
      ? calculateAverageDifficulty(questions)
      : 'medium';

    res.json({
      textId,
      questionCount,
      averageDifficulty,
      estimatedTime: Math.ceil(questionCount * 1.5) + ' minutes'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Regenerate quiz with AI (deletes old questions and creates new ones)
 * Useful if user wants better questions
 */
router.post('/regenerate/:textId', authenticateToken, async (req, res) => {
  try {
    const { textId } = req.params;
    const { useAI = true } = req.body;

    // Delete existing questions
    await Question.deleteMany({ textId });

    // Fetch the text
    const text = await Text.findById(textId);
    if (!text) {
      return res.status(404).json({ error: 'Text not found' });
    }

    // Generate new questions
    const apiKey = process.env.VITE_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    const generatedQuiz = await quizService.generateFromText(
      text.originalText,
      apiKey ? true : false, // Use AI if available
      apiKey
    );

    if (!generatedQuiz) {
      return res.status(400).json({ 
        error: 'Could not regenerate quiz' 
      });
    }

    // Save new questions
    const questionsToSave = generatedQuiz.questions.map(q => ({
      textId,
      questionText: q.question,
      questionTextDarija: q.questionDarija || '',
      correctAnswer: q.options[q.correct],
      options: q.options.map(opt => ({ text: opt, isDarija: false })),
      difficulty: q.difficulty || 'medium',
      type: q.type || 'comprehension',
      xpReward: q.difficulty === 'hard' ? 50 : q.difficulty === 'medium' ? 30 : 10
    }));

    const newQuestions = await Question.insertMany(questionsToSave);

    res.json({
      success: true,
      message: 'Quiz regenerated successfully',
      questionCount: newQuestions.length,
      usedAI: useAI && !!apiKey
    });
  } catch (error) {
    console.error('Quiz regeneration error:', error);
    res.status(500).json({ error: error.message });
  }
});

const calculateAverageDifficulty = (questions) => {
  const levels = { easy: 1, medium: 2, hard: 3 };
  const avg = questions.reduce((sum, q) => sum + (levels[q.difficulty] || 2), 0) / questions.length;
  if (avg < 1.5) return 'easy';
  if (avg < 2.5) return 'medium';
  return 'hard';
};

export default router;

