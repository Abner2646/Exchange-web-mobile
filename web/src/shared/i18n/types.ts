export type Locale = 'en' | 'es' | 'en-US';

export interface TranslationDictionary {
  [key: string]: string;
}

export interface ErrorDictionary {
  [code: string]: string;
}

export interface Catalog {
  ui: TranslationDictionary;
  errors: ErrorDictionary;
}
