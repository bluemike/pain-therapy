import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * zone-consent-signing: Vielen Dank (mockup view 5). Since iteration 6 the signature itself keeps the link valid
 * (zone-record, design D3), so the patient continues to her exercises or, without a home program, to her record.
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
        <Link className="btn btn--gold btn--block" href="/dokumente">
          {t('toRecord')}
        </Link>
      )}
    </>
  );
}
