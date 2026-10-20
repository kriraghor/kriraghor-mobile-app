import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { secureStore } from '@/lib/secure-store';
import { bn } from './bn';
import { en } from './en';

/**
 * English and Bangla from the first version. The app follows the phone's language (Bangla when the
 * phone is set to Bangla, English otherwise) until the user picks one in Account; that choice is
 * kept on the device. Notifications follow the account's language on the server (M08-FR-07).
 */
export type Language = 'en' | 'bn';
export const LANGUAGES: Language[] = ['en', 'bn'];
const KEY = 'kg.language';

export function deviceLanguage(): Language {
  return getLocales()[0]?.languageCode === 'bn' ? 'bn' : 'en';
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React escapes already
  returnNull: false,
});

/** Apply the language the user picked earlier, if any (called once at launch). */
export async function restoreLanguage() {
  const saved = await secureStore.get(KEY).catch(() => null);
  if (saved === 'en' || saved === 'bn') await i18n.changeLanguage(saved);
}

export async function setLanguage(lng: Language) {
  await i18n.changeLanguage(lng);
  await secureStore.set(KEY, lng).catch(() => undefined);
}

export const currentLanguage = (): Language => (i18n.language === 'bn' ? 'bn' : 'en');

export default i18n;
