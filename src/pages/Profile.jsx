import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Camera, Clock3, LogOut, Shield, Sparkles, Star, Trophy, TrendingUp, Settings } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import { AuthContext } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiClient } from '../services/apiService';
import { useTheme } from '../context/ThemeContext';

const ALL_BADGES = [
  { id: 'first_scan', name: 'Premier pas', icon: 'star', color: '#f59e0b', hint: 'Scanner ou importer un premier document.' },
  { id: 'ten_pages', name: '10 pages', icon: 'book', color: '#3b82f6', hint: 'Lire au moins 10 pages de contenu.' },
  { id: 'quiz_master', name: 'Quiz master', icon: 'shield', color: '#ef4444', hint: 'Réussir plusieurs quiz sans faute.' },
  { id: 'regular', name: 'Régulier', icon: 'sparkle', color: '#facc15', hint: 'Revenir plusieurs jours de suite.' },
  { id: 'night_reader', name: 'Lecteur du soir', icon: 'star', color: '#8b5cf6', hint: 'Écouter une lecture audio en soirée.' },
  { id: 'collector', name: 'Collectionneur', icon: 'book', color: '#14b8a6', hint: 'Sauvegarder plusieurs imports dans la bibliothèque.' },
];

const badgeIcons = {
  star: Star,
  book: BookOpen,
  shield: Shield,
  sparkle: Sparkles,
};

// Format time nicely
const formatTime = (minutes) => {
  if (!minutes) return '0 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m > 0 ? `${m}min` : ''}`;
  return `${m} min`;
};

