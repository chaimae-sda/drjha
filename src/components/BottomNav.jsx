import React from 'react';
import { BookOpen, ChevronLeft, Gamepad2, Home, ScanLine, User } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const BottomNav = ({ activeTab, onTabChange, isSubView, onBack }) => {
  const { t } = useI18n();
  const tabs = [
    { id: 'home', label: t('nav.home'), Icon: Home },
    { id: 'library', label: t('nav.library'), Icon: BookOpen },
    { id: 'scan', label: t('nav.scan'), Icon: ScanLine, isSpecial: true },
    { id: 'journey', label: t('nav.journey'), Icon: Gamepad2 },
    { id: 'profile', label: t('nav.profile'), Icon: User },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map(({ id, label, Icon, isSpecial }) => {
        const isActive = activeTab === id;

        if (isSpecial && isSubView) {
          return (
            <button
              key={id}
              type="button"
              className="bottom-nav__item is-special"
              onClick={onBack}
              aria-label={t('common.back')}
            >
              <span className="bottom-nav__icon">
                <ChevronLeft size={28} strokeWidth={2.4} />
              </span>
            </button>
          );
        }

        return (
          <button
            key={id}
            type="button"
            className={`bottom-nav__item ${isActive ? 'is-active' : ''} ${isSpecial ? 'is-special' : ''}`}
            onClick={() => onTabChange(id)}
          >
            <span className="bottom-nav__icon">
              <Icon size={isSpecial ? 24 : 20} strokeWidth={isActive || isSpecial ? 2.4 : 2} />
            </span>
            {!isSpecial && <span className="bottom-nav__label">{label}</span>}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
