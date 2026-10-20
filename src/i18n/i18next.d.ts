import 'i18next';
import type { en } from './en';

// Typed keys: t('tabs.events') is checked at compile time.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
  }
}
