'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { saveConsultation, type TreatmentFormState } from '@/app/(app)/treatment-actions';
import { DIFFICULTIES, PAIN_VALUES, ROLLING_SLOTS, SENSITIVITIES, type Sheet } from '@/lib/schemas';
import type { SheetExercise, SheetPoint } from '@/lib/catalog';
import { DEFAULT_REPETITION, type Timing } from '@/lib/home-program';
import { PhotoField, usePhotos, type SavedPhoto } from './PhotoField';
import { Seg } from './Seg';
import { HomeProgramBlock, type HomeEntry } from './HomeProgramBlock';

type Sensitivity = (typeof SENSITIVITIES)[number];
type Difficulty = (typeof DIFFICULTIES)[number];
type PointEntry = { left: boolean; right: boolean; sensitivity: Sensitivity | null };
type ExerciseEntry = { prescribed: boolean; difficulty: Difficulty | null; variants: string };
type RollingEntry = { area: string; toolCode: string };

export type ConsultationValues = {
  at: string;
  diagnosis: string;
  comparison: string;
  painBefore: number | null;
  painAfter: number | null;
  sheet: Sheet;
};

/** consultations: digitaler Behandlungsbogen nach mockups/konsultation-lws-bauch.html */
export function ConsultationForm({
  patientId,
  treatmentId,
  id,
  regionLabel,
  treatmentInfo,
  initial,
  points: sheetPoints,
  exercises: sheetExercises,
  catalogPoints,
  catalogExercises,
  tools,
  saved,
  cancelHref,
}: {
  patientId: string;
  treatmentId: string;
  id?: string;
  regionLabel: string;
  treatmentInfo: string;
  initial: ConsultationValues;
  points: SheetPoint[];
  exercises: SheetExercise[];
  catalogPoints: { id: string; latin: string; de: string; group: number }[];
  /** All exercises with their timing (Selbstausführung: "Übung hinzufügen" and the time totals) */
  catalogExercises: { code: string; nameDe: string; nameEn: string; retired: boolean; timing: Timing | null }[];
  tools: { code: string; name: string }[];
  saved?: SavedPhoto[];
  cancelHref: string;
}) {
  const t = useTranslations('consultation');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const ts = useTranslations('scales');
  const tp = useTranslations('photos');
  const tf = useTranslations('form');
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
  const [onlyMain, setOnlyMain] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toAdd, setToAdd] = useState('');
  const [exs, setExs] = useState<Record<string, ExerciseEntry>>(() =>
    Object.fromEntries(
      initial.sheet.exercises.map((x) => [
        x.code,
        { prescribed: x.prescribed, difficulty: x.difficulty, variants: x.variants ?? '' },
      ]),
    ),
  );
  // Exercises added in "Selbstausführung" that are not on this area's form
  const [extraExercises, setExtraExercises] = useState<SheetExercise[]>([]);
  const [home, setHome] = useState<Record<string, HomeEntry>>(() =>
    Object.fromEntries(initial.sheet.home.map((h) => [h.code, { ...h, note: h.note ?? '' }])),
  );
  const [rolling, setRolling] = useState<RollingEntry[]>(() =>
    Array.from({ length: ROLLING_SLOTS }, (_, i) => {
      const r = initial.sheet.rolling.find((x) => x.position === i + 1);
      return { area: r?.area ?? '', toolCode: r?.toolCode ?? '' };
    }),
  );

  useEffect(() => {
    if (state.errors || state.error) formRef.current?.querySelector<HTMLElement>('.f.bad .inp, .banner.err')?.focus();
  }, [state]);

  const allPoints = [...sheetPoints, ...extra];
  const shown = new Set(allPoints.map((p) => p.id));
  const point = (id: string): PointEntry => pts[id] ?? { left: false, right: false, sensitivity: null };
  const setPoint = (id: string, patch: Partial<PointEntry>) =>
    setPts((prev) => ({ ...prev, [id]: { ...point(id), ...patch } }));
  const exercise = (code: string): ExerciseEntry => exs[code] ?? { prescribed: false, difficulty: null, variants: '' };
  const setExercise = (code: string, patch: Partial<ExerciseEntry>) =>
    setExs((prev) => ({ ...prev, [code]: { ...exercise(code), ...patch } }));

  const exercises = [...sheetExercises, ...extraExercises];
  const homeEntry = (code: string): HomeEntry =>
    home[code] ?? { repetition: DEFAULT_REPETITION, intensity: null, steps: null, note: '' };
  const setHomeEntry = (code: string, patch: Partial<HomeEntry>) =>
    setHome((prev) => ({ ...prev, [code]: { ...homeEntry(code), ...patch } }));
  const exName = (x: { nameDe: string; nameEn: string }) => (locale === 'en' ? x.nameEn : x.nameDe);
  const prescribed = exercises.filter((x) => exercise(x.code).prescribed);
  /** home-program: Weitere Übung. Added from the catalog it counts as prescribed. */
  function addHomeExercise(code: string) {
    const x = catalogExercises.find((c) => c.code === code);
    if (!x) return;
    if (!exercises.some((e) => e.code === code))
      setExtraExercises((prev) => [...prev, { code, nameDe: x.nameDe, nameEn: x.nameEn, retired: false }]);
    setExercise(code, { prescribed: true });
  }

  function sheetJson(): string {
    const sheet = {
      points: allPoints.map((p) => ({ pointId: p.id, ...point(p.id) })),
      exercises: exercises.map((x) => ({ code: x.code, ...exercise(x.code) })),
      rolling: rolling.map((r, i) => ({ position: i + 1, area: r.area, toolCode: r.toolCode || null })),
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
        </div>
      </fieldset>

      <section className="card sheet" aria-labelledby="h_pain">
        <h2 id="h_pain">{t('pain')}</h2>
        <div className="body">
          <div className="painrow">
            <span id="l_painBefore">{t('painBefore')}</span>
            <Seg
              className="scale"
              label={`${t('pain')} ${t('painBefore')}, %`}
              options={painOptions}
              value={painBefore}
              onChange={setPainBefore}
            />
          </div>
          <div className="painrow">
            <span id="l_painAfter">{t('painAfter')}</span>
            <Seg
              className="scale"
              label={`${t('pain')} ${t('painAfter')}, %`}
              options={painOptions}
              value={painAfter}
              onChange={setPainAfter}
            />
          </div>
          <span className="hint">{t('painHint')}</span>
        </div>
      </section>

      <section className="card sheet" aria-labelledby="h_osteo">
        <header>
          <h2 id="h_osteo">{t('osteopressure')}</h2>
          <label className="ck small">
            <input type="checkbox" checked={onlyMain} onChange={(e) => setOnlyMain(e.target.checked)} />
            {t('onlyMain')}
          </label>
        </header>
        <div className="body">
          <div className="legend" aria-hidden="true">
            <span className="m">■ {t('legendMain')}</span>
            <span className="r">■ {t('legendRelevant')}</span>
            <span>■ {t('legendStandard')}</span>
          </div>
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
                  return (
                    <tr key={p.id} className={`e-${p.emphasis}`} hidden={onlyMain && p.emphasis !== 'main'}>
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
                        <label>
                          <input
                            type="checkbox"
                            checked={v.left}
                            aria-label={t('leftLong', { id: p.id })}
                            onChange={(e) => setPoint(p.id, { left: e.target.checked })}
                          />
                          <span aria-hidden="true">{t('left')}</span>
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={v.right}
                            aria-label={t('rightLong', { id: p.id })}
                            onChange={(e) => setPoint(p.id, { right: e.target.checked })}
                          />
                          <span aria-hidden="true">{t('right')}</span>
                        </label>
                      </td>
                      <td>
                        <Seg
                          label={t('sensitivityOf', { id: p.id })}
                          options={sensOptions}
                          value={v.sensitivity}
                          onChange={(s) => setPoint(p.id, { sensitivity: s })}
                        />
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
                  setOnlyMain(false);
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
        <h2 id="h_ex">{t('exercises')}</h2>
        <div className="body">
          {exercises.length ? (
            <div className="sheetwrap">
              <table className="sheettab">
                <thead>
                  <tr>
                    <th scope="col">{t('colExercise')}</th>
                    <th scope="col">{t('prescribed')}</th>
                    <th scope="col">{t('difficulty')}</th>
                    <th scope="col">{t('variants')}</th>
                  </tr>
                </thead>
                <tbody>
                  {exercises.map((x) => {
                    const v = exercise(x.code);
                    return (
                      <tr key={x.code}>
                        <th scope="row">
                          <b>{x.code}</b> {exName(x)}
                          {x.retired ? <small> · {t('retired')}</small> : null}
                        </th>
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
                          <Seg
                            label={t('difficultyOf', { code: x.code })}
                            options={diffOptions}
                            value={v.difficulty}
                            onChange={(d) => setExercise(x.code, { difficulty: d })}
                          />
                        </td>
                        <td>
                          <input
                            className="inp"
                            placeholder={t('variantPlaceholder')}
                            aria-label={t('variantsOf', { code: x.code })}
                            maxLength={500}
                            value={v.variants}
                            onChange={(e) => setExercise(x.code, { variants: e.target.value })}
                          />
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
        </div>
      </section>

      <HomeProgramBlock
        rows={prescribed.map((x) => ({
          code: x.code,
          name: exName(x),
          timing: catalogExercises.find((c) => c.code === x.code)?.timing ?? null,
        }))}
        entry={homeEntry}
        onChange={setHomeEntry}
        onRemove={(code) => setExercise(code, { prescribed: false })}
        addable={catalogExercises
          .filter((c) => !c.retired && !exercise(c.code).prescribed)
          .map((c) => ({ code: c.code, name: exName(c) }))}
        onAdd={addHomeExercise}
      />

      <section className="card sheet" aria-labelledby="h_roll">
        <h2 id="h_roll">{t('rolling')}</h2>
        <div className="grid">
          <p className="hint w6row">{tools.map((x) => `${x.name} = ${x.code}`).join(' · ')}</p>
          {rolling.map((r, i) => (
            <div className="f" key={i}>
              <label className="l" htmlFor={`f_roll${i + 1}`}>
                {t('rollingArea', { n: i + 1 })}
              </label>
              <input
                id={`f_roll${i + 1}`}
                className="inp"
                maxLength={200}
                placeholder={i === 0 ? t('rollingPlaceholder') : undefined}
                value={r.area}
                onChange={(e) =>
                  setRolling((prev) => prev.map((x, k) => (k === i ? { ...x, area: e.target.value } : x)))
                }
              />
              <select
                className="inp"
                aria-label={t('rollingTool', { n: i + 1 })}
                value={r.toolCode}
                onChange={(e) =>
                  setRolling((prev) => prev.map((x, k) => (k === i ? { ...x, toolCode: e.target.value } : x)))
                }
              >
                <option value="">{t('rollingChoose')}</option>
                {tools.map((x) => (
                  <option key={x.code} value={x.code}>
                    {x.code} · {x.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
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
