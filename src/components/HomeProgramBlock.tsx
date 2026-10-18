'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  executionTime,
  formatMinutes,
  perWeek,
  programTime,
  TIMES_PER_DAY,
  WEEKDAYS,
  weekdayBit,
  type Timing,
} from '@/lib/home-program';
import { ExerciseImage } from './ExerciseImage';
import { ExerciseAudio } from './ExerciseAudio';
import { Seg } from './Seg';
import { TailoredSheet } from './TailoredSheet';

export type HomeEntry = { timesPerDay: number; weekdays: number; note: string };
export type HomeRowInfo = {
  code: string;
  name: string;
  epd: string;
  /** Prescribed variant, null = Standardübung */
  variant: number | null;
  timing: Timing | null;
};

/**
 * home-schedule (iteration 8, design D7): Block "Selbstausführung". One row per prescribed exercise with FRM and its
 * EPD, executions per day (1× to 3×), weekdays Mo to So (all preselected, at least one) and a note; the duration of
 * one execution, the time per week of the row and the total time.
 *
 * Iteration 9: the name opens the sheet tailored to the prescription, and «Anhören» plays the FRM and then the
 * prescribed EPD (only here, no longer in the exercise list of the session).
 */
export function HomeProgramBlock({
  rows,
  entry,
  errors = {},
  onChange,
  onRemove,
}: {
  rows: HomeRowInfo[];
  entry: (code: string) => HomeEntry;
  /** "home:<code>" → key of the "errors" namespace */
  errors?: Record<string, string>;
  onChange: (code: string, patch: Partial<HomeEntry>) => void;
  onRemove: (code: string) => void;
}) {
  const t = useTranslations('home');
  const te = useTranslations('errors');
  const locale = useLocale();
  const schedule = (code: string) => ({ timesPerDay: entry(code).timesPerDay, weekdays: entry(code).weekdays });
  const total = programTime(rows.map((r) => ({ code: r.code, schedule: schedule(r.code), timing: r.timing })));
  const min = (m: number) => formatMinutes(m, locale);
  const perDay = TIMES_PER_DAY.map((n) => [n, t('times', { n })] as [number, string]);

  return (
    <section className="card sheet" aria-labelledby="h_home">
      <header>
        <h2 id="h_home">{t('title')}</h2>
      </header>
      <div className="body">
        <p className="hint">{t('hint')}</p>
        {rows.length ? (
          <ul className="rxlist" aria-label={t('title')}>
            {rows.map((r) => {
              const v = entry(r.code);
              const e = executionTime(r.timing);
              const bad = errors[`home:${r.code}`];
              return (
                <li className={`rx${bad ? ' bad' : ''}`} key={r.code} data-code={r.code}>
                  <ExerciseImage className="rximg" code={r.code} kind="main" alt={t('imageOf', { code: r.code })} />
                  <div className="nm">
                    <TailoredSheet code={r.code} name={r.name} variant={r.variant} epd={r.epd} />
                    <small>{t('parts', { epd: r.epd })}</small>
                    <small>
                      {r.timing ? (r.timing.sides === 2 ? t('bothSides') : t('oneSide')) : t('timingNotSet')}
                    </small>
                  </div>
                  <div className="dur">
                    {r.timing ? t('perExecution', { duration: min(e.seconds / 60) }) : '–'}
                    {r.timing && e.stretchMissing ? <small>{t('stretchNotSet')}</small> : null}
                    <ExerciseAudio
                      code={r.code}
                      kind="frm-audio"
                      then={r.variant ? `v${r.variant}-audio` : 'std-audio'}
                      label={`${r.code} ${r.epd}`}
                    />
                    {r.timing ? (
                      <small data-testid={`week-${r.code}`}>
                        {t('rowPerWeek', { duration: min((e.seconds * perWeek(schedule(r.code))) / 60) })}
                      </small>
                    ) : null}
                  </div>
                  <div className="opts">
                    <span className="lbl" aria-hidden="true">
                      {t('perDayLabel')}
                    </span>
                    <Seg
                      label={t('timesPerDayOf', { code: r.code })}
                      options={perDay}
                      value={v.timesPerDay}
                      required
                      onChange={(n) => n && onChange(r.code, { timesPerDay: n })}
                    />
                    <span className="lbl" aria-hidden="true">
                      {t('weekdays')}
                    </span>
                    <span className="seg days" role="group" aria-label={t('weekdaysOf', { code: r.code })}>
                      {WEEKDAYS.map((d, i) => {
                        const on = (v.weekdays & weekdayBit(i)) !== 0;
                        return (
                          <button
                            key={d}
                            type="button"
                            aria-pressed={on}
                            aria-label={t(`day_${d}`)}
                            onClick={() => onChange(r.code, { weekdays: v.weekdays ^ weekdayBit(i) })}
                          >
                            {t(`short_${d}`)}
                          </button>
                        );
                      })}
                    </span>
                    {bad || !v.weekdays ? (
                      <span className="msg" role="alert">
                        {te('weekdayRequired')}
                      </span>
                    ) : null}
                  </div>
                  <div className="opts">
                    <input
                      className="inp note"
                      maxLength={300}
                      placeholder={t('note')}
                      aria-label={t('noteOf', { code: r.code })}
                      value={v.note}
                      onChange={(ev) => onChange(r.code, { note: ev.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn--ghost"
                      aria-label={t('remove', { code: r.code })}
                      title={t('remove', { code: r.code })}
                      onClick={() => onRemove(r.code)}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{t('empty')}</p>
        )}
        <div className="total" aria-live="polite" data-testid="home-total">
          <div>
            <b>{min(total.dayMinutes)}</b>
            <span>{t('perDay')}</span>
          </div>
          <div>
            <b>{min(total.weekMinutes)}</b>
            <span>{t('perWeek')}</span>
          </div>
          <div>
            <b>{rows.length}</b>
            <span>{t('count')}</span>
          </div>
        </div>
        {total.extensive ? (
          <p className="note" role="status">
            {t('extensive', { minutes: 30 })}
          </p>
        ) : null}
        {total.incomplete.length ? (
          <p className="hint">{t('incomplete', { codes: total.incomplete.join(', ') })}</p>
        ) : null}
      </div>
    </section>
  );
}
