import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { abortIfOpen, getSession } from '@/lib/signing';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** After leaving patient mode: confirmation of the signed PDF, or the note that signing was aborted. */
export default async function SigningResult({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const actor = await requireUser();
  const { id, sid } = await params;
  await abortIfOpen(actor, sid);
  const s = await getSession(sid);
  if (!s || s.patientId !== id) notFound();
  const t = await getTranslations('done');
  const tc = await getTranslations('common');
  const tdoc = await getTranslations('documents');
  const name = `${s.patient.firstName} ${s.patient.lastName}`;

  if (s.status !== 'SIGNED' || !s.document) {
    return (
      <>
        <div className="crumb">
          <Link href={`/patients/${id}`}>← {name}</Link>
        </div>
        <div className="banner warn" role="status">
          <p>
            <b>{t('abortedTitle')}</b> · {t('abortedText', { name })}
          </p>
        </div>
        <div className="actions">
          <Link className="btn btn--gold" href={`/patients/${id}`}>
            {t('toRecord')}
          </Link>
        </div>
      </>
    );
  }
  const doc = s.document;
  const d = doc.deliveries[0];
  const consent = (k: string) => s.consents.find((c) => c.kind === k)?.granted;
  const pill = (ok?: boolean) => (
    <span className={`pill ${ok ? 'ok' : 'off'}`}>{ok ? t('granted') : t('notGranted')}</span>
  );
  const delivery =
    d?.status === 'SENT'
      ? tdoc('emailSent', { to: d.recipient ?? '', at: formatDateTime(d.sentAt) })
      : d?.status === 'PENDING'
        ? tdoc('emailPending')
        : d?.status === 'FAILED'
          ? tdoc('emailFailed', { attempts: d.attempts })
          : d?.status === 'SKIPPED_NO_ADDRESS'
            ? tdoc('emailNoAddress')
            : tdoc('emailNoConsent');
  const kv = (rows: [string, React.ReactNode][]) => (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <>
      <div className="crumb">
        <Link href={`/patients/${id}`}>← {name}</Link>
      </div>
      <div className="banner ok" role="status">
        <p>
          <b>{t('title')}</b> · {t('text', { name, at: formatDateTime(s.completedAt) })}
        </p>
      </div>
      <div className="confirm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <section className="card">
            <h2>{tdoc('title')}</h2>
            {kv([
              [
                t('documentNumber'),
                <span className="num" key="n">
                  {doc.documentNumber}
                </span>,
              ],
              [t('textVersion'), String(doc.textVersion)],
              [t('documentLanguage'), doc.language === 'en' ? tc('languageEn') : tc('languageDe')],
              [t('place'), s.place],
              [
                t('checksum'),
                <span className="mono" key="h">
                  {doc.sha256}
                </span>,
              ],
            ])}
          </section>
          <section className="card">
            <h2>{t('consents')}</h2>
            {kv([
              [t('consentLiability'), pill(consent('LIABILITY_WAIVER'))],
              [t('consentData'), pill(consent('DATA_PROCESSING'))],
              [t('consentEmail'), pill(consent('UNENCRYPTED_EMAIL'))],
            ])}
          </section>
          <section className="card">
            <h2>{t('delivery')}</h2>
            <div className="body">
              <span className={`pill ${d?.status === 'SENT' ? 'ok' : d?.status === 'FAILED' ? 'err' : 'off'}`}>
                E-Mail
              </span>{' '}
              {delivery}
            </div>
          </section>
          <section className="card">
            <h2>{t('patientNote')}</h2>
            <div className="body">
              {s.patientNote ? (
                <>
                  <p style={{ margin: '0 0 12px', fontSize: 16 }}>«{s.patientNote}»</p>
                  <div className="banner warn">
                    <p>{t('checkNote')}</p>
                    <Link className="btn btn--ghost" href={`/patients/${id}/edit`}>
                      {t('editDetails')}
                    </Link>
                  </div>
                </>
              ) : (
                <span className="muted">{t('noNote')}</span>
              )}
            </div>
          </section>
        </div>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <iframe className="pdfframe" src={`/documents/${doc.id}#toolbar=0&view=FitH`} title={doc.documentNumber} />
          <a className="btn btn--gold" href={`/documents/${doc.id}`} target="_blank" rel="noopener">
            {t('viewPdf')}
          </a>
          <Link className="btn btn--ghost" href={`/patients/${id}?tab=documents`}>
            {t('toRecord')}
          </Link>
        </aside>
      </div>
    </>
  );
}
