'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { savePatient, type PatientFormState } from '@/app/(app)/actions';

import type { PatientFormValues as Values } from '@/lib/schemas';

export { EMPTY_PATIENT } from '@/lib/schemas';

export function PatientForm({ id, initial, cancelHref }: { id?: string; initial: Values; cancelHref: string }) {
  const t = useTranslations('form');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const td = useTranslations('duplicate');
  const [state, action, pending] = useActionState<PatientFormState, FormData>(savePatient, {});
  const [v, setV] = useState<Values>(initial);
  const [confirmDup, setConfirmDup] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const errors = state.errors ?? {};
  const nErr = Object.keys(errors).length;

  useEffect(() => {
    if (nErr) formRef.current?.querySelector<HTMLElement>('.f.bad .inp')?.focus();
  }, [state, nErr]);
  useEffect(() => {
    if (state.duplicate?.length) dialogRef.current?.showModal();
  }, [state]);
  useEffect(() => {
    if (confirmDup) formRef.current?.requestSubmit();
  }, [confirmDup]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setV((prev) => ({
      ...prev,
      [k]: e.target instanceof HTMLInputElement && e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  function Field(props: {
    name: string;
    label: string;
    w?: string;
    req?: boolean;
    type?: string;
    ph?: string;
    im?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
    select?: [string, string][];
    area?: boolean;
    hint?: string;
    autoComplete?: string;
  }) {
    const { name, label, w = '', req, type = 'text', ph, im, select, area, hint, autoComplete = 'off' } = props;
    const err = errors[name];
    const fid = `f_${name}`;
    const common = {
      id: fid,
      name,
      className: 'inp',
      value: String(v[name] ?? ''),
      onChange: set(name),
      'aria-invalid': err ? true : undefined,
      'aria-describedby': err || hint ? `${fid}_m` : undefined,
      'aria-required': req || undefined,
    };
    return (
      <div className={`f ${w} ${err ? 'bad' : ''}`}>
        <label className="l" htmlFor={fid}>
          {label}
          {req ? <span className="req"> *</span> : null}
        </label>
        {select ? (
          <select {...common}>
            {select.map(([ov, ol]) => (
              <option key={ov} value={ov}>
                {ol}
              </option>
            ))}
          </select>
        ) : area ? (
          <textarea {...common} />
        ) : (
          <input {...common} type={type} placeholder={ph} inputMode={im} autoComplete={autoComplete} />
        )}
        {err ? (
          <span className="msg" id={`${fid}_m`}>
            {te(err as 'tooLong', { max: 200 })}
          </span>
        ) : hint ? (
          <span className="hint" id={`${fid}_m`}>
            {hint}
          </span>
        ) : null}
      </div>
    );
  }
  const check = (name: string, label?: string) => (
    <label className="ck" key={name}>
      <input type="checkbox" name={name} id={`c_${name}`} checked={!!v[name]} onChange={set(name)} />
      {label ?? t(name as never)}
    </label>
  );
  const yn: [string, string][] = [
    ['NO', tc('no')],
    ['YES', tc('yes')],
  ];

  return (
    <form
      className="form"
      ref={formRef}
      noValidate
      // Submitted via onSubmit rather than action={...}: React resets action forms afterwards,
      // which would untick controlled checkboxes when the server returns validation errors.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => action(fd));
      }}
    >
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {confirmDup ? <input type="hidden" name="confirmDuplicate" value="1" /> : null}
      {nErr ? (
        <div className="banner err" role="alert">
          <p>{te('summary')}</p>
        </div>
      ) : null}

      <fieldset>
        <legend>{t('groupPerson')}</legend>
        <div className="grid">
          {Field({ name: 'firstName', label: t('firstName'), req: true, w: 'w3', autoComplete: 'off' })}
          {Field({ name: 'lastName', label: t('lastName'), req: true, w: 'w3' })}
          {Field({
            name: 'gender',
            label: t('gender'),
            select: [
              ['', ''],
              ['m', t('genderM')],
              ['w', t('genderW')],
              ['d', t('genderD')],
            ],
          })}
          {Field({ name: 'dateOfBirth', label: t('dateOfBirth'), req: true, ph: t('dateHint'), im: 'decimal' })}
          {Field({
            name: 'preferredLanguage',
            label: t('preferredLanguage'),
            req: true,
            select: [
              ['de', tc('languageDe')],
              ['en', tc('languageEn')],
            ],
            hint: t('preferredLanguageHint'),
          })}
          {Field({ name: 'occupation', label: t('occupation'), w: 'w3' })}
          {Field({ name: 'gp', label: t('gp'), w: 'w3' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('groupContact')}</legend>
        <div className="grid">
          {Field({ name: 'street', label: t('street'), w: 'w6' })}
          {Field({ name: 'zip', label: t('zip'), w: 'w1', im: 'numeric' })}
          {Field({ name: 'city', label: t('city'), w: 'w3' })}
          <div className="f w1" aria-hidden="true" />
          {Field({ name: 'phone', label: t('phone'), type: 'tel', ph: '044 123 45 67' })}
          {Field({ name: 'mobile', label: t('mobile'), type: 'tel', ph: '079 123 45 67' })}
          {Field({ name: 'email', label: t('email'), type: 'email', ph: 'name@beispiel.ch' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('groupEmergency')}</legend>
        <div className="grid">
          {Field({ name: 'emergencyName', label: t('emergencyName'), w: 'w3' })}
          {Field({ name: 'emergencyPhone', label: t('emergencyPhone'), type: 'tel', w: 'w3' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('groupInsurance')}</legend>
        <div className="grid">
          {Field({ name: 'insurer', label: t('insurer'), w: 'w3' })}
          {Field({ name: 'insuranceNumber', label: t('insuranceNumber'), w: 'w3', ph: '756.0000.0000.00' })}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t('groupAnamnesis')}</legend>
        <div className="grid">
          {Field({ name: 'smoker', label: t('smoker'), select: yn })}
          {v.smoker === 'YES' ? (
            <>
              {Field({ name: 'smokingYears', label: t('smokingYears'), im: 'numeric' })}
              {Field({ name: 'packsPerDay', label: t('packsPerDay'), im: 'decimal' })}
            </>
          ) : (
            <div className="f w4" aria-hidden="true" />
          )}
          <div className="sub-h">{t('general')}</div>
          <div className="f w6">
            <div className="checks">
              {check('highBloodPressure')}
              {check('highBloodLipids')}
              {check('dizziness')}
            </div>
          </div>
          <div className="sub-h">{t('orthopaedic')}</div>
          <div className="f w6">
            <div className="checks">
              {check('osteoporosis')}
              {check('arthrosis')}
              {check('rheumatism')}
              {check('orthoOther', t('other'))}
            </div>
          </div>
          {v.orthoOther ? Field({ name: 'orthoOtherText', label: t('orthoOtherText'), w: 'w6', req: true }) : null}
          <div className="sub-h">{t('internal')}</div>
          <div className="f w6">
            <div className="checks">
              {check('cardiovascular')}
              {check('diabetes')}
              {check('asthma')}
              {check('allergies')}
              {check('internalOther', t('other'))}
            </div>
          </div>
          {v.internalOther
            ? Field({ name: 'internalOtherText', label: t('internalOtherText'), w: 'w6', req: true })
            : null}
          {Field({ name: 'furtherDiagnoses', label: t('furtherDiagnoses'), area: true, w: 'w3' })}
          {Field({ name: 'medication', label: t('medication'), area: true, w: 'w3' })}
          {Field({
            name: 'pregnancy',
            label: t('pregnancy'),
            select: [
              ['NOT_APPLICABLE', tc('notApplicable')],
              ['NO', tc('no')],
              ['YES', tc('yes')],
            ],
          })}
          {Field({ name: 'inTreatment', label: t('inTreatment'), select: yn })}
          {v.inTreatment === 'YES' ? Field({ name: 'treatingDoctor', label: t('treatingDoctor') }) : null}
        </div>
      </fieldset>

      <div className="formbar">
        <span className="muted" style={{ fontSize: 13 }}>
          {t('requiredNote')}
        </span>
        <div className="actions">
          <Link className="btn btn--ghost" href={cancelHref}>
            {tc('cancel')}
          </Link>
          <button type="submit" className="btn btn--gold" disabled={pending}>
            {id ? tc('saveChanges') : tc('save')}
          </button>
        </div>
      </div>

      <dialog ref={dialogRef} className="modal" aria-labelledby="dup-h">
        <h2 id="dup-h">{td('title')}</h2>
        <div className="body">
          {state.duplicate?.[0] ? (
            <p>
              {td('text', { lastName: state.duplicate[0].name.split(' ').slice(-1)[0], dob: state.duplicate[0].dob })}
            </p>
          ) : null}
          {state.duplicate?.map((d) => (
            <div className="duprow" key={d.id}>
              <span>
                <b>{d.name}</b>
                <br />
                <small className="muted num">
                  {d.dob}
                  {d.city ? ` · ${d.city}` : ''}
                </small>
              </span>
              <span className={`pill ${d.active ? 'ok' : 'off'}`}>{d.active ? tc('active') : tc('inactive')}</span>
            </div>
          ))}
        </div>
        <footer>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              dialogRef.current?.close();
              setConfirmDup(true);
            }}
          >
            {td('createAnyway')}
          </button>
          {state.duplicate?.[0] ? (
            <Link className="btn btn--gold" href={`/patients/${state.duplicate[0].id}`}>
              {td('open')}
            </Link>
          ) : null}
        </footer>
      </dialog>
    </form>
  );
}
