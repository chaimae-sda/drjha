import React, { useRef, useEffect } from 'react';
import { Bell, BookOpen, Camera, CheckCheck, FileUp, Moon, Sun } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';
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
}) => {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const notificationsRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        // Only close if we are not clicking the bell button itself (which handles its own toggle)
        if (!event.target.closest('.home-bell')) {
          onToggleNotifications();
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen, onToggleNotifications]);

  return (
    <section className="screen screen--home">
      <header className="phone-status-bar">
        <span className="home-header-spacer" />
        <div className="home-header-actions">
          <LanguageSwitcher />

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
        <div className="home-floating-panel home-floating-panel--notifications" ref={notificationsRef}>
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
              <div
                key={notification.id}
                className={`home-notification ${notification.read ? '' : 'is-unread'} is-clickable`}
                role="button"
                tabIndex={0}
                onClick={() => { onMarkNotificationsRead(); onNavigate('library'); }}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onMarkNotificationsRead(); onNavigate('library'); } }}
              >
                <strong>{notification.title}</strong>
                <p>{notification.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="home-hero">
        <img src={assetUrl('logo-violet.png')} alt="Darija Knowledge AI" className="home-hero__logo" decoding="async" />
        <p className="home-hero__brand">DRJHA</p>
      </div>

      <div className="home-illustration-box">
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
