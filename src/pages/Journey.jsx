import React, { useContext, useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, FileUp, MoreHorizontal, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../services/apiService';

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const XP_PER_LEVEL = 500;

const Journey = ({ onBack, onStartQuiz, onNavigate }) => {
  const { user } = useContext(AuthContext);
  const { t } = useI18n();
  const [journeyData, setJourneyData] = useState(null);
  const [texts, setTexts] = useState([]);
  const [showNoQuestionsPrompt, setShowNoQuestionsPrompt] = useState(false);
  const nodes = t('journey.nodes').map((label, index) => ({
    id: index + 1,
    label,
    top: ['12%', '24%', '34%', '44%', '54%', '63%', '72%', '82%'][index] ?? `${12 + index * 10}%`,
    left: ['48%', '24%', '56%', '24%', '56%', '24%', '56%', '48%'][index] ?? '48%',
  }));

  useEffect(() => {
    const loadData = async () => {
      const [progress, libraryTexts] = await Promise.all([apiClient.getJourneyProgress(), apiClient.getTexts()]);
      setJourneyData(progress);
      setTexts(Array.isArray(libraryTexts) ? libraryTexts : []);
    };

    loadData();
  }, [user?.xp]);

  const handleNodeClick = (levelId, isUnlocked) => {
    if (!isUnlocked || !onStartQuiz) {
      return;
    }

    if (texts.length === 0) {
      setShowNoQuestionsPrompt(true);
      return;
    }

    const completedTextIds = user?.stats?.completedTextIds || [];
    const allCompleted = texts.length > 0 && texts.every((text) => completedTextIds.includes(text._id));

    if (allCompleted) {
      setShowNoQuestionsPrompt(true);
      return;
    }

    const unquizzedTexts = texts.filter((text) => !completedTextIds.includes(text._id));
    const pool = unquizzedTexts.length > 0 ? unquizzedTexts : texts;
    const text = pool[(levelId - 1) % pool.length];
    onStartQuiz(text._id);
  };

  if (!journeyData) {
    return <div className="page-feedback">{t('journey.loading')}</div>;
  }

  const currentLevel = journeyData.currentLevel;
  const isMaxLevel = currentLevel >= nodes.length;
  const xpProgress = journeyData.xpProgress || 0;
  const progressPercent = isMaxLevel ? 100 : Math.min(100, (xpProgress / XP_PER_LEVEL) * 100);
  const xpToNext = isMaxLevel ? 0 : XP_PER_LEVEL - xpProgress;

  return (
    <section className="journey-screen">
      <header className="journey-screen__header">
        <button type="button" className="icon-chip icon-chip--dark" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>
        <h2>{t('journey.title')}</h2>
        <button type="button" className="icon-chip icon-chip--dark">
          <MoreHorizontal size={18} />
        </button>
      </header>

      <div className="journey-profile">
        <div className="journey-profile__user">
          <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'Chaimae'}`} alt={user?.username} />
          <div>
            <span>{t('journey.currentLevel')}</span>
            <strong>{journeyData.levelName || user?.levelName || t('journey.explorer')}</strong>
          </div>
        </div>
        <div className="journey-profile__xp">
          <span>{t('journey.xp')}</span>
          <strong>{user?.xp || 0}</strong>
        </div>
      </div>

      <div className="journey-xp-bar">
        <div className="journey-xp-bar__track">
          <div className="journey-xp-bar__fill" style={{ width: `${progressPercent}%` }} />
        </div>
        <span className="journey-xp-bar__label">
          {isMaxLevel
            ? t('journey.maxLevel')
            : t('journey.xpToNextLevel', { xp: xpToNext })}
        </span>
      </div>

      <div className="journey-map">
        <img src={assetUrl('journey_map.png')} alt={t('journey.mapAlt')} className="journey-map__image" />
        {nodes.map((node, index) => {
          const isComplete = index + 1 < currentLevel;
          const isCurrent = index + 1 === currentLevel;
          const isUnlocked = isComplete || isCurrent;

          return (
            <button
              key={node.id}
              type="button"
              className={`journey-node ${isComplete ? 'is-complete' : ''} ${isCurrent ? 'is-current' : ''} ${!isUnlocked ? 'is-locked' : ''}`}
              style={{ top: node.top, left: node.left }}
              onClick={() => handleNodeClick(node.id, isUnlocked)}
            >
              <span className="journey-node__bubble">{isUnlocked ? node.id : '🔒'}</span>
              <span className="journey-node__label">{node.label}</span>
            </button>
          );
        })}

        <div className="journey-treasure">🎁</div>
      </div>

      {showNoQuestionsPrompt && (
        <div className="journey-no-questions">
          <div className="journey-no-questions__card">
            <button
              type="button"
              className="journey-no-questions__close"
              onClick={() => setShowNoQuestionsPrompt(false)}
            >
              <X size={18} />
            </button>
            <div className="journey-no-questions__emoji">🎉</div>
            <strong>{t('journey.noQuestionsTitle')}</strong>
            <p>{t('journey.noQuestionsBody')}</p>
            <div className="journey-no-questions__actions">
              <button
                type="button"
                className="action-button action-button--primary"
                onClick={() => {
                  setShowNoQuestionsPrompt(false);
                  if (onNavigate) onNavigate('scan');
                }}
              >
                <FileUp size={16} />
                <span>{t('journey.addMoreDocs')}</span>
              </button>
              <button
                type="button"
                className="action-button action-button--outline"
                onClick={() => {
                  setShowNoQuestionsPrompt(false);
                  if (onNavigate) onNavigate('library');
                }}
              >
                <BookOpen size={16} />
                <span>{t('journey.goToLibrary')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Journey;

