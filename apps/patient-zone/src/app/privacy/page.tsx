import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { config } from '@/lib/config';

/** patient-zone-app: Datenschutzhinweis (wer, wozu, wie lange, Kontakt; text to be confirmed by the practice) */
export default async function Privacy() {
  const t = await getTranslations('privacy');
  const p = config.practice;
  return (
    <>
      <h1>{t('title')}</h1>
      <section className="card prose">
        <h2>{t('who')}</h2>
        <p>{t('whoText', { name: p.name })}</p>
        <h2>{t('what')}</h2>
        <p>{t('whatText')}</p>
        <h2>{t('why')}</h2>
        <p>{t('whyText')}</p>
        <h2>{t('howLong')}</h2>
        <p>{t('howLongText')}</p>
        <h2>{t('contact')}</h2>
        <p>{t('contactText', { name: p.name, address: p.address, email: p.email })}</p>
      </section>
      <p>
        <Link href="/">{t('back')}</Link>
      </p>
    </>
  );
}
