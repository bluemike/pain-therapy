import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock, PenLine } from 'lucide-react';
import { progress } from '@pain-therapy/shared/adherence';
import { scheduleParts, scheduledOn, weekdayIndex } from '@pain-therapy/shared/home-program';
import { chosenDay, dayReference } from '@pain-therapy/shared/log-entry';
import { PROGRAM_ACTIVE_WEEKS } from '@pain-therapy/shared/program';
import { addDays, dayKey, fromZurichInputs, zurichInputs } from '@pain-therapy/shared/time';
import { redirect } from 'next/navigation';
import { programSession, touchSession } from '@/lib/access';
import { zoneAudit } from '@/lib/audit';
import { recentEntries, today } from '@/lib/entries';
import { getZoneSession } from '@/lib/session';
import { EntryForm } from '@/components/EntryForm';
import { ZoneAudio } from '@/components/ZoneAudio';
import { quickEntryAction, deleteEntryAction, tickAction } from './actions';

/**
 * exercise-log: the exercises of a day and the entries of the program (mockup view 2; iteration 6 mockup view 1 with
 * the day selection of zone-exercise-backfill, design D7). Without a session a neutral start page that asks for the
 * personal link; without an active home program the record (zone-record, design D6). Every view is logged.
 *
 * zone-record (iteration 9, design D8): with several running treatments one home program each, chosen by the pain
 * area at the top ("b" = treatment); with one the page looks as before.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; n?: string; c?: string; err?: string; out?: string; tag?: string; b?: string }>;
}) {
  const sp = await searchParams;
  const zone = await getZoneSession();
  // zone-consent-signing: Unterschrift vor den Übungen (iteration 5, design D5)
  if (zone?.signaturePending) redirect('/unterschrift');
  const s = programSession(zone, sp.b);
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
  const [t, td, format, { items, entries, open }, recent] = await Promise.all([
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
  const many = s.programs.length > 1;
  const programField = many ? s.program.treatmentId : undefined;
  const bq = many ? `b=${encodeURIComponent(s.program.treatmentId)}` : '';
  const home = (tag?: string) => (tag ? `/?tag=${tag}${bq ? `&${bq}` : ''}` : bq ? `/?${bq}` : '/');
  const regionName = (r: (typeof s.program)['region']) => (s.patient.preferredLanguage === 'en' ? r.nameEn : r.nameDe);
  // Only the exercises prescribed on this weekday count (iteration 8, design D8)
  const dailyTotal = items.reduce((a, i) => a + i.progress.target, 0);
  const dailyDone = items.reduce((a, i) => a + Math.min(i.progress.target, i.progress.done), 0);
  const inputs = zurichInputs(ref);
  const flash =
    sp.ok === 'saved'
      ? t('saved')
      : sp.ok === 'corrected'
        ? t('corrected')
        : sp.ok === 'deleted'
          ? t('deleted')
          : sp.ok === 'tick' && sp.c
            ? t('tickDone', { code: sp.c.slice(0, 3) })
            : sp.ok === 'quick'
              ? !Number(sp.n)
                ? t('quickNothing')
                : day.today
                  ? t('quickDone', { count: Number(sp.n) })
                  : td('quickDone', { count: Number(sp.n), date: long(day.day) })
              : null;
  /** "2× pro Tag · Mo Di Mi Do Fr" */
  const rep = (sch: (typeof items)[number]['schedule']) => {
    const p = scheduleParts(sch);
    const days = p.everyDay ? t('everyDay') : p.days.map((d) => t(`short_${d}`)).join(' ');
    return `${t('timesPerDay', { n: p.timesPerDay })} · ${days}`;
  };
  const epd = (v: number | null) => (v ? t('epdVariant', { n: v }) : t('epdStandard'));
  const todayKey = dayKey(now);
  // Iteration 14 (mockup «Heute dran»): the exercises of the day as cards, the free ones in a compact list below
  const due = items.filter((i) => i.progress.target > 0);
  const free = items.filter((i) => i.progress.target === 0);
  /** Next selected weekday after the chosen day, e.g. "Montag" */
  const nextTime = (sch: (typeof items)[number]['schedule']) => {
    for (let i = 1; i <= 7; i++) {
      const k = addDays(day.day, i);
      if (scheduledOn(sch, k)) return format.dateTime(dateOf(k), { weekday: 'long' });
    }
    return null;
  };
  /** The week of the chosen day, Monday to Sunday, with the state of each day (done, partly, open, free) */
  const monday = addDays(day.day, -weekdayIndex(day.day));
  const week = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(monday, i);
    const inRange = key >= day.first && key <= day.last;
    const at = dayReference(key, s.program.consultationAt, now);
    let target = 0;
    let done = 0;
    if (inRange)
      for (const p of s.program.prescriptions) {
        const pr = progress(p, entries, at);
        target += pr.target;
        done += Math.min(pr.target, pr.done);
      }
    const state = !inRange || !target ? 'free' : done >= target ? 'full' : done > 0 ? 'part' : 'none';
    const d = dateOf(key);
    return {
      key,
      inRange,
      state,
      wd: format.dateTime(d, { weekday: 'short' }).replace('.', ''),
      n: format.dateTime(d, { day: 'numeric' }).replace('.', ''),
      label: `${long(key)}: ${target ? t('ofDone', { done, total: target }) : t('noExercise')}`,
    };
  });
  const image = (it: (typeof items)[number]) =>
    it.hasImage ? (
      // eslint-disable-next-line @next/next/no-img-element -- private image, only with a session
      <img src={`/media/${it.code}`} alt={t('imageOf', { code: it.code })} />
    ) : (
      <span className="ph">{t('noImage')}</span>
    );
  const guide = (it: (typeof items)[number]) =>
    it.guide ? (
      <details className="guide">
        <summary className="tool">
          <BookOpen size={17} aria-hidden="true" />
          {t('guide')}
          <span className="sr"> {it.code}</span>
        </summary>
        <h3>
          {t('frm')}
          {it.guide.tools.length ? ` · ${it.guide.tools.join(', ')}` : ''}
        </h3>
        {/* eslint-disable-next-line @next/next/no-img-element -- private image, only with a session */}
        <img
          className="band"
          src={`/media/${it.code}?teil=frm`}
          alt={t('bandOf', { code: it.code, part: t('frm') })}
          loading="lazy"
        />
        {it.guide.segments?.frm.items.map((x, i) => (
          <p key={i}>
            {x.n.length ? <b>({x.n.join('/')}) </b> : null}
            {x.text}
          </p>
        ))}
        <h3>
          {t('epd')} · {epd(it.variant)}
          {it.guide.aids.length ? ` · ${it.guide.aids.join(', ')}` : ''}
        </h3>
        {/* eslint-disable-next-line @next/next/no-img-element -- private image, only with a session */}
        <img
          className="band"
          src={`/media/${it.code}?teil=${it.variant ? 'var' : 'std'}`}
          alt={t('bandOf', { code: it.code, part: t('epd') })}
          loading="lazy"
        />
        {it.guide.segments && !it.variant ? (
          <>
            {it.guide.segments.standard.intro ? <p>{it.guide.segments.standard.intro}</p> : null}
            {it.guide.segments.standard.steps.map((st, i) => (
              <p key={i}>
                {st.label ? <b>{st.label}: </b> : null}
                {st.text}
              </p>
            ))}
          </>
        ) : null}
        {it.guide.segments && it.variant ? (
          <>
            {it.guide.segments.variants.intro ? <p>{it.guide.segments.variants.intro}</p> : null}
            {it.guide.segments.variants.items
              .filter((v) => v.number === it.variant)
              .map((v) => (
                <p key={v.number} className="chosen">
                  <b>{t('epdVariant', { n: v.number })}: </b>
                  {v.text}
                </p>
              ))}
          </>
        ) : null}
        {!it.guide.segments ? <p className="muted">{t('guideMissing')}</p> : null}
      </details>
    ) : null;
  // Keyed by the day (on the list item), so the forms start again with the date of a newly chosen day
  const record = (it: (typeof items)[number], label: string) => (
    <details className="rec">
      <summary className="btn">
        <PenLine size={16} aria-hidden="true" />
        {label}
        <span className="sr"> {it.code}</span>
      </summary>
      <EntryForm
        mode="create"
        code={it.code}
        defaults={{ done: true, rating: null, date: inputs.date, time: inputs.time, note: '' }}
        minDate={day.first}
        maxDate={day.last}
        tag={tagField}
        program={programField}
      />
    </details>
  );
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
      {many ? (
        <nav className="programs" aria-label={t('programs')}>
          {s.programs.map((x) => (
            <Link
              key={x.treatmentId}
              className={`btn${x.treatmentId === s.program.treatmentId ? ' on' : ''}`}
              aria-current={x.treatmentId === s.program.treatmentId ? 'page' : undefined}
              href={`/?b=${encodeURIComponent(x.treatmentId)}`}
            >
              {regionName(x.region)}
            </Link>
          ))}
        </nav>
      ) : null}
      {many ? <h2 className="progtitle">{regionName(s.program.region)}</h2> : null}
      <p className="sub">
        {td('program', {
          since: format.dateTime(s.program.consultationAt, { weekday: 'short', day: 'numeric', month: 'numeric' }),
          until: format.dateTime(until, { day: 'numeric', month: 'numeric', year: 'numeric' }),
        })}
      </p>

      <div className="zgrid">
        <div className="zside">
          <nav className="week" aria-label={td('choose')}>
            {day.previous ? (
              <Link className="wkarrow" href={home(day.previous)} aria-label={td('previous')}>
                <ChevronLeft size={20} aria-hidden="true" />
              </Link>
            ) : (
              <span className="wkarrow" aria-hidden="true" />
            )}
            <ol className="wkdays">
              {week.map((w) => (
                <li key={w.key}>
                  {w.inRange ? (
                    <Link
                      href={home(w.key === day.last ? undefined : w.key)}
                      className={`wkday ${w.state}${w.key === day.day ? ' on' : ''}`}
                      aria-current={w.key === day.day ? 'date' : undefined}
                      aria-label={w.label}
                    >
                      <span className="wd">{w.wd}</span>
                      <span className="n">{w.n}</span>
                      <span className="dot" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="wkday off" aria-hidden="true">
                      <span className="wd">{w.wd}</span>
                      <span className="n">{w.n}</span>
                      <span className="dot" />
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {day.next ? (
              <Link
                className="wkarrow"
                href={home(day.next === day.last ? undefined : day.next)}
                aria-label={td('next')}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </Link>
            ) : (
              <span className="wkarrow" aria-hidden="true" />
            )}
          </nav>

          <section className="card dayprog" aria-labelledby="h_dayprog">
            <div className="row">
              <h2 id="h_dayprog" data-testid="day">
                {dayTitle}
              </h2>
              <span className="num">{t('ofDone', { done: dailyDone, total: dailyTotal })}</span>
            </div>
            <div
              className="bar"
              role="progressbar"
              aria-label={t('progressLabel')}
              aria-valuemin={0}
              aria-valuemax={dailyTotal || 1}
              aria-valuenow={dailyDone}
            >
              <span style={{ width: `${dailyTotal ? Math.round((100 * dailyDone) / dailyTotal) : 0}%` }} />
            </div>
            <p className="sub">
              {dailyTotal
                ? day.today
                  ? t('todaySummary', { done: dailyDone, total: dailyTotal })
                  : td('summary', { done: dailyDone, total: dailyTotal })
                : day.today
                  ? t('freeDay')
                  : td('freeDay')}
            </p>
            {open.length > 1 ? (
              <form action={quickEntryAction}>
                {tagField ? <input type="hidden" name="tag" value={tagField} /> : null}
                {programField ? <input type="hidden" name="b" value={programField} /> : null}
                <button className="btn btn--block">{day.today ? t('quick') : td('quick')}</button>
              </form>
            ) : null}
          </section>
          <p className="lbl wkhint">{t('weekHint')}</p>
        </div>

        <div className="zmain">
          {due.length ? (
            <section aria-labelledby="h_due">
              <h2 id="h_due" className="sect">
                {day.today ? t('due') : td('due')}
              </h2>
              <ul className="exlist cards">
                {due.map((it) => (
                  <li
                    className={`ex excard${it.progress.complete ? ' complete' : ''}`}
                    key={`${it.code}-${day.day}`}
                    data-code={it.code}
                  >
                    <div className="head">
                      {image(it)}
                      <div className="what">
                        <b className="name">
                          {it.code} {it.name}
                        </b>
                        <small>{t('parts', { epd: epd(it.variant) })}</small>
                        <small className="when">
                          <Clock size={14} aria-hidden="true" /> {rep(it.schedule)} ·{' '}
                          {t('perExecution', { min: format.number(Math.round(it.seconds / 60)) })}
                        </small>
                      </div>
                    </div>
                    <div className="slots">
                      {Array.from({ length: it.progress.target }, (_, i) => (
                        <span key={i} className={`slot${i < it.progress.done ? ' done' : ''}`} aria-hidden="true">
                          {i < it.progress.done ? <Check size={15} strokeWidth={3} /> : null}
                        </span>
                      ))}
                      <span className={`pill ${it.progress.complete ? 'ok' : ''}`} data-testid="progress">
                        {it.progress.complete
                          ? day.today
                            ? t('completeToday', { done: it.progress.done })
                            : td('progressDay', { done: it.progress.done, target: it.progress.target })
                          : day.today
                            ? t('progressToday', { done: it.progress.done, target: it.progress.target })
                            : td('progressDay', { done: it.progress.done, target: it.progress.target })}
                      </span>
                    </div>
                    <div className="acts">
                      <form action={tickAction} className="tick">
                        <input type="hidden" name="code" value={it.code} />
                        {tagField ? <input type="hidden" name="tag" value={tagField} /> : null}
                        {programField ? <input type="hidden" name="b" value={programField} /> : null}
                        <button
                          className={`btn ${it.progress.complete ? 'btn--done' : 'btn--gold'}`}
                          disabled={it.progress.complete}
                          aria-label={t(it.progress.complete ? 'tickedOf' : 'tickOf', { code: it.code })}
                        >
                          <Check size={18} strokeWidth={2.5} aria-hidden="true" />
                          <span aria-hidden="true">{t(it.progress.complete ? 'ticked' : 'tick')}</span>
                        </button>
                      </form>
                      <ZoneAudio code={it.code} program={programField} />
                    </div>
                    {guide(it)}
                    {record(it, t('recordRated'))}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {free.length ? (
            <section aria-labelledby="h_free">
              <h2 id="h_free" className="sect">
                {day.today ? t('free') : td('free')}
              </h2>
              <ul className="exlist frees">
                {free.map((it) => (
                  <li className="ex exfree" key={`${it.code}-${day.day}`} data-code={it.code}>
                    <div className="head">
                      {image(it)}
                      <div className="what">
                        <b className="name">
                          {it.code} {it.name}
                        </b>
                        <small>{t('parts', { epd: epd(it.variant) })}</small>
                        <small>
                          {nextTime(it.schedule) ? `${t('nextTime', { day: nextTime(it.schedule)! })} · ` : ''}
                          <span className="pill" data-testid="progress">
                            {t('notScheduled', { done: it.progress.done })}
                          </span>
                        </small>
                      </div>
                    </div>
                    {guide(it)}
                    {record(it, t('recordAnyway'))}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

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
                            program={programField}
                          />
                        </details>
                        <form action={deleteEntryAction}>
                          <input type="hidden" name="id" value={e.id} />
                          {tagField ? <input type="hidden" name="tag" value={tagField} /> : null}
                          {programField ? <input type="hidden" name="b" value={programField} /> : null}
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
