import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { signOut } from '@/auth';
import { requireUser } from '@/lib/session';
import { Logo } from '@/components/Logo';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { MobileMenu, NavLinks } from '@/components/NavLinks';

/** app-shell: Kopfzeile mit Logo, App-Name, Sprachwahl, Benutzer und Navigation */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const items = [
    { href: '/', label: t('dashboard') },
    { href: '/patients', label: t('patients') },
    ...(user.roles.includes('ADMIN') ? [{ href: '/admin/consent-texts', label: t('consentTexts') }] : []),
  ];
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const role = user.roles.includes('ADMIN') ? t('roleAdmin') : t('roleTherapist');
  const signOutForm = (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <button className="linkbtn">{t('signOut')}</button>
    </form>
  );
  return (
    <div className="app">
      <a className="skip" href="#main">
        {t('skipToContent')}
      </a>
      <header className="hdr">
        <Link href="/" className="logo" aria-label={`Ayanta ${tc('appName')}`} style={{ textDecoration: 'none' }}>
          <Logo appName={tc('appName')} />
        </Link>
        <NavLinks items={items} />
        <div className="hright">
          <LanguageSwitch />
          <div className="user">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <div className="uname">
              <b>{user.name}</b>
              <small>{role}</small>
            </div>
            <div className="uname">{signOutForm}</div>
          </div>
          <MobileMenu items={items} menuLabel={tc('menu')}>
            <LanguageSwitch />
            <span>{user.name}</span>
            {signOutForm}
          </MobileMenu>
        </div>
      </header>
      <main className="page" id="main">
        {children}
      </main>
    </div>
  );
}
