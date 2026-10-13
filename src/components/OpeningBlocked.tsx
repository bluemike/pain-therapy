import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { handOver } from '@/app/(app)/actions';
import { TabletIcon } from './Icons';

/**
 * Voraussetzungen (design D9): without an active record and a valid signed disclaimer no treatment or consultation
 * can be opened. For a missing signature the app offers to hand the device to the patient.
 */
export async function OpeningBlocked({ patientId, reason }: { patientId: string; reason: 'inactive' | 'consent' }) {
  const t = await getTranslations('treatments');
  const tr = await getTranslations('record');
  const td = await getTranslations('done');
  return (
    <div className={`banner ${reason === 'inactive' ? 'warn' : 'err'}`} role="status">
      <p>{reason === 'inactive' ? t('blockedInactive') : t('blockedConsent')}</p>
      {reason === 'consent' ? (
        <form action={handOver}>
          <input type="hidden" name="id" value={patientId} />
          <button className="btn btn--gold">
            <TabletIcon />
            {tr('handOver')}
          </button>
        </form>
      ) : (
        <Link className="btn btn--dark" href={`/patients/${patientId}`}>
          {td('toRecord')}
        </Link>
      )}
    </div>
  );
}
