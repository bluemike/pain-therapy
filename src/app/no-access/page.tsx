import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { Logo } from '@/components/Logo';

/** access-control: "Kein Zugang" for foreign accounts, users without a role and missing permissions */
export default async function NoAccess({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const t = await getTranslations('noAccess');
  const tc = await getTranslations('common');
  const session = await auth();
  const reason = sp.reason ?? (sp.error ? 'foreign' : 'forbidden');
  return (
    <div className="app">
      <main className="center" id="main">
        <div className="lcard">
          <Logo appName={tc('appName')} />
          <span className="pill err" style={{ alignSelf: 'flex-start' }}>
            403
          </span>
          <h1>{t('title')}</h1>
          {reason === 'noRole' ? (
            <>
              <p>{t('noRole')}</p>
              <p>{t('help')}</p>
            </>
          ) : reason === 'forbidden' ? (
            <p>{t('forbidden')}</p>
          ) : (
            <p>{t('foreign')}</p>
          )}
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
