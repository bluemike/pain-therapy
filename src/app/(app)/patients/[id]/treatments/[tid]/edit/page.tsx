import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { getTreatment } from '@/lib/treatments';
import { photosOf } from '@/lib/photos';
import { listRegions, regionLabel } from '@/lib/catalog';
import { toLocalInput } from '@/lib/format';
import { TreatmentForm } from '@/components/TreatmentForm';

export const dynamic = 'force-dynamic';

/** treatments: Behandlung ändern (no delete) */
export default async function EditTreatmentPage({ params }: { params: Promise<{ id: string; tid: string }> }) {
  await requireUser();
  const { id, tid } = await params;
  const tr = await getTreatment(tid);
  if (!tr || tr.patientId !== id) notFound();
  const [t, tf, locale, regions, photos] = await Promise.all([
    getTranslations('treatments'),
    getTranslations('form'),
    getLocale(),
    listRegions(tr.regionId),
    photosOf({ treatmentId: tid, consultationId: null }),
  ]);
  const name = `${tr.patient.firstName} ${tr.patient.lastName}`;
  return (
    <>
      <div className="crumb">
        <Link href={`/patients/${id}#t-${tid}`}>← {name}</Link>
      </div>
      <div className="ptitle">
        <div>
          <h1>{t('editTitle')}</h1>
          <div className="sub">
            {name} · {regionLabel(tr.region, locale)} · {tf('requiredNote')}
          </div>
        </div>
      </div>
      <TreatmentForm
        patientId={id}
        id={tid}
        initial={{
          startedAt: toLocalInput(tr.startedAt),
          regionId: String(tr.regionId),
          diagnosis: tr.diagnosis,
          painStart: String(tr.painStart),
        }}
        regions={regions.map((r) => [String(r.id), regionLabel(r, locale)])}
        saved={photos.map((p) => ({ id: p.id, takenAt: p.takenAt.toISOString() }))}
        cancelHref={`/patients/${id}#t-${tid}`}
      />
    </>
  );
}
