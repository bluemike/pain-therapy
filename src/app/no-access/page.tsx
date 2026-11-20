import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { Logo } from '@/components/Logo';

/** access-control: "Kein Zugang" for a suspended practice, users without a membership and missing permissions */
export default async function NoAccess({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const sp = await searchParams;
  const t = await getTranslations('noAccess');
  const tc = await getTranslations('common');
  const session = await auth();
  const reason = ['suspended', 'noMembership', 'inactive', 'forbidden'].includes(sp.reason ?? '')
    ? sp.reason!
    : 'forbidden';
  return (
    <div className="app">
      <main className="center" id="main">
        <div className="lcard">
          <Logo appName={tc('appName')} />
          <span className="pill err" style={{ alignSelf: 'flex-start' }}>
            403
          </span>
          <h1>{t('title')}</h1>
          <p>{t(reason as 'forbidden')}</p>
          {session?.user && reason === 'forbidden' ? (
            <Link className="btn btn--ghost" href="/">
              {t('backHome')}
            </Link>
          ) : (
            <Link className="btn btn--ghost" href="/login">
              {t('backLogin')}
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
