import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { handoutContext } from '@/lib/handouts';
import { timingOf } from '@/lib/exercise-sheets';
import { formatDate, formatDateZurich } from '@/lib/format';
import { formatMinutes, programTime, type Repetition } from '@/lib/home-program';
import { HandoutPanel } from '@/components/HandoutPanel';
import { HandoutList } from '@/components/HandoutList';

export const dynamic = 'force-dynamic';

/**
 * exercise-handout: Abschluss der Konsultation (design D6, mockup view 2). Offers the exercise sheet once at least one
 * exercise is prescribed for home; it is created only on "Übungsblatt senden" or "Drucken".
 */
export default async function HandoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tid: string; cid: string }>;
  searchParams: Promise<{ flash?: string }>;
}) {
  await requireUser();
  const { id, tid, cid } = await params;
  const sp = await searchParams;
  const ctx = await handoutContext(cid);
  if (!ctx || ctx.consultation.treatmentId !== tid || ctx.patient.id !== id) notFound();
  const [t, locale] = await Promise.all([getTranslations('handout'), getLocale()]);
  const { consultation: c, patient: p } = ctx;
  const name = `${p.firstName} ${p.lastName}`;
  const base = `/patients/${id}/treatments/${tid}/consultations/${cid}`;
  const record = `/patients/${id}#t-${tid}`;
  const total = programTime(
    ctx.prescriptions.map((x) => ({
      code: x.exerciseCode,
      repetition: x.repetition as Repetition,
      timing: timingOf(x.exercise.sheet),
    })),
  );
  const emailNote = !ctx.consent.granted
    ? t('noConsent')
    : !p.email
      ? t('noAddress')
      : t('emailConsent', { date: formatDate(ctx.consent.signedAt) });
  return (
    <>
      <div className="crumb">
        <Link href={record}>
          ← {name} · {c.treatment.region.id} {locale === 'en' ? c.treatment.region.nameEn : c.treatment.region.nameDe}
        </Link>
      </div>
      {sp.flash === 'saved' ? (
        <div className="banner ok" role="status">
          <p>{t('savedFlash', { n: c.number })}</p>
        </div>
      ) : null}
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{t('sub', { name, n: c.number, date: formatDateZurich(c.at) })}</div>
        </div>
        <div className="actions">
          <Link className="btn btn--ghost" href={base}>
            {t('editConsultation')}
          </Link>
        </div>
      </div>
      {ctx.prescriptions.length ? (
        <>
          <div className="banner info">
            <p>{t('info', { count: ctx.prescriptions.length, day: formatMinutes(total.dayMinutes, locale) })}</p>
          </div>
          <section className="card handout">
            <div className="body">
              <HandoutPanel
                consultationId={cid}
                canEmail={ctx.canEmail}
                emailTo={p.email}
                emailNote={emailNote}
                previewHref={`${base}/handout/preview`}
                laterHref={record}
              />
            </div>
          </section>
        </>
      ) : (
        <div className="banner info">
          <p>{t('none')}</p>
          <Link className="btn btn--ghost" href={record}>
            {t('toRecord')}
          </Link>
        </div>
      )}
      <section className="card" aria-labelledby="h_versions">
        <header>
          <h2 id="h_versions">{t('versions')}</h2>
        </header>
        {c.handouts.length ? (
          <HandoutList handouts={c.handouts.map((h) => ({ ...h, consultation: { number: c.number } }))} />
        ) : (
          <div className="body muted">{t('noVersions')}</div>
        )}
      </section>
    </>
  );
}
