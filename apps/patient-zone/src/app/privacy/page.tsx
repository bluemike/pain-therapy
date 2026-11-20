import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { practiceDetails } from '@/lib/db';
import { sessionPractice } from '@/lib/practice';

/**
 * patient-zone-app: Datenschutzhinweis of the patient's practice (iteration 12, practice-settings): its own text when
 * the practice wrote one, else the template with its name, address and contact.
 */
export default async function Privacy({ searchParams }: { searchParams: Promise<{ praxis?: string }> }) {
  const [t, sp] = await Promise.all([getTranslations('privacy'), searchParams]);
  const p =
    (await sessionPractice()) ??
    (sp.praxis && /^[a-z0-9-]{1,60}$/.test(sp.praxis) ? await practiceDetails({ slug: sp.praxis }) : null);
  // German: «die Praxis Physio Muster» or «die Praxis, bei der Sie in Behandlung sind»
  const name = p ? ` ${p.name}` : t('yourPractice');
  return (
    <>
      <h1>{t('title')}</h1>
      <section className="card prose">
        {p?.privacyNotice ? (
          p.privacyNotice
            .split(/\n\s*\n/)
            .map((para, i) => <p key={i}>{para.trim()}</p>)
        ) : (
          <>
            <h2>{t('who')}</h2>
            <p>{t('whoText', { name })}</p>
            <h2>{t('what')}</h2>
            <p>{t('whatText')}</p>
            <h2>{t('why')}</h2>
            <p>{t('whyText')}</p>
            <h2>{t('howLong')}</h2>
            <p>{t('howLongText')}</p>
            <h2>{t('contact')}</h2>
            <p>
              {p
                ? t('contactText', { name: p.name, address: p.addressLine, email: p.contactEmail })
                : t('contactGeneric')}
            </p>
          </>
        )}
      </section>
      <p>
        <Link href="/">{t('back')}</Link>
      </p>
    </>
  );
}
