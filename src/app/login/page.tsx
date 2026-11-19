import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { config } from '@/lib/config';
import { LOGIN_HINT_COOKIE, loginHintFrom } from '@/lib/login-hint';
import { safeCallback } from '@/lib/auth/request';
import { Logo } from '@/components/Logo';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LoginForm } from './LoginForm';
import { devSignInAction } from './actions';

export const dynamic = 'force-dynamic';

/** therapist-login (iteration 12): Anmeldung mit Passkey oder E-Mail-Code plus Authenticator */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations('login');
  const tc = await getTranslations('common');
  const callbackUrl = safeCallback(sp.callbackUrl);
  const hint = loginHintFrom((await cookies()).get(LOGIN_HINT_COOKIE)?.value);
  return (
    <div className="app">
      <main className="center" id="main">
        <div className="lcard">
          <Logo appName={tc('appName')} />
          <h1>{t('title')}</h1>
          {sp.expired ? (
            <div className="banner info" role="status">
              <p>{t('expired')}</p>
            </div>
          ) : null}
          <LoginForm hint={hint} callbackUrl={callbackUrl} />
          {config.devLogin ? (
            <form className="devbox" action={devSignInAction}>
              <b>{t('devTitle')}</b>
              <span className="muted" style={{ fontSize: 13 }}>
                {t('devNote')}
              </span>
              <input type="hidden" name="callbackUrl" value={callbackUrl} />
              <div className="grid2">
                <div className="f">
                  <label className="l" htmlFor="name">
                    {t('devName')}
                  </label>
                  <input className="inp" id="name" name="name" defaultValue="Mike Franz" />
                </div>
                <div className="f">
                  <label className="l" htmlFor="email">
                    {t('devEmail')}
                  </label>
                  <input className="inp" id="email" name="email" defaultValue="mike.franz@ayanta.ch" />
                </div>
                <div className="f">
                  <label className="l" htmlFor="role">
                    {t('devRole')}
                  </label>
                  <select className="inp" id="role" name="role" defaultValue="Therapist,Admin">
                    <option value="Therapist">{t('devRoleTherapist')}</option>
                    <option value="Admin">{t('devRoleAdmin')}</option>
                    <option value="Therapist,Admin">{t('devRoleBoth')}</option>
                    <option value="none">{t('devRoleNone')}</option>
                    <option value="platform">{t('devRolePlatform')}</option>
                  </select>
                </div>
                <div className="f">
                  <label className="l" htmlFor="practice">
                    {t('devPractice')}
                  </label>
                  <input className="inp" id="practice" name="practice" defaultValue="falera" />
                </div>
              </div>
              <button className="btn btn--gold">{t('devSubmit')}</button>
            </form>
          ) : null}
          <div style={{ alignSelf: 'flex-start' }}>
            <LanguageSwitch />
          </div>
        </div>
      </main>
    </div>
  );
}
