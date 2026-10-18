'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { saveConsultation, type TreatmentFormState } from '@/app/(app)/treatment-actions';
import { DIFFICULTIES, PAIN_VALUES, SENSITIVITIES, SIDES, type Sheet } from '@/lib/schemas';
import type { SheetExercise, SheetPoint } from '@/lib/catalog';
import { DEFAULT_SCHEDULE, withVariant, type Timing } from '@/lib/home-program';
import { PhotoField, usePhotos, type SavedPhoto } from './PhotoField';
import { Seg } from './Seg';
import { HomeProgramBlock, type HomeEntry } from './HomeProgramBlock';
import { ExercisePreview } from './ExercisePreview';

type Sensitivity = (typeof SENSITIVITIES)[number];
type Difficulty = (typeof DIFFICULTIES)[number];
type PointEntry = { left: boolean; right: boolean; sensitivity: Sensitivity | null };
type ExerciseEntry = { prescribed: boolean; difficulty: Difficulty | null; variant: number | null };
type Side = (typeof SIDES)[number];
/** Punkte pro Sitzung (iteration 8, design D5): Sitzung 1 = dark red, 2 = red, 3 = black points */
type PointFilter = 'all' | 'main' | 'relevant' | 'standard';
const FILTERS: PointFilter[] = ['all', 'main', 'relevant', 'standard'];
export const defaultPointFilter = (sessionNumber: number): PointFilter =>
  sessionNumber >= 1 && sessionNumber <= 3 ? FILTERS[sessionNumber] : 'all';

export type ExerciseOption = {
  code: string;
  nameDe: string;
  nameEn: string;
  areaDe: string;
  areaEn: string;
  retired: boolean;
  timing: Timing | null;
  variants: { number: number; images: number[]; aids: string[]; seconds: number | null }[];
};

export type ConsultationValues = {
  at: string;
  diagnosis: string;
  comparison: string;
  painBefore: number | null;
  painAfter: number | null;
  sheet: Sheet;
};

/**
 * session-form (iteration 8, design D3 to D7): digitaler Behandlungsbogen in the order of the treatment: Kopf,
 * Schmerz vorher, Osteopressur, Übungen, Selbstausführung, Schmerz nachher, Fotos.
 */
