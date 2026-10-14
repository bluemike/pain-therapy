import { getRequestConfig } from 'next-intl/server';
import { headers } from 'next/headers';

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Browser language before the confirmation (German unless the browser prefers English) */
export function pickLocale(acceptLanguage: string | null): Locale {
  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0].trim().slice(0, 2).toLowerCase();
    if (tag === 'de' || tag === 'en') return tag;
  }
  return 'de';
}

/**
 * patient-zone-app: Sprache der Patientin. With a session the patient's preferred language; before the confirmation
 * the browser language, so the page reveals nothing about the patient of a link.
 */
export default getRequestConfig(async () => {
  let locale: Locale | null = null;
  try {
    const { getZoneSession } = await import('@/lib/session');
    locale = (await getZoneSession())?.patient.preferredLanguage ?? null;
  } catch {
    locale = null;
  }
  locale ??= pickLocale((await headers()).get('accept-language'));
  return {
    locale,
    timeZone: 'Europe/Zurich',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
