import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { config } from '@/lib/config';
import { getSession } from '@/lib/signing';
import { Logo } from '@/components/Logo';
import { reauthenticate, reauthenticateDev } from '../../actions';

export const dynamic = 'force-dynamic';

/** consent-signing: Patientenmodus verlassen. Only a fresh sign-in of the practice user ends patient mode. */
export default async function LeavePage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const session = await auth();
  if (session?.patientMode?.sid !== sid) redirect('/');
  const s = await getSession(sid);
  const t = await getTranslations('reauth');
  const tl = await getTranslations('login');
  const entra = !!config.entra.clientId;
  return (
    <div className="center">
      <div className="lcard">
        <Logo />
        <h1>{t('title')}</h1>
        <p>{t('text')}</p>
        {s?.status !== 'SIGNED' ? (
          <p className="errtxt" style={{ fontWeight: 400 }}>
            {t('aborted')}
          </p>
        ) : null}
        {entra ? (
          <form action={reauthenticate.bind(null, sid)}>
            <button className="btn btn--dark" style={{ width: '100%', minHeight: 50 }}>
              {t('button')}
            </button>
          </form>
        ) : null}
        {config.devLogin ? (
          <form action={reauthenticateDev.bind(null, sid)} className="devbox">
            <b>{tl('devTitle')}</b>
            <div className="grid2">
              <div className="f">
                <label className="l" htmlFor="name">
                  {tl('devName')}
                </label>
                <input className="inp" id="name" name="name" defaultValue={session.user.name ?? ''} />
              </div>
              <div className="f">
                <label className="l" htmlFor="email">
                  {tl('devEmail')}
                </label>
                <input className="inp" id="email" name="email" defaultValue={session.user.email ?? ''} />
              </div>
            </div>
            <input
              type="hidden"
              name="role"
              value={session.user.roles.map((r) => (r === 'ADMIN' ? 'Admin' : 'Therapist')).join(',')}
            />
            <button className="btn btn--dark">{t('button')}</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
