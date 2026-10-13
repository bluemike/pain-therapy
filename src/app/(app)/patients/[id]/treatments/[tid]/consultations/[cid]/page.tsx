import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { getConsultation, sheetOf } from '@/lib/treatments';
import { photosOf } from '@/lib/photos';
import { toLocalInput } from '@/lib/format';
import { ConsultationPage } from '../ConsultationPage';

export const dynamic = 'force-dynamic';

/** consultations: Konsultation ansehen und ändern (every change in the history, no delete) */
export default async function EditConsultationPage({
  params,
}: {
  params: Promise<{ id: string; tid: string; cid: string }>;
}) {
  await requireUser();
  const { id, tid, cid } = await params;
  const c = await getConsultation(cid);
  if (!c || c.treatmentId !== tid || c.treatment.patientId !== id) notFound();
  const photos = await photosOf({ treatmentId: tid, consultationId: cid });
  return (
    <ConsultationPage
      treatment={c.treatment}
      number={c.number}
      id={cid}
      initial={{
        at: toLocalInput(c.at),
        diagnosis: c.diagnosis,
        comparison: c.comparison ?? '',
        painBefore: c.painBefore,
        painAfter: c.painAfter,
        sheet: sheetOf(c),
      }}
      saved={photos.map((p) => ({ id: p.id, takenAt: p.takenAt.toISOString() }))}
    />
  );
}
