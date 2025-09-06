import { useState, useEffect, useCallback } from 'react';

/**
 * Custom hook to manage the theme system
 * @returns {Object} Object with the current theme and functions to handle it
 */
export const useTheme = () => {
  // Function to get saved theme
  const getStoredTheme = () => {
    try {
      return localStorage.getItem('theme');
    } catch (error) {
      console.warn('No se puede acceder a localStorage:', error);
      return null;
    }
  };

  // Function to obtain system preference
  const getSystemTheme = () => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  };

  // Initial state of the topic
  const [theme, setTheme] = useState(() => {
    return getStoredTheme() || getSystemTheme();
  });

  // Function to apply theme to the document
  const applyTheme = useCallback((newTheme) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
    
    try {
      localStorage.setItem('theme', newTheme);
    } catch (error) {
      console.warn('No se puede guardar en localStorage:', error);
    }
    
    setTheme(newTheme);
  }, []);

  // Theme toggle function
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
  }, [theme, applyTheme]);

  // Function to set specific theme
  const setSpecificTheme = useCallback((newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark') {
      applyTheme(newTheme);
    }
  }, [applyTheme]);

  // Check if it is dark theme
  const isDark = theme === 'dark';

  // Effect to apply initial theme and listen to system changes
  useEffect(() => {
    // Apply initial theme
    applyTheme(theme);

    // Listen to changes in system preferences
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      
      const handleSystemThemeChange = (e) => {
        // Only change if there is no manually saved theme
        if (!getStoredTheme()) {
          applyTheme(e.matches ? 'dark' : 'light');
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);

      // Cleanup
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }
  }, [theme, applyTheme]);

  return {
    theme,
    isDark,
    toggleTheme,
    setTheme: setSpecificTheme
  };
};