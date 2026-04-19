import React, { useContext, useState } from 'react';
import { Eye, EyeOff, Globe, Lock, Mail, Moon, Sparkles, Sun, User } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import './Auth.css';

const initialState = {
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path}`;

const Auth = () => {
  const { login, loginDemo, register } = useContext(AuthContext);
  const { t, language, setLanguage, languages } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState(initialState);

  const handleChange = ({ target }) => {
    setFormData((current) => ({ ...current, [target.name]: target.value }));
  };

  const resetForm = () => {
    setFormData(initialState);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error(t('auth.passwordMismatch'));
        }

        await register(formData.username, formData.email, formData.password);
      }
    } catch (err) {
      setError(err.message || t('auth.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAccess = async () => {
    setFormData((current) => ({
      ...current,
      email: 'test@example.com',
      password: 'password',
    }));
    setLoading(true);
    setError('');

    try {
      await loginDemo();
    } catch (err) {
      setError(err.message || t('auth.demoError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-phone">
        <section className="auth-showcase">
          <div className="auth-showcase__topbar">
            <div className="auth-showcase__badge">
              <Sparkles size={16} />
              <span>{t('auth.showcaseBadge')}</span>
            </div>
            <div className="auth-showcase__controls">
              <details className="auth-language-menu">
                <summary className="auth-language-menu__trigger" aria-label={t('home.chooseLanguage')}>
                  <Globe size={16} />
                </summary>
                <div className="auth-language-menu__panel">
                  {languages.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      className={`auth-language-menu__item ${language === item.code ? 'is-active' : ''}`}
                      onClick={() => setLanguage(item.code)}
                    >
                      <span>{item.nativeLabel}</span>
                      <small>{item.label}</small>
                    </button>
                  ))}
                </div>
              </details>
              <button
                type="button"
                className="auth-theme-toggle"
                onClick={toggleTheme}
                aria-label={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
                title={t(theme === 'dark' ? 'theme.light' : 'theme.dark')}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                <span>{t(theme === 'dark' ? 'theme.light' : 'theme.dark')}</span>
              </button>
            </div>
          </div>
          <img src={assetUrl('drjha_logo.svg')} alt="Darija Knowledge AI" className="auth-showcase__logo" decoding="async" />
          <h1>دارجة</h1>
          <p className="auth-showcase__brand">Knowledge AI</p>
          <p className="auth-showcase__text">
            {t('auth.showcaseText')}
          </p>
          <img src={assetUrl('home_illustration.png')} alt="Illustration app" className="auth-showcase__image" loading="lazy" decoding="async" />
        </section>

        <section className="auth-card">
          <div className="auth-card__header">
            <p className="eyebrow">{isLogin ? t('auth.loginEyebrow') : t('auth.registerEyebrow')}</p>
            <h2>{isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}</h2>
            <p className="auth-card__subtext">
              {isLogin
                ? t('auth.loginSubtext')
                : t('auth.registerSubtext')}
            </p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <label className="field">
                <span>{t('auth.name')}</span>
                <div className="field__control">
                  <User size={18} />
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    placeholder={t('auth.namePlaceholder')}
                    required={!isLogin}
                  />
                </div>
              </label>
            )}

            <label className="field">
              <span>{t('auth.email')}</span>
              <div className="field__control">
                <Mail size={18} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="test@example.com"
                  required
                />
              </div>
            </label>

            <label className="field">
              <span>{t('auth.password')}</span>
              <div className="field__control">
                <Lock size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="password"
                  required
                />
                <button type="button" className="field__toggle" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {!isLogin && (
              <label className="field">
                <span>{t('auth.confirmPassword')}</span>
                <div className="field__control">
                  <Lock size={18} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    required={!isLogin}
                  />
                  <button type="button" className="field__toggle" onClick={() => setShowConfirmPassword((value) => !value)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? t('common.loading') : isLogin ? t('auth.login') : t('auth.register')}
            </button>
          </form>

          <button type="button" className="auth-demo" onClick={handleDemoAccess} disabled={loading}>
            {t('auth.demo')}
            <span>test@example.com / password</span>
          </button>

          <p className="auth-switch">
            {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
            <button
              type="button"
              onClick={() => {
                setIsLogin((value) => !value);
                resetForm();
              }}
            >
              {isLogin ? t('auth.register') : t('auth.login')}
            </button>
          </p>
        </section>
      </div>
    </div>
  );
};

export default Auth;
