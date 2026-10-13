import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getTreatment, newConsultationDefaults, openingBlocker } from '@/lib/treatments';
import { toLocalInput } from '@/lib/format';
import { EMPTY_SHEET } from '@/lib/schemas';
import { OpeningBlocked } from '@/components/OpeningBlocked';
import { ConsultationPage } from '../ConsultationPage';

export const dynamic = 'force-dynamic';

/** consultations: Konsultation eröffnen, date and time now, diagnosis from the treatment */
export default async function NewConsultationPage({ params }: { params: Promise<{ id: string; tid: string }> }) {
  await requireUser();
  const { id, tid } = await params;
  const tr = await getTreatment(tid);
  if (!tr || tr.patientId !== id) notFound();
  const [blocker, defaults] = await Promise.all([openingBlocker(id), newConsultationDefaults(tid)]);
  return (
    <ConsultationPage
      treatment={tr}
      number={defaults.nextNumber}
      blocked={blocker ? <OpeningBlocked patientId={id} reason={blocker} /> : null}
      initial={{
        at: toLocalInput(new Date()),
        diagnosis: defaults.diagnosis,
        comparison: '',
        painBefore: null,
        painAfter: null,
        sheet: EMPTY_SHEET,
      }}
    />
  );
}
