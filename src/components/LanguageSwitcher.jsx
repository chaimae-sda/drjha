import React, { useState, useRef, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const LanguageSwitcher = ({ tone = 'light' }) => {
  const { t, language, setLanguage, languages } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  
  const chipClass = tone === 'dark' ? 'icon-chip icon-chip--dark' : 'icon-chip icon-chip--ghost';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => setIsOpen(!isOpen);
  const handleSelect = (code) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="language-menu language-menu--app" ref={menuRef}>
      <button 
        type="button"
        className={chipClass} 
        aria-label={t('home.chooseLanguage')} 
        title={t('home.chooseLanguage')}
        onClick={handleToggle}
      >
        <Globe size={18} />
      </button>
      
      {isOpen && (
        <div className="home-floating-panel home-floating-panel--language app-language-panel">
          <div className="home-panel__header">
            <strong>{t('home.language')}</strong>
          </div>
          <div className="language-menu__list">
            {languages.map((item) => (
              <button
                key={item.code}
                type="button"
                className={`language-menu__item ${language === item.code ? 'is-active' : ''}`}
                onClick={() => handleSelect(item.code)}
              >
                <span>{item.nativeLabel}</span>
                <small>{item.label}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
