import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { programSession } from '@/lib/access';
import { getZoneSession } from '@/lib/session';
import { ZoneTabs } from '@/components/ZoneTabs';
import { logoutAction } from './actions';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './globals.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return { title: `${t('appName')} · Ayanta`, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1C1A14' };

/** patient-zone-app: mobile first (mockup views 1 and 2), privacy link in the footer of every page */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, t, session] = await Promise.all([getLocale(), getTranslations('common'), getZoneSession()]);
  return (
    <html lang={locale}>
      <body>
        <a className="skip" href="#main">
          {t('skip')}
        </a>
        <header className="top">
          <span className="logo" aria-label="Ayanta">
            ayanta<i>.</i>
          </span>
          <span className="appname">{t('appName')}</span>
          {session ? (
            <form action={logoutAction} className="logout">
              <button className="linkbtn">{t('logout')}</button>
            </form>
          ) : null}
        </header>
        <NextIntlClientProvider>
          {session && !session.signaturePending ? <ZoneTabs exercises={!!programSession(session)} /> : null}
          <main id="main">{children}</main>
        </NextIntlClientProvider>
        <footer className="foot">
          <Link href="/privacy">{t('privacy')}</Link> · {t('footerNote')}
        </footer>
      </body>
    </html>
  );
}