const Profile = () => {
  const { logout, setUser, user } = useContext(AuthContext);
  const { t } = useI18n();
  const [userData, setUserData] = useState(null);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setUserData(user);
      return;
    }

    const loadProfile = async () => {
      const data = await apiClient.getProfile();
      setUserData(data.user);
    };

    loadProfile();
  }, [user]);

  const badgeMap = useMemo(
    () => new Map((userData?.badges || []).map((badge) => [badge.id, badge])),
    [userData],
  );

  const mergedBadges = useMemo(
    () =>
      ALL_BADGES.map((badge) => ({
        ...badge,
        name: t(`profile.badgeNames.${badge.id}`),
        hint: t(`profile.badgeHints.${badge.id}`),
        unlocked: badgeMap.has(badge.id),
        ...badgeMap.get(badge.id),
      })),
    [badgeMap, t],
  );

  const handleAvatarChange = async ({ target }) => {
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const avatarImage = reader.result;
      const response = await apiClient.updateProfile({ avatarImage });
      if (response.user) {
        setUserData(response.user);
        setUser(response.user);
      }
      target.value = '';
    };
    reader.readAsDataURL(file);
  };

  if (!userData) {
    return <div className="page-feedback">{t('profile.loading')}</div>;
  }

  const visibleBadges = showAllBadges ? mergedBadges : mergedBadges.slice(0, 4);

  // Stats data - show real data from userData
  const stats = userData.stats || {};
  const readingTimeMinutes = stats.readingTime || 0;
  const quizzesPassed = stats.quizzesPassed || 0;
  const bestStreak = stats.bestStreak || 0;
  const docsImported = stats.docsImported || userData.booksRead || 0;

  // XP progress bar
  const xpForCurrentLevel = ((userData.level || 1) - 1) * 500;
  const xpForNextLevel = (userData.level || 1) * 500;
  const xpProgress = Math.min(((userData.xp || 0) - xpForCurrentLevel) / (xpForNextLevel - xpForNextLevel) * 100, 100);

  return (
    <section className="screen screen--profile">
      <header className="screen-header">
        <div>
          <p className="eyebrow">{t('profile.eyebrow')}</p>
        </div>
        <div className="header-action-group">
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </header>

      <div className="profile-hero profile-hero--editable">
        <div className="profile-avatar-wrap">
          <img
            src={userData.avatarImage || `https://api.dicebear.com/7.x/adventurer/svg?seed=${userData.username}`}
            alt={userData.username}
          />
          <button type="button" className="profile-avatar-edit" onClick={() => fileInputRef.current?.click()}>
            <Camera size={16} />
          </button>
          <input ref={fileInputRef} hidden type="file" accept="image/*" onChange={handleAvatarChange} />
        </div>
        <div>
          <h3>{userData.username}</h3>
          <p>{userData.levelName || t('profile.explorer')}</p>
          <span>{t('profile.level', { level: userData.level || 1 })}</span>
        </div>
      </div>

      {/* XP Progress bar */}
      <div className="profile-xp-bar-card">
        <div className="profile-xp-bar-card__header">
          <span><TrendingUp size={14} /> XP</span>
          <strong>{userData.xp || 0} XP</strong>
        </div>
        <div className="profile-xp-bar-card__track">
          <div
            className="profile-xp-bar-card__fill"
            style={{ width: `${Math.max(xpProgress, 2)}%` }}
          />
        </div>
        <div className="profile-xp-bar-card__meta">
          <span>Niveau {userData.level || 1}</span>
          <span>{Math.max(0, xpForNextLevel - (userData.xp || 0))} XP pour le niveau suivant</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <Trophy size={22} />
          <strong>{userData.xp || 0}</strong>
          <span>{t('profile.totalXp')}</span>
        </div>
        <div className="stat-card">
          <BookOpen size={22} />
          <strong>{docsImported}</strong>
          <span>{t('profile.booksRead')}</span>
        </div>
      </div>

      <div className="section-head">
        <h3>{t('profile.badges')}</h3>
        <button type="button" className="section-link" onClick={() => setShowAllBadges((value) => !value)}>
          {showAllBadges ? t('profile.showLess') : t('profile.showAll')}
        </button>
      </div>

      <div className="badge-row badge-row--expanded">
        {visibleBadges.map((badge) => {
          const Icon = badgeIcons[badge.icon] || Star;
          return (
            <div key={badge.id} className={`badge-card ${badge.unlocked ? '' : 'is-locked'}`}>
              <span className="badge-card__icon" style={{ color: badge.unlocked ? badge.color : '#c7c1e5' }}>
                <Icon size={18} fill="currentColor" />
              </span>
              <strong>{badge.name}</strong>
              <small>{badge.unlocked ? t('profile.unlocked') : badge.hint}</small>
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <h3>{t('profile.stats')}</h3>
      </div>

      <div className="profile-stats-grid">
        <div className="profile-stat-item">
          <div className="profile-stat-item__icon">
            <Clock3 size={18} />
          </div>
          <div className="profile-stat-item__content">
            <span>{t('profile.readingTime')}</span>
            <strong>{formatTime(readingTimeMinutes)}</strong>
          </div>
        </div>
        <div className="profile-stat-item">
          <div className="profile-stat-item__icon profile-stat-item__icon--green">
            <Sparkles size={18} />
          </div>
          <div className="profile-stat-item__content">
            <span>{t('profile.quizzesPassed')}</span>
            <strong>{quizzesPassed}</strong>
          </div>
        </div>
        <div className="profile-stat-item">
          <div className="profile-stat-item__icon profile-stat-item__icon--orange">
            <Star size={18} />
          </div>
          <div className="profile-stat-item__content">
            <span>{t('profile.bestStreak')}</span>
            <strong>{bestStreak} {t('profile.days')}</strong>
          </div>
        </div>
        <div className="profile-stat-item">
          <div className="profile-stat-item__icon profile-stat-item__icon--blue">
            <BookOpen size={18} />
          </div>
          <div className="profile-stat-item__content">
            <span>Documents importés</span>
            <strong>{docsImported}</strong>
          </div>
        </div>
      </div>

      <button type="button" className="logout-button" onClick={logout}>
        <LogOut size={18} />
        <span>{t('profile.logout')}</span>
      </button>
    </section>
  );
};

export default Profile;
