import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { treatmentsOf } from '@/lib/record';
import { recordSession } from '@/lib/record-session';

/** zone-record: Behandlungen (iteration 6, mockup view 2), newest first, read only */
export default async function Treatments() {
  const s = await recordSession();
  const [t, format, treatments] = await Promise.all([getTranslations('treatments'), getFormatter(), treatmentsOf(s)]);
  const date = (d: Date) => format.dateTime(d, { day: 'numeric', month: 'numeric', year: 'numeric' });
  return (
    <>
      <h1>{t('title')}</h1>
      <p className="sub">{t('sub')}</p>
      {treatments.length ? (
        treatments.map((tr) => (
          <Link key={tr.id} className="card tcard" href={`/behandlungen/${tr.id}`} data-testid="treatment">
            <h2>{tr.region}</h2>
            <dl className="kv num">
              <div>
                <dt>{t('started')}</dt>
                <dd>{date(tr.startedAt)}</dd>
              </div>
              <div>
                <dt>{t('diagnosis')}</dt>
                <dd>{tr.diagnosis}</dd>
              </div>
              <div>
                <dt>{t('painStart')}</dt>
                <dd>{t('pain', { n: tr.painStart })}</dd>
              </div>
              <div>
                <dt>{t('consultations')}</dt>
                <dd>
                  {tr.lastAt ? t('consultationsValue', { count: tr.consultations, date: date(tr.lastAt) }) : t('none')}
                </dd>
              </div>
            </dl>
          </Link>
        ))
      ) : (
        <section className="card">
          <h2>{t('empty')}</h2>
          <p className="muted">{t('emptyText')}</p>
        </section>
      )}
    </>
  );
}
