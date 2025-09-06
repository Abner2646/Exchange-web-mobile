import React from 'react';
import { useThemeContext } from '../context/ThemeContext';
import './ThemeToggle.css';

/**
 * Button component to switch between light and dark theme
 * @param {Object} props - Component Props
 * @param {string} props.position - Button position ('fixed' by default)
 * @param {string} props.className - Additional CSS Classes
 */
const ThemeToggle = ({ 
  position = 'fixed', 
  className = '',
  ...props 
}) => {
  const { theme, isDark, toggleTheme } = useThemeContext();

  const handleClick = () => {
    toggleTheme();
  };

  return (
    <button
      className={`theme-toggle ${position === 'fixed' ? 'theme-toggle--fixed' : ''} ${className}`}
      onClick={handleClick}
      aria-label={`Switch to theme ${isDark ? 'light' : 'dark'}`}
      title={`Change to theme ${isDark ? 'light' : 'dark'}`}
      {...props}
    >
      <span className="theme-toggle__icon">
        {isDark ? '☀️' : '🌙'}
      </span>
    </button>
  );
};

export default ThemeToggle;