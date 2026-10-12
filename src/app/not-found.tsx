import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/Logo';

export default async function NotFound() {
  const t = await getTranslations('errors');
  const tn = await getTranslations('noAccess');
  return (
    <div className="app">
      <main className="center" id="main">
        <div className="lcard">
          <Logo />
          <span className="pill off" style={{ alignSelf: 'flex-start' }}>
            404
          </span>
          <h1>{t('notFound')}</h1>
          <Link className="btn btn--ghost" href="/">
            {tn('backHome')}
          </Link>
        </div>
      </main>
    </div>
  );
}
