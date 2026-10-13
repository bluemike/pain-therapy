import { getTranslations } from 'next-intl/server';
import type { ExerciseHandout, HandoutDelivery } from '@prisma/client';
import { formatDateTime } from '@/lib/format';
import { resendHandout } from '@/app/(app)/handout-actions';

type Row = ExerciseHandout & { deliveries: HandoutDelivery[]; consultation: { number: number } };

/** Email status or printout of an exercise sheet (exercise-handout: Versand oder Ausdruck) */
async function HandoutDeliveryLine({ d, h }: { d?: HandoutDelivery; h: Row }) {
  const t = await getTranslations('documents');
  if (!d) return null;
  if (d.channel === 'PRINT')
    return (
      <>
        <span className="pill off">{t('printed', { at: formatDateTime(d.createdAt) })}</span>
      </>
    );
  const resend = (
    <form action={resendHandout} className="inline">
      <input type="hidden" name="handoutId" value={h.id} />
      <input type="hidden" name="patientId" value={h.patientId} />
      <button className="btn btn--ghost" style={{ minHeight: 36 }}>
        {t('resend')}
      </button>
    </form>
  );
  switch (d.status) {
    case 'SENT':
      return (
        <>
          <span className="pill ok">E-Mail</span>
          <span>{t('emailSent', { to: d.recipient ?? '', at: formatDateTime(d.sentAt) })}</span>
        </>
      );
    case 'FAILED':
      return (
        <>
          <span className="pill err">{t('emailFailed', { attempts: d.attempts })}</span>
          {resend}
        </>
      );
    case 'SKIPPED_NO_CONSENT':
      return (
        <>
          <span className="pill off">E-Mail</span>
          <span>{t('emailNoConsent')}</span>
        </>
      );
    case 'SKIPPED_NO_ADDRESS':
      return (
        <>
          <span className="pill off">E-Mail</span>
          <span>{t('emailNoAddress')}</span>
        </>
      );
    default:
      return (
        <>
          <span className="pill warn">E-Mail</span>
          <span>{t('emailPending')}</span>
        </>
      );
  }
}

/**
 * exercise-handout: Ablage in der Akte. Exercise sheets with document number and version; per consultation the
 * newest is "aktuell", older versions stay listed.
 */
export async function HandoutList({ handouts }: { handouts: Row[] }) {
  const [t, tc] = await Promise.all([getTranslations('documents'), getTranslations('common')]);
  const newest = new Map<string, number>();
  for (const h of handouts) newest.set(h.consultationId, Math.max(newest.get(h.consultationId) ?? 0, h.version));
  return (
    <>
      {handouts.map((h) => (
        <div className="doc" key={h.id} data-testid="handout">
          <div className="ico">PDF</div>
          <div style={{ minWidth: 0 }}>
            <b>{t('handoutTitle', { n: h.consultation.number })}</b>{' '}
            {newest.get(h.consultationId) === h.version ? (
              <span className="pill ok">{t('current')}</span>
            ) : (
              <span className="pill off">{t('olderVersion')}</span>
            )}
            <div className="meta num">
              <span>{t('createdOn', { at: formatDateTime(h.createdAt) })}</span>
              <span>{t('version', { version: h.version })}</span>
              <span>{t('documentNumber', { number: h.documentNumber })}</span>
              <span>{h.language.toUpperCase()}</span>
            </div>
            <div className="del">
              <HandoutDeliveryLine d={h.deliveries[0]} h={h} />
            </div>
          </div>
          <div className="act">
            <a className="btn btn--ghost" href={`/documents/${h.id}`} target="_blank" rel="noopener">
              {tc('openPdf')}
            </a>
          </div>
        </div>
      ))}
    </>
  );
}
