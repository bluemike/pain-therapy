import { getFormatter, getTranslations } from 'next-intl/server';
import { repetitionParts } from '@pain-therapy/shared/home-program';
import { dayKey, zurichInputs } from '@pain-therapy/shared/time';
import { touchSession } from '@/lib/access';
import { zoneAudit } from '@/lib/audit';
import { recentEntries, today } from '@/lib/entries';
import { getZoneSession } from '@/lib/session';
import { EntryForm } from '@/components/EntryForm';
import { quickEntryAction, deleteEntryAction } from './actions';

/**
 * exercise-log: Heute and Letzte 14 Tage (mockup view 2). Without a session a neutral start page that asks for the
 * personal link. Every view is logged (Zugriff protokolliert).
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; n?: string; err?: string; out?: string }>;
}) {
  const sp = await searchParams;
  const s = await getZoneSession();
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
  const [t, format, { items, open }, recent] = await Promise.all([
    getTranslations('home'),
    getFormatter(),
    today(s, now),
    recentEntries(s, now),
  ]);
  const daily = items.filter((i) => i.progress.period === 'today');
  const dailyTotal = daily.reduce((a, i) => a + i.progress.target, 0);
  const dailyDone = daily.reduce((a, i) => a + Math.min(i.progress.target, i.progress.done), 0);
  const inputs = zurichInputs(now);
  const flash =
    sp.ok === 'saved'
      ? t('saved')
      : sp.ok === 'corrected'
        ? t('corrected')
        : sp.ok === 'deleted'
          ? t('deleted')
          : sp.ok === 'quick'
            ? Number(sp.n)
              ? t('quickDone', { count: Number(sp.n) })
              : t('quickNothing')
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
      <p className="sub">{dailyTotal ? t('todaySummary', { done: dailyDone, total: dailyTotal }) : t('weeklyOnly')}</p>
      {open.length ? (
        <form action={quickEntryAction}>
          <button className="btn btn--gold btn--block">{t('quick')}</button>
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
                  {t(it.progress.period === 'today' ? 'progressToday' : 'progressWeek', {
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
                  maxDate={inputs.date}
                />
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="card" aria-labelledby="h_recent">
        <h2 id="h_recent">{t('recent')}</h2>
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
                            maxDate={inputs.date}
                          />
                        </details>
                        <form action={deleteEntryAction}>
                          <input type="hidden" name="id" value={e.id} />
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
      </section>
    </>
  );
}
