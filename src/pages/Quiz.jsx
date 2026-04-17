import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../services/apiService';

const normalizeOptions = (options) =>
  options.map((option) => (typeof option === 'string' ? option : option.text));

const getQuestionText = (question, language) => {
  if (language === 'fr') return question?.questionTextFr || question?.questionTextDarija;
  if (language === 'en') return question?.questionTextEn || question?.questionTextFr || question?.questionTextDarija;
  return question?.questionTextDarija;
};

const getCorrectAnswer = (question, language) => {
  if (language === 'fr') return question?.correctAnswerFr || question?.correctAnswer;
  if (language === 'en') return question?.correctAnswerEn || question?.correctAnswerFr || question?.correctAnswer;
  return question?.correctAnswerDarija || question?.correctAnswer;
};

const getOptions = (question, language) => {
  if (language === 'fr') return question?.optionsFr || question?.options || [];
  if (language === 'en') return question?.optionsEn || question?.optionsFr || question?.options || [];
  return question?.optionsDarija || question?.options || [];
};

const Quiz = ({ textId, onBack, onComplete }) => {
  const { t, language } = useI18n();
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadQuestions = async () => {
      setLoading(true);
      setCurrentIndex(0);
      setSelectedOption(null);
      setShowFeedback(false);
      setScore(0);
      setCorrectAnswers(0);
      const data = await apiClient.getQuizQuestions(textId);
      setQuestions(Array.isArray(data) ? data : []);
      setLoading(false);
    };

    loadQuestions();
  }, [textId]);

  const currentQuestion = questions[currentIndex];
  const correctAnswer = useMemo(() => getCorrectAnswer(currentQuestion, language), [currentQuestion, language]);
  const options = useMemo(
    () => normalizeOptions(getOptions(currentQuestion, language)),
    [currentQuestion, language],
  );

  const handleSelect = (option) => {
    if (showFeedback) {
      return;
    }

    setSelectedOption(option);
    setShowFeedback(true);

    if (option === correctAnswer) {
      setScore((value) => value + (currentQuestion.xpReward || 20));
      setCorrectAnswers((value) => value + 1);
    }
  };

  const nextQuestion = async () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((value) => value + 1);
      setSelectedOption(null);
      setShowFeedback(false);
      return;
    }

    const xpEarned = Math.max(score, 20);
    await apiClient.addXP(xpEarned, {
      quizCompleted: true,
      correctAnswers,
      totalQuestions: questions.length,
    });
    if (onComplete) {
      onComplete();
    }
  };

  if (loading) {
    return <div className="page-feedback">{t('quiz.loading')}</div>;
  }

  if (!currentQuestion) {
    return <div className="page-feedback">{t('quiz.unavailable')}</div>;
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answerIsCorrect = selectedOption === correctAnswer;
  const isRtl = language === 'darija';

  return (
    <section className="quiz-screen">
      <header className="screen-header">
        <button type="button" className="icon-chip" onClick={onBack}>
          <ChevronLeft size={20} />
        </button>
        <h2>{t('quiz.title')}</h2>
        <button type="button" className="text-button" onClick={onBack}>
          {t('quiz.quit')}
        </button>
      </header>

      <div className="quiz-progress">
        <div className="quiz-progress__meta">
          <span>
            {t('quiz.question', { current: currentIndex + 1, total: questions.length })}
          </span>
          <strong>{score} XP</strong>
        </div>
        <div className="quiz-progress__track">
          <div className="quiz-progress__bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="quiz-body">
        <h3 className={isRtl ? 'text-darija' : ''}>{getQuestionText(currentQuestion, language)}</h3>

        <div className="quiz-options">
          {options.map((option) => {
            const isCorrect = option === correctAnswer;
            const isSelected = option === selectedOption;

            return (
              <button
                key={option}
                type="button"
                className={`quiz-option ${showFeedback && isCorrect ? 'is-correct' : ''} ${showFeedback && isSelected && !isCorrect ? 'is-wrong' : ''}`}
                onClick={() => handleSelect(option)}
              >
                <span className="quiz-option__dot">{showFeedback && isCorrect ? <CheckCircle2 size={16} /> : null}</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={`quiz-feedback ${showFeedback ? 'is-visible' : ''}`}>
        {showFeedback ? (
          <>
            <div className="quiz-feedback__emoji">{answerIsCorrect ? '🥳' : '💪'}</div>
            <div>
              <strong>{answerIsCorrect ? t('quiz.bravo') : t('quiz.keepGoing')}</strong>
              <p>
                {answerIsCorrect
                  ? t('quiz.xpEarned', { xp: currentQuestion.xpReward || 20 })
                  : t('quiz.wrongAnswer')}
              </p>
            </div>
            <button type="button" className="action-button action-button--primary" onClick={nextQuestion}>
              <span>{t('common.continue')}</span>
              <ArrowRight size={18} />
            </button>
          </>
        ) : (
          <p>{t('quiz.chooseAnswer')}</p>
        )}
      </div>
    </section>
  );
};

export default Quiz;
