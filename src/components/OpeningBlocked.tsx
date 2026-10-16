import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Voraussetzungen (design D9): without an active record and a valid signed disclaimer no treatment or consultation
 * can be opened. For a missing signature the app offers the invitation to sign in the patient zone (iteration 6,
 * signing-zone-only: the record opens with the invitation dialog).
 */
export async function OpeningBlocked({ patientId, reason }: { patientId: string; reason: 'inactive' | 'consent' }) {
  const t = await getTranslations('treatments');
  const tr = await getTranslations('signatureInvite');
  const td = await getTranslations('done');
  return (
    <div className={`banner ${reason === 'inactive' ? 'warn' : 'err'}`} role="status">
      <p>{reason === 'inactive' ? t('blockedInactive') : t('blockedConsent')}</p>
      {reason === 'consent' ? (
        <Link className="btn btn--gold" href={`/patients/${patientId}?invite=1`}>
          {tr('invite')}
        </Link>
      ) : (
        <Link className="btn btn--dark" href={`/patients/${patientId}`}>
          {td('toRecord')}
        </Link>
      )}
    </div>
  );
}
