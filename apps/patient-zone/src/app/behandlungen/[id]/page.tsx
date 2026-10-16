import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { repetitionParts } from '@pain-therapy/shared/home-program';
import { treatmentOf } from '@/lib/record';
import { recordSession } from '@/lib/record-session';

/** Width class of a pain value in steps of 10 % (no inline styles, design D5 and D14) */
const width = (v: number | null) => `w${Math.min(100, Math.max(0, Math.round((v ?? 0) / 10) * 10))}`;

/**
 * zone-record: Konsultationen einer Behandlung (iteration 6, mockup view 3), newest first, with the pain course. No
 * photos, anamnesis or staff names; an id of another patient is "not found" like an unknown one.
 */
export default async function Treatment({ params }: { params: Promise<{ id: string }> }) {
  const s = await recordSession();
  const { id } = await params;
  const tr = await treatmentOf(s, id);
  if (!tr) notFound();
  const [t, format] = await Promise.all([getTranslations('treatment'), getFormatter()]);
  const date = (d: Date) => format.dateTime(d, { day: 'numeric', month: 'numeric', year: 'numeric' });
  const when = (d: Date) =>
    format.dateTime(d, {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const pct = (v: number | null) => (v === null ? '–' : `${v} %`);
  const range = (b: number | null, a: number | null) =>
    b === null && a === null ? t('notRecorded') : t('range', { before: pct(b), after: pct(a) });
  const course = [...tr.consultations].reverse();
  return (
    <>
      <p className="crumb">
        <Link href="/behandlungen">‹ {t('back')}</Link>
      </p>
      <h1>{tr.region}</h1>
      <p className="sub num">{t('since', { date: date(tr.startedAt), pain: tr.painStart })}</p>
      <p>{tr.diagnosis}</p>
      {course.length ? (
        <section className="card" aria-labelledby="h_course">
          <h2 id="h_course">{t('course')}</h2>
          <ul className="course num">
            {course.map((c) => (
              <li key={c.id}>
                <span>{t('nr', { n: c.number })}</span>
                <span className="track" aria-hidden="true">
                  <span className={`b ${width(c.painBefore)}`} />
                  <span className={`a ${width(c.painAfter)}`} />
                </span>
                <span>{range(c.painBefore, c.painAfter)}</span>
              </li>
            ))}
          </ul>
          <p className="legend" aria-hidden="true">
            <span>
              <i />
              {t('before')}
            </span>
            <span>
              <i className="a" />
              {t('after')}
            </span>
          </p>
        </section>
      ) : (
        <p className="muted">{t('noConsultations')}</p>
      )}
      {tr.consultations.map((c) => (
        <section className="cons" key={c.id} aria-labelledby={`h_${c.id}`} data-testid="consultation">
          <h2 id={`h_${c.id}`}>{t('consultation', { n: c.number })}</h2>
          <p className="meta num">{t('meta', { date: when(c.at), range: range(c.painBefore, c.painAfter) })}</p>
          <dl className="kv">
            <div>
              <dt>{t('diagnosis')}</dt>
              <dd>{c.diagnosis || t('notRecorded')}</dd>
            </div>
            <div>
              <dt>{t('comparison')}</dt>
              <dd>{c.comparison || t('notRecorded')}</dd>
            </div>
          </dl>
          {c.points.length ? (
            <>
              <h3>{t('points')}</h3>
              <ul className="tags num">
                {c.points.map((p) => (
                  <li key={p.id}>
                    {p.id} {p.name}
                    {p.left || p.right
                      ? ` (${[p.left ? t('left') : null, p.right ? t('right') : null].filter(Boolean).join(', ')})`
                      : ''}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {c.exercises.length ? (
            <>
              <h3>{t('exercises')}</h3>
              <ul className="tags">
                {c.exercises.map((x) => (
                  <li key={x.code}>
                    {x.code} {x.name}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {c.rolling.length ? (
            <>
              <h3>{t('rolling')}</h3>
              <ul className="tags">
                {c.rolling.map((r, i) => (
                  <li key={i}>{[r.tool, r.area].filter(Boolean).join(', ')}</li>
                ))}
              </ul>
            </>
          ) : null}
          {c.home.length ? (
            <>
              <h3>{t('home')}</h3>
              <ul className="tags">
                {c.home.map((h) => {
                  const { daily, times } = repetitionParts(h.repetition);
                  return (
                    <li key={h.code}>
                      {h.code} {t(daily ? 'repDaily' : 'repWeekly', { n: times })}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
          {c.sheet ? (
            <a className="btn" href={`/dokumente/${c.sheet}`}>
              {t('sheet', { nr: c.sheet })}
            </a>
          ) : null}
        </section>
      ))}
    </>
  );
}
