'use client'

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ru from '../locales/ru.json';

const LOCALE_LOADERS: Record<string, () => Promise<{ default: any }>> = {
  en: () => import('../locales/en.json'),
  fr: () => import('../locales/fr.json'),
  de: () => import('../locales/de.json'),
  es: () => import('../locales/es.json'),
  ar: () => import('../locales/ar.json'),
  ja: () => import('../locales/ja.json'),
  pt: () => import('../locales/pt.json'),
  ru: () => import('../locales/ru.json'),
  zh: () => import('../locales/zh.json'),
  hi: () => import('../locales/hi.json'),
  ko: () => import('../locales/ko.json'),
  it: () => import('../locales/it.json'),
  tr: () => import('../locales/tr.json'),
  vi: () => import('../locales/vi.json'),
  id: () => import('../locales/id.json'),
  pl: () => import('../locales/pl.json'),
  uk: () => import('../locales/uk.json'),
  nl: () => import('../locales/nl.json'),
  th: () => import('../locales/th.json'),
  bn: () => import('../locales/bn.json'),
  fa: () => import('../locales/fa.json'),
  sk: () => import('../locales/sk.json'),
};

// Bundle Russian as the product default; lazy-load other locales on demand
const resources = {
  ru: { common: ru },
};

async function loadLocale(lng: string) {
  const code = lng.split('-')[0]
  if (code === 'ru' || !LOCALE_LOADERS[code]) return;
  if (i18n.hasResourceBundle(code, 'common')) return;

  try {
    const mod = await LOCALE_LOADERS[code]();
    i18n.addResourceBundle(code, 'common', mod.default, true, true);
  } catch (e) {
    console.warn(`Failed to load locale: ${lng}`, e);
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // Learner surfaces start in Russian deterministically. Dedicated
    // authoring controls may still switch operational copy explicitly.
    lng: 'ru',
    fallbackLng: 'ru',
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    detection: {
      // Do not restore a legacy browser-selected locale on boot. Learner
      // surfaces are Russian-only; dashboard menus may still switch locale
      // explicitly for an authoring session.
      order: [],
      caches: [],
    },
    react: {
      useSuspense: false,
    }
  });

// Resolve the initial Russian bundle before the provider renders.
export const initialLocaleReady = loadLocale('ru');

/**
 * Switch language safely for dedicated authoring controls — preload the bundle
 * before switching so the UI never flashes English as a fallback.
 */
export async function changeLanguage(lng: string) {
  await loadLocale(lng)
  return i18n.changeLanguage(lng)
}

export default i18n;
