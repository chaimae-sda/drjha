import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <div className={`theme-toggle__track ${theme}`}>
        <div className="theme-toggle__thumb">
          {theme === 'light' ? (
            <Sun size={14} fill="currentColor" />
          ) : (
            <Moon size={14} fill="currentColor" />
          )}
        </div>
      </div>
    </button>
  );
};

export default ThemeToggle;
