import { PLATFORM_NAME } from '@pain-therapy/shared/brand';
import { getLocale, getTranslations } from 'next-intl/server';
import { audioLanguageOf } from '@pain-therapy/shared/audio-language';
import { AudioLanguageProvider } from '@/components/AudioLanguage';
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { requireUser } from '@/lib/session';
import { currentPractice } from '@/lib/practice';
import { PlatformFooter } from '@/components/PlatformFooter';
import { profileOf } from '@/lib/users';
import { GreetedMark } from '@/components/GreetedMark';
import { Logo } from '@/components/Logo';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { MobileMenu, NavLinks } from '@/components/NavLinks';
import { UserMenu } from '@/components/UserMenu';

/** app-shell: Kopfzeile mit Logo, App-Name, Sprachwahl, Benutzer und Navigation */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const t = await getTranslations('nav');
  const tc = await getTranslations('common');
  const items = [
    { href: '/', label: t('dashboard') },
    { href: '/patients', label: t('patients') },
    { href: '/catalog', label: t('catalog') },
    ...(user.roles.includes('ADMIN')
      ? [
          { href: '/practice', label: t('practice') },
          { href: '/practice/team', label: t('team') },
          { href: '/admin/consent-texts', label: t('consentTexts') },
        ]
      : []),
  ];
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // user-profile (iteration 8, design D9): the professional title instead of "Therapeut:in"
  const [profile, session, tp, practice, locale] = await Promise.all([
    profileOf(user.id),
    auth(),
    getTranslations('profile'),
    currentPractice(),
    getLocale(),
  ]);
  const title = tp(`title_${profile?.title ?? 'THERAPIST_F'}`);
  const role = user.roles.includes('ADMIN') ? `${title} · ${t('roleAdmin')}` : title;
  const signOutForm = (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <button className="item">{t('signOut')}</button>
    </form>
  );
  return (
    <div className="app">
      <a className="skip" href="#main">
        {t('skipToContent')}
      </a>
      <header className="hdr">
        <Link
          href="/"
          className="logo"
          aria-label={`${practice?.name ?? PLATFORM_NAME} ${tc('appName')}`}
          style={{ textDecoration: 'none' }}
        >
          <Logo
            appName={tc('appName')}
            practice={
              practice
                ? {
                    name: practice.name,
                    logoUrl: practice.logoType ? `/api/practice/logo?v=${practice.updatedAt.getTime()}` : null,
                  }
                : undefined
            }
          />
        </Link>
        <NavLinks items={items} />
        <div className="hright">
          <LanguageSwitch />
          <UserMenu
            initials={initials}
            name={user.name}
            role={role}
            menuLabel={t('userMenu', { name: user.name })}
            profileLabel={t('profile')}
            signOut={signOutForm}
          />
          <MobileMenu items={items} menuLabel={tc('menu')}>
            <LanguageSwitch />
          </MobileMenu>
        </div>
      </header>
      <main className="page" id="main">
        <AudioLanguageProvider value={audioLanguageOf(locale, profile?.audioLanguage)}>
          {children}
        </AudioLanguageProvider>
      </main>
      <PlatformFooter />
      {session?.user?.authTime ? <GreetedMark authTime={session.user.authTime} /> : null}
    </div>
  );
}
