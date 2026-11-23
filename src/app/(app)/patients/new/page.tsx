import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { inputModeOf } from '@/lib/handwriting';
import { EMPTY_PATIENT, PatientForm } from '@/components/PatientForm';
import { PlanNotice } from '@/components/PlanNotice';
import { currentPlanUsage } from '@/lib/plans';

export default async function NewPatientPage() {
  const user = await requireUser();
  const t = await getTranslations('form');
  const tp = await getTranslations('patients');
  // practice-plans (iteration 17, design D8): at the plan's limit no new patient, only the notice
  const usage = await currentPlanUsage();
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
      <PlanNotice usage={usage} />
      {usage?.state === 'reached' ? null : (
        <PatientForm initial={EMPTY_PATIENT} cancelHref="/patients" inputMode={await inputModeOf(user.id)} />
      )}
    </>
  );
}
