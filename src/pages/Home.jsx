import React from 'react';
import { Bell, BookOpen, Camera, CheckCheck, FileUp, Globe, Moon, Sun } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const Home = ({
  onNavigate,
  onDirectImport,
  importingFile = false,
  notificationCount = 0,
  notifications = [],
  notificationPermission = 'default',
  onToggleNotifications,
  onMarkNotificationsRead,
  notificationsOpen = false,
  language,
}) => {
  const { t, setLanguage, languages } = useI18n();
  const { theme, toggleTheme } = useTheme();

  return (
    <section className="screen screen--home">
      <header className="phone-status-bar">
        <span className="home-header-spacer" />
        <div className="home-header-actions">
          <details className="language-menu">
            <summary className="icon-chip icon-chip--ghost" aria-label={t('home.chooseLanguage')}>
              <Globe size={18} />
            </summary>
            <div className="home-floating-panel home-floating-panel--language">
              <div className="home-panel__header">
                <strong>{t('home.language')}</strong>
              </div>
              <div className="language-menu__list">
                {languages.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    className={`language-menu__item ${language === item.code ? 'is-active' : ''}`}
                    onClick={() => setLanguage(item.code)}
                  >
                    <span>{item.nativeLabel}</span>
                    <small>{item.label}</small>
                  </button>
                ))}
              </div>
            </div>
          </details>

          <button
            type="button"
            className="icon-chip icon-chip--ghost"
            onClick={toggleTheme}
            aria-label={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
            title={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button type="button" className="icon-chip icon-chip--ghost home-bell" onClick={onToggleNotifications}>
            <Bell size={18} />
            {notificationCount > 0 && <span className="home-bell__badge">{notificationCount}</span>}
          </button>
        </div>
      </header>

      {notificationsOpen && (
        <div className="home-floating-panel home-floating-panel--notifications">
          <div className="home-panel__header">
            <strong>{t('home.notifications')}</strong>
            <button type="button" onClick={onMarkNotificationsRead}>
              <CheckCheck size={16} />
              <span>{t('home.markAllRead')}</span>
            </button>
          </div>
          <p className="home-panel__permission">
            {notificationPermission === 'granted' ? t('home.quizRemindersOn') : t('home.quizRemindersOff')}
          </p>
          <div className="home-panel__list">
            {notifications.length === 0 && <p className="home-panel__empty">{t('home.noNotifications')}</p>}
            {notifications.map((notification) => (
              <div key={notification.id} className={`home-notification ${notification.read ? '' : 'is-unread'}`}>
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="home-hero">
        <img src={assetUrl('drjha_logo.svg')} alt="Darija Knowledge AI" className="home-hero__logo home-hero__logo--blend" decoding="async" />
      </div>

      <div className="home-illustration-card">
        <div className="home-illustration-card__shape home-illustration-card__shape--left" />
        <div className="home-illustration-card__shape home-illustration-card__shape--right" />
        <img src={assetUrl('home_illustration.png')} alt="Apprentissage Darija" className="home-illustration-card__image" loading="lazy" decoding="async" />
      </div>

      <div className="stack-actions">
        <button
          type="button"
          className="action-button action-button--primary"
          onClick={onDirectImport}
          disabled={importingFile}
        >
          <FileUp size={18} />
          <span>{importingFile ? t('common.loading') : t('home.importFile')}</span>
        </button>
        <button type="button" className="action-button action-button--outline" onClick={() => onNavigate('scan')}>
          <Camera size={18} />
          <span>{t('home.scanText')}</span>
        </button>
        <button type="button" className="action-button action-button--soft" onClick={() => onNavigate('library')}>
          <BookOpen size={18} />
          <span>{t('home.offlineLibrary')}</span>
        </button>
      </div>
    </section>
  );
};

export default Home;
