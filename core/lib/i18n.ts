import en from '@/messages/en.json';
import ar from '@/messages/ar.json';

export type Locale = 'ar' | 'en';

const dictionaries = { en, ar } as const;

/**
 * Deliberately not a full i18n framework — just enough to keep every string
 * out of components. Server Components call this with the locale resolved
 * by middleware.ts; Client Components receive `messages` as a prop instead
 * of re-resolving locale themselves, so there's one source of truth per request.
 */
export function getMessages(locale: Locale) {
  return dictionaries[locale] ?? dictionaries.ar;
}

export function isRtl(locale: Locale) {
  return locale === 'ar';
}
