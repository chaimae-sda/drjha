import React, { Suspense, lazy, useContext, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import Auth from './pages/Auth';
import BottomNav from './components/BottomNav';
import { AuthContext, AuthProvider } from './context/AuthContext';
import { useI18n } from './context/I18nContext';
import { importDocument } from './services/documentImportService';

const Home = lazy(() => import('./pages/Home'));
const Journey = lazy(() => import('./pages/Journey'));
const Library = lazy(() => import('./pages/Library'));
const Profile = lazy(() => import('./pages/Profile'));
const Quiz = lazy(() => import('./pages/Quiz'));
const Reading = lazy(() => import('./pages/Reading'));
const Scan = lazy(() => import('./pages/Scan'));

const NOTIFICATIONS_KEY = 'darija.notifications';

const readNotifications = () => {
  try {
    const saved = localStorage.getItem(NOTIFICATIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const persistNotifications = (notifications) => {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
};

const AppContent = () => {
  const { user, loading } = useContext(AuthContext);
  const { t, language } = useI18n();
  const [activeTab, setActiveTab] = useState('home');
  const [currentView, setCurrentView] = useState({ type: 'tab', id: 'home' });
  const [notifications, setNotifications] = useState(() => readNotifications());
  const [notificationPermission, setNotificationPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default',
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    persistNotifications(notifications);
  }, [notifications]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const addNotification = (title, body) => {
    setNotifications((current) => [
      {
        id: `notif_${Date.now()}`,
        title,
        body,
        read: false,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
  };

  const scheduleQuizReminder = (textTitle) => {
    const reminderBody = t('notifications.quizReminderBody', { title: textTitle });

    window.setTimeout(() => {
      addNotification(t('notifications.quizReminderTitle'), reminderBody);

      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(t('notifications.quizReminderTitle'), { body: reminderBody });
        notification.onclick = () => window.focus();
      }
    }, 45000);
  };

  const toggleNotifications = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } else if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    setNotificationsOpen((value) => !value);
  };

  const markNotificationsRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const navigateToTab = (tabId) => {
    setActiveTab(tabId);
    setCurrentView({ type: 'tab', id: tabId });
    setNotificationsOpen(false);
  };

  const navigateToReading = (textId) => {
    setCurrentView({ type: 'reading', id: textId });
  };

  const navigateToQuiz = (textId) => {
    setCurrentView({ type: 'quiz', id: textId });
  };

  const handleBack = () => {
    if (currentView.type === 'reading') {
      navigateToTab('library');
      return;
    }

    if (currentView.type === 'quiz') {
      setCurrentView({ type: 'reading', id: currentView.id });
      return;
    }

    navigateToTab('home');
  };

  const handleTextScanned = (savedText) => {
    if (savedText?._id) {
      const questionCount = savedText.generatedQuestions?.length || 0;
      addNotification(
        t('notifications.documentReadyTitle'),
        `${t('notifications.documentReadyBody', { title: savedText.title })}${questionCount ? ` ${questionCount} questions sont prêtes.` : ''}`,
      );
      scheduleQuizReminder(savedText.title);
      navigateToReading(savedText._id);
      return;
    }

    navigateToTab('library');
  };

  const handleDirectImport = () => {
    fileInputRef.current?.click();
  };

  const handleHomeFileUpload = async ({ target }) => {
    const file = target.files?.[0];
    if (!file) {
      return;
    }

    setImportingFile(true);

    try {
      const savedText = await importDocument(file);
      handleTextScanned(savedText);
    } catch (error) {
      alert(t('scan.scanError', { message: error.message }));
    } finally {
      setImportingFile(false);
      target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="app-loader">
        <div className="app-loader__card">
          <div className="app-loader__badge">{t('appName')}</div>
          <strong>{t('common.loadingSpace')}</strong>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const renderCurrentView = () => {
    if (currentView.type === 'reading') {
      return (
        <Reading textId={currentView.id} onBack={handleBack} onStartQuiz={() => navigateToQuiz(currentView.id)} />
      );
    }

    if (currentView.type === 'quiz') {
      return <Quiz textId={currentView.id} onBack={handleBack} onComplete={() => navigateToTab('journey')} />;
    }

    switch (activeTab) {
      case 'home':
        return (
          <Home
            onNavigate={navigateToTab}
            onDirectImport={handleDirectImport}
            importingFile={importingFile}
            notificationCount={unreadNotifications}
            notifications={notifications}
            notificationPermission={notificationPermission}
            onToggleNotifications={toggleNotifications}
            onMarkNotificationsRead={markNotificationsRead}
            notificationsOpen={notificationsOpen}
            language={language}
          />
        );
      case 'library':
        return <Library onSelectText={navigateToReading} />;
      case 'scan':
        return <Scan onBack={() => navigateToTab('home')} onTextScanned={handleTextScanned} />;
      case 'journey':
        return <Journey onBack={() => navigateToTab('home')} onStartQuiz={navigateToQuiz} onNavigate={navigateToTab} />;
      case 'profile':
        return <Profile />;
      default:
        return <Home onNavigate={navigateToTab} />;
    }
  };

  return (
    <div className="app-shell">
      <div className="app-phone-frame">
        <main className="app-screen with-nav">
          <Suspense
            fallback={
              <div className="page-feedback">
                {t('common.loading')}
              </div>
            }
          >
            {renderCurrentView()}
          </Suspense>
        </main>
        <BottomNav activeTab={activeTab} onTabChange={navigateToTab} />
        <input ref={fileInputRef} type="file" hidden accept="image/*,.pdf" onChange={handleHomeFileUpload} />
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
