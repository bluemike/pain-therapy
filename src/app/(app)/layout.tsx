import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { requireUser } from '@/lib/session';
import { profileOf } from '@/lib/users';
import { GreetedMark } from '@/components/GreetedMark';
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
    { href: '/catalog', label: t('catalog') },
    ...(user.roles.includes('ADMIN') ? [{ href: '/admin/consent-texts', label: t('consentTexts') }] : []),
  ];
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // user-profile (iteration 8, design D9): the professional title instead of "Therapeut:in"
  const [profile, session, tp] = await Promise.all([profileOf(user.id), auth(), getTranslations('profile')]);
  const title = tp(`title_${profile?.title ?? 'THERAPIST_F'}`);
  const role = user.roles.includes('ADMIN') ? `${title} · ${t('roleAdmin')}` : title;
  const profileLink = (
    <Link className="linkbtn" href="/profile">
      {t('profile')}
    </Link>
  );
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
            <div className="uname">
              {profileLink}
              {signOutForm}
            </div>
          </div>
          <MobileMenu items={items} menuLabel={tc('menu')}>
            <LanguageSwitch />
            <span>{user.name}</span>
            {profileLink}
            {signOutForm}
          </MobileMenu>
        </div>
      </header>
      <main className="page" id="main">
        {children}
      </main>
      {session?.user?.authTime ? <GreetedMark authTime={session.user.authTime} /> : null}
    </div>
  );
}
