import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { repetitionParts } from '@pain-therapy/shared/home-program';
import { chosenDay, dayReference } from '@pain-therapy/shared/log-entry';
import { PROGRAM_ACTIVE_WEEKS } from '@pain-therapy/shared/program';
import { addDays, dayKey, fromZurichInputs, zurichInputs } from '@pain-therapy/shared/time';
import { redirect } from 'next/navigation';
import { programSession, touchSession } from '@/lib/access';
import { zoneAudit } from '@/lib/audit';
import { recentEntries, today } from '@/lib/entries';
import { getZoneSession } from '@/lib/session';
import { EntryForm } from '@/components/EntryForm';
import { quickEntryAction, deleteEntryAction } from './actions';

/**
 * exercise-log: the exercises of a day and the entries of the program (mockup view 2; iteration 6 mockup view 1 with
 * the day selection of zone-exercise-backfill, design D7). Without a session a neutral start page that asks for the
 * personal link; without an active home program the record (zone-record, design D6). Every view is logged.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; n?: string; err?: string; out?: string; tag?: string }>;
}) {
  const sp = await searchParams;
  const zone = await getZoneSession();
  // zone-consent-signing: Unterschrift vor den Übungen (iteration 5, design D5)
  if (zone?.signaturePending) redirect('/unterschrift');
  const s = programSession(zone);
  if (zone && !s) redirect('/behandlungen');
  if (!s) {
    const t = await getTranslations('start');
    return (
      <>
        {sp.out === '1' ? (
          <div className="banner ok" role="status">
            {t('signedOut')}
          </div>
        ) : null}
        <h1>{t('title')}</h1>
        <p>{t('text')}</p>
      </>
    );
  }
  const now = new Date();
  await touchSession(s, now);
  await zoneAudit('zone.viewed', { patientId: s.patient.id, linkId: s.session.linkId });
  const day = chosenDay(sp.tag, s.program.consultationAt, now);
  const ref = dayReference(day.day, s.program.consultationAt, now);
  const [t, td, format, { items, open }, recent] = await Promise.all([
    getTranslations('home'),
    getTranslations('day'),
    getFormatter(),
    today(s, ref),
    recentEntries(s, now),
  ]);
  const dateOf = (key: string) => fromZurichInputs(key, '12:00')!;
  const long = (key: string) =>
    format.dateTime(dateOf(key), { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' });
  const dayTitle = day.today
    ? td('today')
    : day.day === addDays(day.last, -1)
      ? `${td('yesterday')}, ${long(day.day)}`
      : long(day.day);
  const until = new Date(s.program.consultationAt.getTime() + PROGRAM_ACTIVE_WEEKS * 7 * 86400_000);
  const tagField = day.today ? undefined : day.day;
  const daily = items.filter((i) => i.progress.period === 'today');
  const dailyTotal = daily.reduce((a, i) => a + i.progress.target, 0);
  const dailyDone = daily.reduce((a, i) => a + Math.min(i.progress.target, i.progress.done), 0);
  const inputs = zurichInputs(ref);
  const flash =
    sp.ok === 'saved'
      ? t('saved')
      : sp.ok === 'corrected'
        ? t('corrected')
        : sp.ok === 'deleted'
          ? t('deleted')
          : sp.ok === 'quick'
            ? !Number(sp.n)
              ? t('quickNothing')
              : day.today
                ? t('quickDone', { count: Number(sp.n) })
                : td('quickDone', { count: Number(sp.n), date: long(day.day) })
            : null;
  const rep = (r: (typeof items)[number]['repetition']) => {
    const { daily: d, times } = repetitionParts(r);
    return t(d ? 'repDaily' : 'repWeekly', { n: times });
  };
  const todayKey = dayKey(now);
  const days = new Map<string, typeof recent>();
  for (const e of recent) {
    const k = dayKey(e.performedAt);
    days.set(k, [...(days.get(k) ?? []), e]);
  }
  return (
    <>
      {flash ? (
        <div className="banner ok" role="status">
          {flash}
        </div>
      ) : null}
      {sp.err === 'notEditable' ? (
        <div className="banner err" role="alert">
          {t('notEditable')}
        </div>
      ) : null}
      <h1>{t('greeting', { name: s.patient.firstName })}</h1>
      <p className="sub">
        {td('program', {
          since: format.dateTime(s.program.consultationAt, { weekday: 'short', day: 'numeric', month: 'numeric' }),
          until: format.dateTime(until, { day: 'numeric', month: 'numeric', year: 'numeric' }),
        })}
      </p>
      <nav className="daynav" aria-label={td('choose')}>
        {day.previous ? (
          <Link className="btn" href={`/?tag=${day.previous}`} aria-label={td('previous')}>
            ‹
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
        <form method="get" action="/" className="day">
          <b data-testid="day">{dayTitle}</b>
          <label className="sr" htmlFor="tag">
            {td('choose')}
          </label>
          <input id="tag" type="date" name="tag" defaultValue={day.day} min={day.first} max={day.last} />
          <button className="linkbtn">{td('show')}</button>
        </form>
        {day.next ? (
          <Link className="btn" href={day.next === day.last ? '/' : `/?tag=${day.next}`} aria-label={td('next')}>
            ›
          </Link>
        ) : (
          <span aria-hidden="true" />
        )}
      </nav>
      <p className="sub">
        {dailyTotal
          ? day.today
            ? t('todaySummary', { done: dailyDone, total: dailyTotal })
            : td('summary', { done: dailyDone, total: dailyTotal })
          : t('weeklyOnly')}
      </p>
      {open.length ? (
        <form action={quickEntryAction}>
          {tagField ? <input type="hidden" name="tag" value={tagField} /> : null}
          <button className="btn btn--gold btn--block">{day.today ? t('quick') : td('quick')}</button>
        </form>
      ) : null}

      <section className="card" aria-labelledby="h_ex">
        <h2 id="h_ex">{t('exercises')}</h2>
        <ul className="exlist">
          {items.map((it) => (
            <li className="ex" key={it.code} data-code={it.code}>
              <div className="head">
                {it.hasImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private image, only with a session
                  <img src={`/media/${it.code}`} alt={t('imageOf', { code: it.code })} width={64} height={52} />
                ) : (
                  <span className="ph">{t('noImage')}</span>
                )}
                <div>
                  <b>{it.code}</b> {it.name}
                  <small>
                    {rep(it.repetition)} · {t('perExecution', { min: format.number(Math.round(it.seconds / 6) / 10) })}
                  </small>
                </div>
              </div>
              <div className="prog">
                <span className={`pill ${it.progress.complete ? 'ok' : ''}`} data-testid="progress">
                  {day.today
                    ? t(it.progress.period === 'today' ? 'progressToday' : 'progressWeek', {
                        done: it.progress.done,
                        target: it.progress.target,
                      })
                    : td(it.progress.period === 'today' ? 'progressDay' : 'progressWeekOf', {
                        done: it.progress.done,
                        target: it.progress.target,
                      })}
                </span>
              </div>
              <details className="rec">
                <summary className="btn">
                  {t('record')}
                  <span className="sr"> {it.code}</span>
                </summary>
                <EntryForm
                  mode="create"
                  code={it.code}
                  defaults={{ done: true, rating: null, date: inputs.date, time: inputs.time, note: '' }}
                  minDate={day.first}
                  maxDate={day.last}
                  tag={tagField}
                />
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="h_recent">
        <h2 id="h_recent">
          {td('entries', {
            date: format.dateTime(s.program.consultationAt, { day: 'numeric', month: 'numeric', year: 'numeric' }),
          })}
        </h2>
        {days.size ? (
          [...days.entries()].map(([k, list]) => (
            <div key={k}>
              <h3 className="dayhd">
                {k === todayKey
                  ? t('today')
                  : format.dateTime(list[0].performedAt, { weekday: 'short', day: '2-digit', month: '2-digit' })}
              </h3>
              <ul className="log">
                {list.map((e) => (
                  <li key={e.id} data-testid="entry" data-code={e.exerciseCode}>
                    <span>
                      <b>{e.exerciseCode}</b> {e.name}
                      <small>
                        {t('at', { time: e.inputs.time })}
                        {e.note ? ` · ${e.note}` : ''}
                      </small>
                    </span>
                    <span className="res">
                      {e.done ? (
                        <>
                          <span className="pill ok">{t('done')}</span>{' '}
                          {e.rating ? <b className="num">{e.rating}/10</b> : <small>{t('noRating')}</small>}
                        </>
                      ) : (
                        <span className="pill">{t('notDone')}</span>
                      )}
                    </span>
                    {e.editable ? (
                      <div className="acts">
                        <details className="rec">
                          <summary className="linkbtn">
                            {t('change')}
                            <span className="sr">
                              {' '}
                              {e.exerciseCode} {e.inputs.time}
                            </span>
                          </summary>
                          <EntryForm
                            mode="correct"
                            code={e.exerciseCode}
                            entryId={e.id}
                            defaults={{
                              done: e.done,
                              rating: e.rating,
                              date: e.inputs.date,
                              time: e.inputs.time,
                              note: e.note ?? '',
                            }}
                            minDate={day.first}
                            maxDate={day.last}
                            tag={tagField}
                          />
                        </details>
                        <form action={deleteEntryAction}>
                          <input type="hidden" name="id" value={e.id} />
                          {tagField ? <input type="hidden" name="tag" value={tagField} /> : null}
                          <button
                            className="linkbtn"
                            aria-label={t('deleteOf', { code: e.exerciseCode, time: e.inputs.time })}
                          >
                            {t('delete')}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="muted">{t('noEntries')}</p>
        )}
        <p className="lbl">{t('editHint')}</p>
        <p className="lbl">{td('backfillHint')}</p>
      </section>
    </>
  );
}
