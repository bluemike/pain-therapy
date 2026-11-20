import { PLATFORM_NAME } from '@pain-therapy/shared/brand';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { signOut } from '@/auth';
import { requirePlatformAdmin } from '@/lib/session';
import { Logo } from '@/components/Logo';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { NavLinks } from '@/components/NavLinks';
import { PlatformFooter } from '@/components/PlatformFooter';

/** platform-admin (iteration 12, design D3): own frame for the platform account, without practice navigation */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePlatformAdmin();
  const [t, tp] = await Promise.all([getTranslations('nav'), getTranslations('platformAdmin')]);
  return (
    <div className="app">
      <a className="skip" href="#main">
        {t('skipToContent')}
      </a>
      <header className="hdr">
        <Link href="/platform" className="logo" aria-label={PLATFORM_NAME} style={{ textDecoration: 'none' }}>
          <Logo />
        </Link>
        <NavLinks
          items={[
            { href: '/platform', label: t('practices') },
            { href: '/platform/security', label: tp('security') },
          ]}
        />
        <div className="hright">
          <LanguageSwitch />
          <span className="muted">{user.name}</span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button className="btn btn--ghost">{t('signOut')}</button>
          </form>
        </div>
      </header>
      <main className="page" id="main">
        {children}
      </main>
      <PlatformFooter />
    </div>
  );
}
