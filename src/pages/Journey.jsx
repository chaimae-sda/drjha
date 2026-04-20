import React, { useContext, useEffect, useState } from 'react';
import { BookOpen, ChevronLeft, FileUp, MoreHorizontal, X } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../services/apiService';

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

/**
 * 🎯 FINAL visually-correct positions (aligned to road)
 */
const PATH_POINTS = [
  { top: '84%', left: '50%' }, // Découverte
  { top: '70%', left: '28%' }, // Apprenti
  { top: '54%', left: '62%' }, // Curieux
  { top: '38%', left: '36%' }, // Savant
  { top: '24%', left: '50%' }, // Maître
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
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 420,
          margin: '0 auto',
          aspectRatio: '454 / 600',
        }}
      >
        <img
          src={assetUrl('journey_map.png')}
          alt="map"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
          }}
        />

        {visibleNodes.map((node) => (
          <button
            key={node.id}
            onClick={() => handleNodeClick(node.id, node.isUnlocked)}
            style={{
              position: 'absolute',
              top: node.top,
              left: node.left,
              transform: 'translate(-50%, -60%)', // 🔥 key fix
              background: 'transparent',
              border: 'none',
              textAlign: 'center',
              cursor: node.isUnlocked ? 'pointer' : 'default',
            }}
          >
            {/* NODE */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: node.isCurrent
                  ? '#6C4DFF'
                  : node.isUnlocked
                    ? 'rgba(255,255,255,0.95)'
                    : 'rgba(200,200,200,0.6)',
                border: '3px solid white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '600',
                boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
              }}
            >
              {node.isUnlocked ? node.id : '🔒'}
            </div>

            {/* LABEL */}
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                background: 'white',
                padding: '4px 10px',
                borderRadius: 20,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap',
              }}
            >
              {node.label}
            </div>
          </button>
        ))}

        {/* TREASURE */}
        <div
          style={{
            position: 'absolute',
            top: '24%',
            left: '78%',
            transform: 'translate(-50%, -50%)',
            fontSize: 22,
          }}
        >
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