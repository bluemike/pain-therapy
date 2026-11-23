import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { requirePractice } from '@/lib/practice';
import { db } from '@/lib/db';
import { PracticeForm } from '@/components/PracticeForm';
import { ExportList } from '@/components/ExportList';
import { exportsOf } from '@/lib/practice-export';
import { exportAction } from './actions';
import { planUsageOf } from '@/lib/plans';
import { PlanCard } from '@/components/PlanNotice';

export const dynamic = 'force-dynamic';

/** practice-settings (iteration 12, design D5): Seite «Praxis», nur für die Praxis-Admin */
export default async function PracticePage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  await requireUser('manageConsentTexts');
  const [t, te, p, sp] = await Promise.all([
    getTranslations('practice'),
    getTranslations('exports'),
    requirePractice(),
    searchParams,
  ]);
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
      {sp.flash === 'exporting' ? (
        <div className="banner ok" role="status">
          <p>{te('started')}</p>
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
          privacyOfficer: p.privacyOfficer ?? '',
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
      <PlanCard usage={await planUsageOf(p.id)} />
      <section className="card team-card" id="export" aria-labelledby="h_export">
        <h2 id="h_export">{te('title')}</h2>
        <p className="muted">{te('sub')}</p>
        <ExportList exports={await exportsOf(p.id)} />
        <form action={exportAction}>
          <button className="btn btn--ghost">{te('start')}</button>
        </form>
      </section>
    </>
  );
}
