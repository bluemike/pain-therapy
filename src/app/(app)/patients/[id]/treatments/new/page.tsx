import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { getPatient } from '@/lib/patients';
import { openingBlocker } from '@/lib/treatments';
import { listRegions, regionLabel } from '@/lib/catalog';
import { toLocalInput } from '@/lib/format';
import { TreatmentForm } from '@/components/TreatmentForm';
import { OpeningBlocked } from '@/components/OpeningBlocked';

export const dynamic = 'force-dynamic';

/** treatments: Behandlung eröffnen */
export default async function NewTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();
  const [t, tf, locale, blocker, regions] = await Promise.all([
    getTranslations('treatments'),
    getTranslations('form'),
    getLocale(),
    openingBlocker(id),
    listRegions(),
  ]);
  const name = `${patient.firstName} ${patient.lastName}`;
  return (
    <>
      <div className="crumb">
        <Link href={`/patients/${id}`}>← {name}</Link>
      </div>
      <div className="ptitle">
        <div>
          <h1>{t('newTitle')}</h1>
          <div className="sub">
            {name} · {tf('requiredNote')}
          </div>
        </div>
      </div>
      {blocker ? (
        <OpeningBlocked patientId={id} reason={blocker} />
      ) : (
        <TreatmentForm
          patientId={id}
          initial={{ startedAt: toLocalInput(new Date()), regionId: '', diagnosis: '', painStart: '' }}
          regions={regions.map((r) => [String(r.id), regionLabel(r, locale)])}
          cancelHref={`/patients/${id}`}
        />
      )}
    </>
  );
}
