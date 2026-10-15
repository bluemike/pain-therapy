import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { touchSession } from '@/lib/access';
import { zoneAudit } from '@/lib/audit';
import { getZoneSession } from '@/lib/session';

/**
 * zone-consent-signing: Unterschrift vor den Übungen (mockup view 3). While a signature is pending this task is all
 * the patient zone shows.
 */
export default async function SignatureTask() {
  const s = await getZoneSession();
  if (!s?.signaturePending) redirect('/');
  await touchSession(s);
  await zoneAudit('zone.viewed', { patientId: s.patient.id, linkId: s.session.linkId });
  const t = await getTranslations('signTask');
  return (
    <>
      <h1>{t('greeting', { name: s.patient.firstName })}</h1>
      <section className="card task" aria-labelledby="h_task">
        <h2 id="h_task">{t('title')}</h2>
        <p>{t('text')}</p>
        <Link className="btn btn--gold btn--block" href="/unterschrift/formular">
          {t('open')}
        </Link>
      </section>
      {!s.program?.active ? <p className="muted">{t('exercisesLater')}</p> : null}
    </>
  );
}
