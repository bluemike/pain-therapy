'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  executionTime,
  formatMinutes,
  INTENSITIES,
  programTime,
  REPETITIONS,
  repetitionParts,
  STEPS,
  stepsLabel,
  type Repetition,
  type Timing,
} from '@/lib/home-program';
import { ExerciseImage } from './ExerciseImage';
import { Seg } from './Seg';

export type HomeEntry = { repetition: Repetition; intensity: number | null; steps: number | null; note: string };
export type HomeRowInfo = { code: string; name: string; timing: Timing | null };

const DAILY = REPETITIONS.filter((r) => repetitionParts(r).daily);
const WEEKLY = REPETITIONS.filter((r) => !repetitionParts(r).daily);

/**
 * home-program: Block "Selbstausführung" nach mockups/selbstausfuehrung.html. Lists every prescribed exercise with
 * repetition (ten options in two groups), intensity, steps and the duration of one execution, and the total time.
 */
export function HomeProgramBlock({
  rows,
  entry,
  onChange,
  onRemove,
  addable,
  onAdd,
}: {
  rows: HomeRowInfo[];
  entry: (code: string) => HomeEntry;
  onChange: (code: string, patch: Partial<HomeEntry>) => void;
  onRemove: (code: string) => void;
  addable: { code: string; name: string }[];
  onAdd: (code: string) => void;
}) {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState('');
  const total = programTime(
    rows.map((r) => ({ code: r.code, repetition: entry(r.code).repetition, timing: r.timing })),
  );
  const min = (m: number) => formatMinutes(m, locale);
  const times = (list: readonly Repetition[]) =>
    list.map((r) => [r, t('times', { n: repetitionParts(r).times })] as [Repetition, string]);

  return (
    <section className="card sheet" aria-labelledby="h_home">
      <header>
        <h2 id="h_home">{t('title')}</h2>
        <button type="button" className="btn btn--ghost" onClick={() => setAdding(true)} aria-expanded={adding}>
          + {t('add')}
        </button>
      </header>
      <div className="body">
        <p className="hint">{t('hint')}</p>
        {adding ? (
          <div className="addpoint">
            <label className="l" htmlFor="f_addExercise">
              {t('addLabel')}
            </label>
            <select id="f_addExercise" className="inp" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
              <option value="">–</option>
              {addable.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.code} · {x.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!toAdd}
              onClick={() => {
                onAdd(toAdd);
                setToAdd('');
                setAdding(false);
              }}
            >
              {t('addConfirm')}
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
              {tc('cancel')}
            </button>
          </div>
        ) : null}
        {rows.length ? (
          <ul className="rxlist" aria-label={t('title')}>
            {rows.map((r) => {
              const v = entry(r.code);
              const e = executionTime(r.timing);
              return (
                <li className="rx" key={r.code} data-code={r.code}>
                  <ExerciseImage className="rximg" code={r.code} kind="main" alt={t('imageOf', { code: r.code })} />
                  <div className="nm">
                    <b>{r.code}</b> {r.name}
                    <small>
                      {r.timing ? (r.timing.sides === 2 ? t('bothSides') : t('oneSide')) : t('timingNotSet')}
                    </small>
                  </div>
                  <div className="dur">
                    {r.timing ? t('perExecution', { duration: min(e.seconds / 60) }) : '–'}
                    {r.timing && e.stretchMissing ? <small>{t('stretchNotSet')}</small> : null}
                  </div>
                  <div className="opts">
                    <span className="lbl" aria-hidden="true">
                      {t('daily')}
                    </span>
                    <Seg
                      label={t('repetitionOf', { code: r.code, kind: t('daily') })}
                      options={times(DAILY)}
                      value={v.repetition}
                      required
                      onChange={(rep) => rep && onChange(r.code, { repetition: rep })}
                    />
                    <span className="lbl" aria-hidden="true">
                      {t('weekly')}
                    </span>
                    <Seg
                      label={t('repetitionOf', { code: r.code, kind: t('weekly') })}
                      options={times(WEEKLY)}
                      value={v.repetition}
                      required
                      onChange={(rep) => rep && onChange(r.code, { repetition: rep })}
                    />
                  </div>
                  <div className="opts">
                    <label className="lbl">
                      {t('intensity')}{' '}
                      <select
                        className="inp"
                        aria-label={t('intensityOf', { code: r.code })}
                        value={v.intensity ?? ''}
                        onChange={(ev) =>
                          onChange(r.code, { intensity: ev.target.value ? Number(ev.target.value) : null })
                        }
                      >
                        <option value="">–</option>
                        {INTENSITIES.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="lbl">
                      {t('steps')}{' '}
                      <select
                        className="inp"
                        aria-label={t('stepsOf', { code: r.code })}
                        value={v.steps ?? ''}
                        onChange={(ev) => onChange(r.code, { steps: ev.target.value ? Number(ev.target.value) : null })}
                      >
                        <option value="">–</option>
                        {STEPS.map((n) => (
                          <option key={n} value={n}>
                            {stepsLabel(n)}
                          </option>
                        ))}
                      </select>
                    </label>
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
