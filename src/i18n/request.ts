import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (cookie === 'de' || cookie === 'en') return cookie;
  // localization: browser language at first sign-in if German or English, otherwise German
  for (const part of (acceptLanguage ?? '').split(',')) {
    const tag = part.split(';')[0].trim().slice(0, 2).toLowerCase();
    if (tag === 'de' || tag === 'en') return tag;
  }
  return 'de';
}

/** The language a user chose earlier, kept across sign-ins (localization: Sprache des Benutzers). */
async function savedUserLocale(): Promise<string | null> {
  try {
    const { auth } = await import('@/auth');
    const session = await auth();
    if (!session?.user?.id) return null;
    const { db } = await import('@/lib/db');
    const user = await db.user.findUnique({ where: { entraOid: session.user.id }, select: { locale: true } });
    return user?.locale ?? null;
  } catch {
    return null;
  }
}

export default getRequestConfig(async ({ locale: requested }) => {
  let locale: Locale;
  if (requested === 'de' || requested === 'en') locale = requested;
  else {
    let cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (!cookie) cookie = (await savedUserLocale()) ?? undefined;
    locale = pickLocale(cookie, (await headers()).get('accept-language'));
  }
  return {
    locale,
    timeZone: 'Europe/Zurich',
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
