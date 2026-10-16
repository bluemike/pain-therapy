import { getFormatter, getTranslations } from 'next-intl/server';
import { documentsOf } from '@/lib/record';
import { recordSession } from '@/lib/record-session';

/**
 * zone-documents: Dokumente der Patientin (iteration 6, mockup view 4). Exercise sheets and signed disclaimers,
 * newest first; the newest version of a consultation's sheet is "aktuell". Each link opens the archived PDF.
 */
export default async function Documents() {
  const s = await recordSession();
  const [t, format, docs] = await Promise.all([getTranslations('documents'), getFormatter(), documentsOf(s)]);
  const date = (d: Date) => format.dateTime(d, { day: 'numeric', month: 'numeric', year: 'numeric' });
  const doc = (nr: string, name: string, at: Date, extra: React.ReactNode, details: string) => (
    <li key={nr}>
      <a className="doc" href={`/dokumente/${nr}`} aria-label={t('openLabel', { name, date: date(at) })}>
        <span className="ic" aria-hidden="true">
          PDF
        </span>
        <span>
          <b>{name}</b> {extra}
          <small className="num">{details}</small>
        </span>
        <span className="go" aria-hidden="true">
          {t('open')}
        </span>
      </a>
    </li>
  );
  return (
    <>
      <h1>{t('title')}</h1>
      <p className="sub">{t('sub')}</p>
      <section className="card" aria-labelledby="h_sheets">
        <h2 id="h_sheets">{t('sheets')}</h2>
        {docs.sheets.length ? (
          <ul className="docs" data-testid="sheets">
            {docs.sheets.map((h) =>
              doc(
                h.documentNumber,
                t('sheet', { n: h.consultation }),
                h.date,
                h.current ? <span className="pill ok">{t('current')}</span> : null,
                `${date(h.date)} · ${h.documentNumber} · ${t('version', { n: h.version })}`,
              ),
            )}
          </ul>
        ) : (
          <p className="muted">{t('noSheets')}</p>
        )}
      </section>
      <section className="card" aria-labelledby="h_disclaimers">
        <h2 id="h_disclaimers">{t('disclaimers')}</h2>
        {docs.pending.length || docs.disclaimers.length ? (
          <ul className="docs" data-testid="disclaimers">
            {docs.pending.map((p) => (
              <li key={p.id} className="doc pending" data-testid="pending">
                <span className="ic" aria-hidden="true">
                  PDF
                </span>
                <span>
                  <b>{t('pending')}</b>
                  <small className="num">{t('pendingText', { date: p.date ? date(p.date) : '' })}</small>
                </span>
              </li>
            ))}
            {docs.disclaimers.map((d) =>
              doc(
                d.documentNumber,
                t('disclaimer', { n: d.textVersion }),
                d.date,
                null,
                `${date(d.date)} · ${d.documentNumber} · ${t(d.channel)}`,
              ),
            )}
          </ul>
        ) : (
          <p className="muted">{t('noDisclaimer')}</p>
        )}
      </section>
    </>
  );
}
