'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const THEME_STORAGE_KEY = 'bitflow-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Dark is the default on BOTH the server and the first client render (they must
  // agree, or React throws a hydration mismatch). A stored preference is adopted
  // right after mount; the inline <head> script already applied it before paint.
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') setThemeState(stored);
    } catch {
      /* localStorage unavailable (SSR/private mode) — keep the default */
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch { /* ignore */ }
  };
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};

// Runs before paint (injected in the root layout's <head>) to apply a stored
// theme without a flash. Defaults to dark when nothing is stored.
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
