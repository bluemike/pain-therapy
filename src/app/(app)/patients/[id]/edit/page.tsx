import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { inputModeOf } from '@/lib/handwriting';
import { asInk } from '@pain-therapy/shared/ink';
import { getPatient, toFormValues } from '@/lib/patients';
import { PatientForm } from '@/components/PatientForm';

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();
  const t = await getTranslations('form');
  const name = `${patient.firstName} ${patient.lastName}`;
  return (
    <>
      <div className="crumb">
        <Link href={`/patients/${id}`}>← {name}</Link>
      </div>
      <div className="ptitle">
        <div>
          <h1>{t('editTitle', { name })}</h1>
          <div className="sub">
            {t('subtitle')} · {t('requiredNote')}
          </div>
        </div>
      </div>
      <PatientForm
        id={id}
        initial={toFormValues(patient)}
        cancelHref={`/patients/${id}`}
        furtherDiagnosesInk={asInk(patient.anamnesis?.furtherDiagnosesInk)}
        inputMode={await inputModeOf(user.id)}
      />
    </>
  );
}
