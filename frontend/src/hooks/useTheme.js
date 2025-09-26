// src/hooks/useTheme.js
/*
import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

export { useTheme } from '../context/ThemeContext';

// Hook adicional para obtener solo el modo del tema
export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider');
  }
  return {
    mode: context.themeMode,
    setMode: context.setThemeMode,
    toggle: context.toggleTheme,
  };
};*/

// src/hooks/useTheme.js

export { useTheme } from '../context/ThemeContext.jsx';