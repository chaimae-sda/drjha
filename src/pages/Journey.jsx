import React, { useContext, useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  FileUp,
  Lock,
  MoreHorizontal,
  X,
} from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../services/apiService';

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const PATH_POINTS = [
  { top: '91%', left: '50%' }, // Découverte
  { top: '75%', left: '25%' }, // Apprenti
  { top: '58%', left: '60%' }, // Curieux
  { top: '41%', left: '34%' }, // Savant
  { top: '27%', left: '50%' }, // Maître
];

const XP_PER_LEVEL = 500;

const Journey = ({ onBack, onStartQuiz, onNavigate }) => {
  const { user } = useContext(AuthContext);
  const { t } = useI18n();

  const [journeyData, setJourneyData] = useState(null);
  const [texts, setTexts] = useState([]);
  const [showNoQuestionsPrompt, setShowNoQuestionsPrompt] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const [progress, libraryTexts] = await Promise.all([
        apiClient.getJourneyProgress(),
        apiClient.getTexts(),
      ]);
      setJourneyData(progress);
      setTexts(Array.isArray(libraryTexts) ? libraryTexts : []);
    };
    loadData();
  }, [user?.xp]);

  const handleNodeClick = (levelId, isUnlocked) => {
    if (!isUnlocked || !onStartQuiz) return;

    if (texts.length === 0) {
      setShowNoQuestionsPrompt(true);
      return;
    }

    const completedTextIds = user?.stats?.completedTextIds || [];

    const unquizzedTexts = texts.filter(
      (text) => !completedTextIds.includes(text._id)
    );

    const pool = unquizzedTexts.length > 0 ? unquizzedTexts : texts;
    const text = pool[(levelId - 1) % pool.length];

    onStartQuiz(text._id);
  };

  if (!journeyData) {
    return <div className="page-feedback">{t('journey.loading')}</div>;
  }

  const nodeLabels = t('journey.nodes');
  const currentLevel = journeyData.currentLevel || 1;
  const firstVisibleLevel = Math.max(1, currentLevel - 2);

  const visibleNodes = PATH_POINTS.map((point, index) => {
    const absoluteLevel = firstVisibleLevel + index;
    const label = nodeLabels[(absoluteLevel - 1) % nodeLabels.length];

    return {
      ...point,
      id: absoluteLevel,
      label,
      isComplete: absoluteLevel < currentLevel,
      isCurrent: absoluteLevel === currentLevel,
      isUnlocked: absoluteLevel <= currentLevel,
    };
  });

  const levelProgress = Math.min(
    ((journeyData.xpProgress || 0) / XP_PER_LEVEL) * 100,
    100
  );

  const xpToNextLevel = Math.max(
    0,
    (journeyData.nextLevelXp || currentLevel * XP_PER_LEVEL) -
    (user?.xp || 0)
  );

  return (
    <section className="journey-screen">
      {/* HEADER */}
      <header className="journey-screen__header">
        <button className="icon-chip icon-chip--dark" onClick={onBack}>
          <ChevronLeft size={18} />
        </button>

        <h2>{t('journey.title')}</h2>

        <button className="icon-chip icon-chip--dark">
          <MoreHorizontal size={18} />
        </button>
      </header>

      {/* PROFILE */}
      <div className="journey-profile">
        <div className="journey-profile__user">
          <img
            src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${user?.username || 'Chaimae'
              }`}
            alt={user?.username}
          />
          <div>
            <span>{t('journey.currentLevel')}</span>
            <strong>
              {journeyData.levelName ||
                user?.levelName ||
                t('journey.explorer')}
            </strong>
          </div>
        </div>

        <div className="journey-profile__xp">
          <span>{t('journey.xp')}</span>
          <strong>{user?.xp || 0}</strong>
        </div>
      </div>

      {/* XP BAR */}
      <div className="journey-progress-card">
        <div className="journey-progress-card__track">
          <span
            className="journey-progress-card__fill"
            style={{ width: `${levelProgress}%` }}
          />
        </div>
        <div className="journey-progress-card__meta">
          <strong>
            {t('journey.currentLevel')} {currentLevel}
          </strong>
          <span>{xpToNextLevel} XP pour la suite</span>
        </div>
      </div>

      {/* MAP */}
      <div className="journey-map">
        <img
          src={assetUrl('journey_map.svg')}
          alt="map"
          className="journey-map__image"
        />

        {visibleNodes.map((node) => (
          <button
            key={node.id}
            onClick={() => handleNodeClick(node.id, node.isUnlocked)}
            className={`journey-node ${node.isComplete ? 'is-complete' : ''} ${node.isCurrent ? 'is-current' : ''
              } ${!node.isUnlocked ? 'is-locked' : ''}`}
            style={{ top: node.top, left: node.left }}
            aria-label={`${node.label} - niveau ${node.id}`}
          >
            <div className="journey-node__bubble">
              {!node.isUnlocked ? (
                <Lock size={16} />
              ) : node.isComplete ? (
                <Check size={18} />
              ) : (
                node.id
              )}
            </div>

            <div className="journey-node__label">{node.label}</div>
          </button>
        ))}

        <div className="journey-treasure" aria-hidden="true">
          ✨
        </div>
      </div>

      {/* POPUP */}
      {showNoQuestionsPrompt && (
        <div className="journey-no-questions">
          <div className="journey-no-questions__card">
            <button
              onClick={() => setShowNoQuestionsPrompt(false)}
            >
              <X size={18} />
            </button>

            <div>🎉</div>

            <strong>{t('journey.noQuestionsTitle')}</strong>
            <p>{t('journey.noQuestionsBody')}</p>

            <button
              onClick={() => {
                setShowNoQuestionsPrompt(false);
                onNavigate?.('scan');
              }}
            >
              <FileUp size={16} /> {t('journey.addMoreDocs')}
            </button>

            <button
              onClick={() => {
                setShowNoQuestionsPrompt(false);
                onNavigate?.('library');
              }}
            >
              <BookOpen size={16} /> {t('journey.goToLibrary')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default Journey;
