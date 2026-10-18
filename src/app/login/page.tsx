import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { signIn } from '@/auth';
import { config } from '@/lib/config';
import { LOGIN_HINT_COOKIE, loginHintFrom } from '@/lib/login-hint';
import { Logo } from '@/components/Logo';
import { LanguageSwitch } from '@/components/LanguageSwitch';

export const dynamic = 'force-dynamic';

function safeCallback(url?: string) {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}

/** access-control: Anmeldung über Ayanta Entra ID */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; callbackUrl?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations('login');
  const tc = await getTranslations('common');
  const redirectTo = safeCallback(sp.callbackUrl);
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
          <p>{t('text')}</p>
          {config.entra.clientId ? (
            <>
              <form
                action={async () => {
                  'use server';
                  await signIn('microsoft-entra-id', { redirectTo }, hint ? { login_hint: hint } : undefined);
                }}
              >
                <button className="btn btn--dark" style={{ width: '100%', minHeight: 50 }}>
                  <MicrosoftMark />
                  {t('button')}
                </button>
              </form>
              {hint ? (
                <form
                  className="muted"
                  style={{ fontSize: 13, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
                  action={async () => {
                    'use server';
                    (await cookies()).delete(LOGIN_HINT_COOKIE);
                    await signIn('microsoft-entra-id', { redirectTo }, { prompt: 'select_account' });
                  }}
                >
                  <span>{t('as', { email: hint })}</span>
                  <button className="btn btn--ghost">{t('otherAccount')}</button>
                </form>
              ) : null}
            </>
          ) : null}
          <p className="muted" style={{ fontSize: 13 }}>
            {t('note')}
          </p>
          {config.devLogin ? (
            <form
              className="devbox"
              action={async (fd: FormData) => {
                'use server';
                await signIn('dev', {
                  name: fd.get('name'),
                  email: fd.get('email'),
                  role: fd.get('role'),
                  tenant: fd.get('tenant'),
                  redirectTo,
                });
              }}
            >
              <b>{t('devTitle')}</b>
              <span className="muted" style={{ fontSize: 13 }}>
                {t('devNote')}
              </span>
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
                    <option value="Therapist">Therapist</option>
                    <option value="Admin">Admin</option>
                    <option value="Therapist,Admin">Therapist + Admin</option>
                    <option value="none">{t('devRoleNone')}</option>
                  </select>
                </div>
                <div className="f">
                  <label className="l" htmlFor="tenant">
                    {t('devTenant')}
                  </label>
                  <select className="inp" id="tenant" name="tenant" defaultValue="member">
                    <option value="member">{t('devTenantAyanta')}</option>
                    <option value="guest">{t('devTenantGuest')}</option>
                    <option value="other">{t('devTenantOther')}</option>
                  </select>
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

function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <rect width="9" height="9" fill="#f25022" />
      <rect x="11" width="9" height="9" fill="#7fba00" />
      <rect y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
