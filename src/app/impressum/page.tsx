import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { config } from '@/lib/config';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Impressum' };

/** Impressum of the platform (iteration 12): the operator, not a practice */
export default async function Imprint() {
  const t = await getTranslations('platform');
  const o = config.operator;
  return (
    <div className="app">
      <main className="center" id="main">
        <div className="lcard">
          <Logo />
          <h1>{t('imprint')}</h1>
          <p>{t('imprintText')}</p>
          <p>
            <b>{o.name}</b>
            {o.address ? (
              <>
                <br />
                {o.address}
              </>
            ) : null}
            <br />
            <a href={`mailto:${o.email}`}>{o.email}</a>
          </p>
          <p className="muted" style={{ fontSize: 13 }}>
            {t('imprintPractices')}
          </p>
          <Link className="btn btn--ghost" href="/">
            {t('back')}
          </Link>
        </div>
      </main>
    </div>
  );
}
