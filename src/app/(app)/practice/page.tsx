import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { requirePractice } from '@/lib/practice';
import { db } from '@/lib/db';
import { PracticeForm } from '@/components/PracticeForm';

export const dynamic = 'force-dynamic';

/** practice-settings (iteration 12, design D5): Seite «Praxis», nur für die Praxis-Admin */
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  await requireUser('manageConsentTexts');
  const [t, p, sp] = await Promise.all([getTranslations('practice'), requirePractice(), searchParams]);
  const year = new Date().getUTCFullYear();
  const [counter, consent] = await Promise.all([
    db.documentCounter.findUnique({ where: { practiceId_year: { practiceId: p.id, year } } }),
    db.consentTextVersion.findFirst({ where: { language: 'de' }, orderBy: { version: 'desc' } }),
  ]);
  const next = `${p.documentPrefix}-${year}-${String((counter?.last ?? 0) + 1).padStart(5, '0')}`;
  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{t('sub')}</div>
        </div>
      </div>
      {sp.flash === 'saved' ? (
        <div className="banner ok" role="status">
          <p>{t('saved')}</p>
        </div>
      ) : null}
      <PracticeForm
        initial={{
          name: p.name,
          street: p.street ?? '',
          zip: p.zip ?? '',
          city: p.city ?? '',
          contactEmail: p.contactEmail,
          phone: p.phone ?? '',
          defaultPlace: p.defaultPlace,
          documentPrefix: p.documentPrefix,
          privacyNotice: p.privacyNotice ?? '',
        }}
        logoUrl={p.logoType ? `/api/practice/logo?v=${p.updatedAt.getTime()}` : null}
        footer={t('footerPreview', { line: p.addressLine, next })}
      />
      <section className="card" style={{ padding: 20, marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <b style={{ flex: 1 }}>{t('consentText')}</b>
        <span className="muted">{consent ? t('consentVersion', { version: consent.version }) : t('consentNone')}</span>
        <Link className="btn btn--ghost" href="/admin/consent-texts">
          {t('edit')}
        </Link>
      </section>
    </>
  );
}
