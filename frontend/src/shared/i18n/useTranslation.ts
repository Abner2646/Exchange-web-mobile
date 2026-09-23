import { useLocale } from './LocaleContext';
import { en } from './catalogs/en';
import { es } from './catalogs/es';
import { Catalog } from './types';

const catalogs: Record<string, Catalog> = {
  en,
  es,
};

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const trimmedKey = key.trim();
    return params[trimmedKey] !== undefined ? String(params[trimmedKey]) : '{{' + trimmedKey + '}}';
  });
}

export function useTranslation() {
  const { locale } = useLocale();

  const getCatalog = (): Catalog => {
    const baseLocale = locale.split('-')[0].toLowerCase();
    if (catalogs[locale]) return catalogs[locale];
    if (catalogs[baseLocale]) return catalogs[baseLocale];
    return en;
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const catalog = getCatalog();
    const text = catalog.ui[key];
    if (text === undefined) {
      return key;
    }
    return interpolate(text, params);
  };

  return { t, locale };
}
