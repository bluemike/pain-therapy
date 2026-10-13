import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { EMPTY_PATIENT, PatientForm } from '@/components/PatientForm';

export default async function NewPatientPage() {
  await requireUser();
  const t = await getTranslations('form');
  const tp = await getTranslations('patients');
  return (
    <>
      <div className="crumb">
        <Link href="/patients">← {tp('title')}</Link>
      </div>
      <div className="ptitle">
        <div>
          <h1>{t('newTitle')}</h1>
          <div className="sub">
            {t('subtitle')} · {t('requiredNote')}
          </div>
        </div>
      </div>
      <PatientForm initial={EMPTY_PATIENT} cancelHref="/patients" />
    </>
  );
}
