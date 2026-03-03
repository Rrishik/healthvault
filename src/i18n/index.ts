// HealthVault — i18n setup (i18next + react-i18next)

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';

const LS_LANG_KEY = 'hv_language';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
] as const;

const savedLang = localStorage.getItem(LS_LANG_KEY) ?? 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

/** Persist language choice and switch i18n locale */
export function changeLanguage(code: string) {
  localStorage.setItem(LS_LANG_KEY, code);
  return i18n.changeLanguage(code);
}

export default i18n;
