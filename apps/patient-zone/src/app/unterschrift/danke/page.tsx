import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * zone-consent-signing: Vielen Dank (mockup view 5). Needs no session: without a home program the link and the device
 * session end with the signature (design D4), and this page is the last one the patient sees.
 */
export default async function Thanks({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p } = await searchParams;
  const t = await getTranslations('signThanks');
  return (
    <>
      <div className="banner ok" role="status">
        {t('saved')}
      </div>
      <h1>{t('title')}</h1>
      <p>{t('text')}</p>
      {p === '1' ? (
        <Link className="btn btn--gold btn--block" href="/">
          {t('toExercises')}
        </Link>
      ) : (
        <p className="muted">{t('noProgram')}</p>
      )}
    </>
  );
}
