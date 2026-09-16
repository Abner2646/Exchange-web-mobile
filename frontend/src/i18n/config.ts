import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: {} }, es: { translation: {} } },
  lng: navigator.language.startsWith('es') ? 'es' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