export function ConsultationForm({
  patientId,
  treatmentId,
  id,
  number,
  side,
  regionLabel,
  areaLabel,
  treatmentInfo,
  initial,
  points: sheetPoints,
  exercises: sheetExercises,
  catalogPoints,
  catalogExercises,
  saved,
  cancelHref,
}: {
  patientId: string;
  treatmentId: string;
  id?: string;
  /** Number of the session: presets the point filter */
  number: number;
  /** Körperseite of the treatment */
  side: Side;
  regionLabel: string;
  /** Bereich of the Schmerzbereich, e.g. "1 Kopf" */
  areaLabel: string;
  treatmentInfo: string;
  initial: ConsultationValues;
  points: SheetPoint[];
  exercises: SheetExercise[];
  catalogPoints: { id: string; latin: string; de: string; group: number }[];
  /** All exercises with their Bereich, timing and variants ("Übung aus anderem Bereich", time totals) */
  catalogExercises: ExerciseOption[];
  saved?: SavedPhoto[];
  cancelHref: string;
}) {
  const t = useTranslations('consultation');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const ts = useTranslations('scales');
  const tp = useTranslations('photos');
  const tf = useTranslations('form');
  const tx = useTranslations('exercise');
  const locale = useLocale();
  const [state, action, pending] = useActionState<TreatmentFormState, FormData>(saveConsultation, {});
  const errors = state.errors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const photos = usePhotos();

  const [head, setHead] = useState({ at: initial.at, diagnosis: initial.diagnosis, comparison: initial.comparison });
  const [painBefore, setPainBefore] = useState(initial.painBefore);
  const [painAfter, setPainAfter] = useState(initial.painAfter);
  const [pts, setPts] = useState<Record<string, PointEntry>>(() =>
    Object.fromEntries(initial.sheet.points.map((p) => [p.pointId, { ...p }])),
  );
  const [extra, setExtra] = useState<SheetPoint[]>([]);
  const [filter, setFilter] = useState<PointFilter>(() => defaultPointFilter(number));
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState('');
  const [exToAdd, setExToAdd] = useState('');
  const [exs, setExs] = useState<Record<string, ExerciseEntry>>(() =>
    Object.fromEntries(
      initial.sheet.exercises.map((x) => [
        x.code,
        { prescribed: x.prescribed, difficulty: x.difficulty, variant: x.variant },
      ]),
    ),
  );
  // Exercises of another Bereich added by the therapist (design D6)
  const [extraExercises, setExtraExercises] = useState<SheetExercise[]>([]);
  const [home, setHome] = useState<Record<string, HomeEntry>>(() =>
    Object.fromEntries(
      initial.sheet.home.map((h) => [h.code, { timesPerDay: h.timesPerDay, weekdays: h.weekdays, note: h.note ?? '' }]),
    ),
  );

  useEffect(() => {
    if (state.errors || state.error) formRef.current?.querySelector<HTMLElement>('.f.bad .inp, .banner.err')?.focus();
  }, [state]);

  const allPoints = [...sheetPoints, ...extra];
  const shown = new Set(allPoints.map((p) => p.id));
  const point = (id: string): PointEntry => pts[id] ?? { left: false, right: false, sensitivity: null };
  const setPoint = (id: string, patch: Partial<PointEntry>) =>
    setPts((prev) => ({ ...prev, [id]: { ...point(id), ...patch } }));
  const recordedPoint = (id: string) => {
    const v = point(id);
    return v.left || v.right || !!v.sensitivity;
  };
  /** Osteopressur nach Körperseite (design D4): a sensitivity ticks the side of the treatment */
  const setSensitivity = (id: string, sensitivity: Sensitivity | null) =>
    setPoint(id, {
      sensitivity,
      ...(sensitivity && side === 'LEFT' ? { left: true } : {}),
      ...(sensitivity && side === 'RIGHT' ? { right: true } : {}),
      // beidseitig (iteration 9, design D6): both sides, either can be unticked
      ...(sensitivity && side === 'UNSPECIFIED' ? { left: true, right: true } : {}),
    });
  const exercise = (code: string): ExerciseEntry => exs[code] ?? { prescribed: false, difficulty: null, variant: null };
  const setExercise = (code: string, patch: Partial<ExerciseEntry>) =>
    setExs((prev) => ({ ...prev, [code]: { ...exercise(code), ...patch } }));

  const exercises = [...sheetExercises, ...extraExercises];
  const homeEntry = (code: string): HomeEntry => home[code] ?? { ...DEFAULT_SCHEDULE, note: '' };
  const setHomeEntry = (code: string, patch: Partial<HomeEntry>) =>
    setHome((prev) => ({ ...prev, [code]: { ...homeEntry(code), ...patch } }));
  const exName = (x: { nameDe: string; nameEn: string }) => (locale === 'en' ? x.nameEn : x.nameDe);
  const areaName = (x: { areaDe: string; areaEn: string }) => (locale === 'en' ? x.areaEn : x.areaDe);
  const option = (code: string) => catalogExercises.find((c) => c.code === code);
  const prescribed = exercises.filter((x) => exercise(x.code).prescribed);
  const epdLabel = (v: number | null) => (v ? t('epdVariant', { n: v }) : t('epdStandard'));
  /** session-form: Übung aus anderem Bereich hinzufügen; it is prescribed right away */
  function addExercise(code: string) {
    const x = option(code);
    if (!x) return;
    if (!exercises.some((e) => e.code === code))
      setExtraExercises((prev) => [...prev, { code, nameDe: x.nameDe, nameEn: x.nameEn, retired: false, extra: true }]);
    setExercise(code, { prescribed: true });
  }

  function sheetJson(): string {
    const sheet = {
      points: allPoints.map((p) => ({ pointId: p.id, ...point(p.id) })),
      exercises: exercises.map((x) => {
        const v = exercise(x.code);
        return { code: x.code, ...v, variant: v.prescribed || v.difficulty ? v.variant : null };
      }),
      home: prescribed.map((x) => ({ code: x.code, ...homeEntry(x.code) })),
    };
    return JSON.stringify(sheet);
  }

  const painOptions = PAIN_VALUES.map((p) => [p, String(p)] as [number, string]);
  const sensOptions = SENSITIVITIES.map((s) => [s, ts(s)] as [Sensitivity, string]);
  const diffOptions = DIFFICULTIES.map((d) => [d, ts(d)] as [Difficulty, string]);
  const err = (name: string, max = 2000) =>
    errors[name] ? (
      <span className="msg" id={`f_${name}_m`}>
        {te(errors[name] as 'tooLong', { max })}
      </span>
    ) : null;
  const aria = (name: string) => ({
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `f_${name}_m` : undefined,
  });

  return (
    <form
      className="form"
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('sheet', sheetJson());
        fd.set('painBefore', painBefore === null ? '' : String(painBefore));
        fd.set('painAfter', painAfter === null ? '' : String(painAfter));
        photos.appendTo(fd);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="treatmentId" value={treatmentId} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {state.error || Object.keys(errors).length ? (
        <div className="banner err" role="alert" tabIndex={-1}>
          <p>{te((state.error ?? 'summary') as 'summary')}</p>
        </div>
      ) : null}

      <fieldset>
        <legend>{t('groupHead')}</legend>
        <div className="grid">
          <div className={`f ${errors.at ? 'bad' : ''}`}>
            <label className="l" htmlFor="f_at">
              {t('at')}
              <span className="req"> *</span>
            </label>
            <input
              id="f_at"
              name="at"
              className="inp"
              type="datetime-local"
              aria-required
              value={head.at}
              onChange={(e) => setHead({ ...head, at: e.target.value })}
              {...aria('at')}
            />
            {err('at')}
          </div>
          <div className="f w4">
            <label className="l" htmlFor="f_treatment">
              {t('treatment')}
            </label>
            <input id="f_treatment" className="inp" value={`${regionLabel} · ${treatmentInfo}`} readOnly disabled />
          </div>
          <div className={`f w6 ${errors.diagnosis ? 'bad' : ''}`}>
            <label className="l" htmlFor="f_diagnosis">
              {t('diagnosis')}
              <span className="req"> *</span>
            </label>
            <textarea
              id="f_diagnosis"
              name="diagnosis"
              className="inp"
              aria-required
              value={head.diagnosis}
              onChange={(e) => setHead({ ...head, diagnosis: e.target.value })}
              {...(errors.diagnosis ? aria('diagnosis') : { 'aria-describedby': 'f_diagnosis_h' })}
            />
            {err('diagnosis') ?? (
              <span className="hint" id="f_diagnosis_h">
                {t('diagnosisHint')}
              </span>
            )}
          </div>
          {/* session-form (iteration 9): no earlier session to compare with in session 1 */}
          {number > 1 ? (
            <div className={`f w6 ${errors.comparison ? 'bad' : ''}`}>
              <label className="l" htmlFor="f_comparison">
                {t('comparison')}
              </label>
              <textarea
                id="f_comparison"
                name="comparison"
                className="inp"
                placeholder={t('comparisonPlaceholder')}
                value={head.comparison}
                onChange={(e) => setHead({ ...head, comparison: e.target.value })}
                {...aria('comparison')}
              />
              {err('comparison')}
            </div>
          ) : null}
        </div>
      </fieldset>

      <section className="card sheet" aria-labelledby="h_painBefore">
        <h2 id="h_painBefore">{t('painBeforeTitle')}</h2>
        <div className="body">
          <div className="painrow">
            <Seg
              className="scale"
              label={`${t('painBeforeTitle')}, %`}
              options={painOptions}
              value={painBefore}
              onChange={setPainBefore}
            />
          </div>
          <span className="hint">{t('painHint')}</span>
        </div>
      </section>

      <section className="card sheet" aria-labelledby="h_osteo">
        <header>
          <h2 id="h_osteo">{t('osteopressure')}</h2>
          <label className="lbl small">
            {t('pointFilter')}{' '}
            <select
              className="inp"
              data-testid="point-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as PointFilter)}
            >
              {FILTERS.map((f) => (
                <option key={f} value={f}>
                  {t(`filter_${f}`)}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="body">
          <div className="legend" aria-hidden="true">
            <span className="m">■ {t('legendMain')}</span>
            <span className="r">■ {t('legendRelevant')}</span>
            <span>■ {t('legendStandard')}</span>
          </div>
          {side !== 'UNSPECIFIED' ? <p className="hint">{t('sideHint', { side: t(`side_${side}`) })}</p> : null}
          <div className="sheetwrap">
            <table className="sheettab">
              <thead>
                <tr>
                  <th scope="col">{t('colPoint')}</th>
                  <th scope="col">{t('colMuscle')}</th>
                  <th scope="col">{t('colTreated')}</th>
                  <th scope="col">{t('colSensitivity')}</th>
                </tr>
              </thead>
              <tbody>
                {allPoints.map((p) => {
                  const v = point(p.id);
                  const bad = errors[`points:${p.id}`];
                  // session-form (iteration 9): only the sides of the treatment; a side recorded before stays visible
                  const showLeft = side !== 'RIGHT' || v.left;
                  const showRight = side !== 'LEFT' || v.right;
                  return (
                    <tr
                      key={p.id}
                      data-point={p.id}
                      className={`e-${p.emphasis}${bad ? ' bad' : ''}`}
                      hidden={filter !== 'all' && p.emphasis !== filter && !p.extra && !recordedPoint(p.id)}
                    >
                      <th scope="row" className="pid num">
                        {p.id}
                      </th>
                      <td className="pname">
                        {p.latin}
                        {p.emphasis === 'main' ? <span className="sr-only"> ({t('legendMain')})</span> : null}
                        {p.emphasis === 'relevant' ? <span className="sr-only"> ({t('legendRelevant')})</span> : null}
                        <small>
                          {p.de}
                          {p.extra ? ` · ${t('extra')}` : ''}
                          {p.retired ? ` · ${t('retired')}` : ''}
                        </small>
                      </td>
                      <td className="lr">
                        {showLeft ? (
                          <label>
                            <input
                              type="checkbox"
                              checked={v.left}
                              aria-label={t('leftLong', { id: p.id })}
                              onChange={(e) => setPoint(p.id, { left: e.target.checked })}
                            />
                            <span aria-hidden="true">{t('left')}</span>
                          </label>
                        ) : null}
                        {showRight ? (
                          <label>
                            <input
                              type="checkbox"
                              checked={v.right}
                              aria-label={t('rightLong', { id: p.id })}
                              onChange={(e) => setPoint(p.id, { right: e.target.checked })}
                            />
                            <span aria-hidden="true">{t('right')}</span>
                          </label>
                        ) : null}
                      </td>
                      <td>
                        <Seg
                          label={t('sensitivityOf', { id: p.id })}
                          options={sensOptions}
                          value={v.sensitivity}
                          onChange={(s) => setSensitivity(p.id, s)}
                        />
                        {bad ? (
                          <span className="msg" role="alert">
                            {te(bad as 'sensitivityRequired')}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {adding ? (
            <div className="addpoint">
              <label className="l" htmlFor="f_addPoint">
                {t('addPointLabel')}
              </label>
              <select id="f_addPoint" className="inp" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                <option value="">–</option>
                {catalogPoints
                  .filter((p) => !shown.has(p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {p.latin} ({p.de})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!toAdd}
                onClick={() => {
                  const p = catalogPoints.find((x) => x.id === toAdd);
                  if (p) setExtra((prev) => [...prev, { ...p, emphasis: 'standard', extra: true, retired: false }]);
                  setToAdd('');
                  setAdding(false);
                }}
              >
                {t('add')}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>
                {tc('cancel')}
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn--ghost addbtn" onClick={() => setAdding(true)}>
              + {t('addPoint')}
            </button>
          )}
        </div>
      </section>

      <section className="card sheet" aria-labelledby="h_ex">
        <header>
          <h2 id="h_ex">{t('exercises')}</h2>
          <span className="hint">{t('exercisesHint', { area: areaLabel })}</span>
        </header>
        <div className="body">
          {exercises.length ? (
            <div className="sheetwrap">
              <table className="sheettab">
                <thead>
                  <tr>
                    <th scope="col">{t('colExercise')}</th>
                    <th scope="col">{tx('imageCol')}</th>
                    <th scope="col">{t('prescribed')}</th>
                    <th scope="col">{t('epd')}</th>
                    <th scope="col">{t('difficulty')}</th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((x) => {
                    const v = exercise(x.code);
                    const o = option(x.code);
                    const bad = errors[`exercises:${x.code}`];
                    return (
                      <tr key={x.code} data-code={x.code} className={bad ? 'bad' : undefined}>
                        <th scope="row">
                          <b>{x.code}</b> {exName(x)}
                          {x.extra && o ? <small> · {areaName(o)}</small> : null}
                          {x.retired ? <small> · {t('retired')}</small> : null}
                        </th>
                        <td className="exmedia">
                          <ExercisePreview code={x.code} name={exName(x)} />
                        </td>
                        <td className="lr">
                          <label>
                            <input
                              type="checkbox"
                              checked={v.prescribed}
                              aria-label={t('prescribedOf', { code: x.code })}
                              onChange={(e) => setExercise(x.code, { prescribed: e.target.checked })}
                            />
                            <span aria-hidden="true">{t('prescribed')}</span>
                          </label>
                        </td>
                        <td>
                          <select
                            className="inp"
                            aria-label={t('epdOf', { code: x.code })}
                            disabled={!v.prescribed && !v.difficulty}
                            value={v.variant ?? ''}
                            onChange={(e) =>
                              setExercise(x.code, { variant: e.target.value ? Number(e.target.value) : null })
                            }
                          >
                            <option value="">{t('epdStandard')}</option>
                            {(o?.variants ?? []).map((w) => (
                              <option key={w.number} value={w.number}>
                                {t('variantOption', { n: w.number, images: w.images.join('+') })}
                                {w.aids.length ? ` · ${w.aids.join(', ')}` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Seg
                            label={t('difficultyOf', { code: x.code })}
                            options={diffOptions}
                            value={v.difficulty}
                            onChange={(d) => setExercise(x.code, { difficulty: d })}
                          />
                          {bad ? (
                            <span className="msg" role="alert">
                              {te(bad as 'difficultyRequired')}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">{t('noExercises')}</p>
          )}
          <div className="addpoint">
            <label className="l" htmlFor="f_addExercise">
              {t('addExercise')}
            </label>
            <select id="f_addExercise" className="inp" value={exToAdd} onChange={(e) => setExToAdd(e.target.value)}>
              <option value="">–</option>
              {catalogExercises
                .filter((c) => !c.retired && !exercises.some((e) => e.code === c.code))
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {exName(c)} ({areaName(c)})
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={!exToAdd}
              onClick={() => {
                addExercise(exToAdd);
                setExToAdd('');
              }}
            >
              {t('add')}
            </button>
          </div>
        </div>
      </section>

      <HomeProgramBlock
        rows={prescribed.map((x) => {
          const v = exercise(x.code).variant;
          const o = option(x.code);
          return {
            code: x.code,
            name: exName(x),
            epd: epdLabel(v),
            variant: v,
            timing: withVariant(o?.timing ?? null, o?.variants.find((w) => w.number === v)?.seconds),
          };
        })}
        entry={homeEntry}
        errors={errors}
        onChange={setHomeEntry}
        onRemove={(code) => setExercise(code, { prescribed: false })}
      />

      <section className="card sheet" aria-labelledby="h_painAfter">
        <h2 id="h_painAfter">{t('painAfterTitle')}</h2>
        <div className="body">
          <div className="painrow">
            <Seg
              className="scale"
              label={`${t('painAfterTitle')}, %`}
              options={painOptions}
              value={painAfter}
              onChange={setPainAfter}
            />
          </div>
          <span className="hint">{t('painHint')}</span>
        </div>
      </section>

      <section className="card sheet" aria-labelledby="h_photos">
        <h2 id="h_photos">{t('photos')}</h2>
        <div className="body">
          <PhotoField
            state={photos}
            saved={saved}
            id="f_photos"
            error={errors.photos ? te(errors.photos as 'photoType') : null}
          />
        </div>
      </section>

      <div className="formbar">
        <span className="muted" style={{ fontSize: 13 }}>
          {pending ? (
            <>
              <progress aria-label={tp('saving')} /> {tp('saving')}
            </>
          ) : (
            tf('requiredNote')
          )}
        </span>
        <div className="actions">
          <Link className="btn btn--ghost" href={cancelHref}>
            {tc('cancel')}
          </Link>
          <button type="submit" className="btn btn--gold" disabled={pending || !!photos.progress}>
            {t('save')}
          </button>
        </div>
      </div>
    </form>
  );
}
