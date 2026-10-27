'use client';
import React, { createContext, useState, useEffect, useContext } from 'react';

type Locale = string;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

// Fixed locale for the first paint (SSR + first client render MUST agree, or React
// throws a hydration mismatch). The app is Spanish-first, so we render Spanish, then
// adopt the browser's language after hydration (see the effect below).
const DEFAULT_LOCALE = 'es';

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Only after hydration — reading navigator in the initializer would make the
  // first client render differ from the server (which has no navigator).
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.language) {
      setLocaleState(navigator.language);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (newLocale: Locale) => setLocaleState(newLocale);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within a LocaleProvider');
  return context;
};
