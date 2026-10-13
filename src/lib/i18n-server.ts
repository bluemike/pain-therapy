import { createTranslator } from 'next-intl';
import de from '../../messages/de.json';
import en from '../../messages/en.json';

export const MESSAGES = { de, en } as const;
export type Messages = typeof de;

/** Translator usable outside a request (PDF, email), e.g. in the patient's language. */
export function translator<N extends keyof Messages>(locale: 'de' | 'en', namespace: N) {
  return createTranslator({ locale, messages: MESSAGES[locale] as Messages, namespace });
}
