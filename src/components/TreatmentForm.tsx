'use client';

import Link from 'next/link';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { saveTreatment, type TreatmentFormState } from '@/app/(app)/treatment-actions';
import { PAIN_VALUES } from '@/lib/schemas';
import { PhotoField, usePhotos, type SavedPhoto } from './PhotoField';

export type TreatmentValues = { startedAt: string; regionId: string; diagnosis: string; painStart: string };

/** treatments: Formular "Neue Behandlung" und "Behandlung ändern" */
export function TreatmentForm({
  patientId,
  id,
  initial,
  regions,
  saved,
  cancelHref,
  regionLocked = false,
}: {
  patientId: string;
  id?: string;
  initial: TreatmentValues;
  regions: [string, string][];
  saved?: SavedPhoto[];
  cancelHref: string;
  /** after the first consultation the area is fixed (the sheets hang off it) */
  regionLocked?: boolean;
}) {
  const t = useTranslations('treatments');
  const tc = useTranslations('common');
  const te = useTranslations('errors');
  const tp = useTranslations('photos');
  const tf = useTranslations('form');
  const [state, action, pending] = useActionState<TreatmentFormState, FormData>(saveTreatment, {});
  const [v, setV] = useState<TreatmentValues>(initial);
  const photos = usePhotos();
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.errors || state.error) formRef.current?.querySelector<HTMLElement>('.f.bad .inp, .banner.err')?.focus();
  }, [state]);

  const set =
    (k: keyof TreatmentValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setV((prev) => ({ ...prev, [k]: e.target.value }));

  const field = (
    name: keyof TreatmentValues,
    label: string,
    w: string,
    control: (common: Record<string, unknown>) => React.ReactNode,
    hint?: string,
  ) => {
    const err = errors[name];
    const fid = `f_${name}`;
    const described = [err ? `${fid}_m` : '', hint ? `${fid}_h` : ''].filter(Boolean).join(' ');
    return (
      <div className={`f ${w} ${err ? 'bad' : ''}`}>
        <label className="l" htmlFor={fid}>
          {label}
          <span className="req"> *</span>
        </label>
        {control({
          id: fid,
          name,
          className: 'inp',
          value: v[name],
          onChange: set(name),
          'aria-invalid': err ? true : undefined,
          'aria-describedby': described || undefined,
          'aria-required': true,
        })}
        {hint ? (
          <span className="hint" id={`${fid}_h`}>
            {hint}
          </span>
        ) : null}
        {err ? (
          <span className="msg" id={`${fid}_m`}>
            {te(err as 'tooLong', { max: 2000 })}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <form
      className="form"
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        photos.appendTo(fd);
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="patientId" value={patientId} />
      {id ? <input type="hidden" name="id" value={id} /> : null}
      {state.error || Object.keys(errors).length ? (
        <div className="banner err" role="alert" tabIndex={-1}>
          <p>{te((state.error ?? 'summary') as 'summary')}</p>
        </div>
      ) : null}
      <fieldset>
        <legend>{id ? t('editTitle') : t('newTitle')}</legend>
        <div className="grid">
          {field('startedAt', t('startedAt'), '', (c) => (
            <input {...c} type="datetime-local" />
          ))}
          {field(
            'regionId',
            t('regionId'),
            '',
            (c) => (
              <>
                <select {...c} disabled={regionLocked} name={regionLocked ? undefined : 'regionId'}>
                  <option value="">{t('choose')}</option>
                  {regions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                {regionLocked ? <input type="hidden" name="regionId" value={v.regionId} /> : null}
              </>
            ),
            regionLocked ? t('regionLockedHint') : undefined,
          )}
          {field('painStart', t('painStartLabel'), '', (c) => (
            <select {...c}>
              <option value="">{t('choose')}</option>
              {PAIN_VALUES.map((p) => (
                <option key={p} value={String(p)}>
                  {p} %
                </option>
              ))}
            </select>
          ))}
          {field('diagnosis', t('diagnosis'), 'w6', (c) => (
            <textarea {...c} />
          ))}
          <div className={`f w6 ${errors.photos ? 'bad' : ''}`}>
            <span className="l">{t('photos')}</span>
            <PhotoField
              state={photos}
              saved={saved}
              id="f_photos"
              error={errors.photos ? te(errors.photos as 'photoType') : null}
            />
          </div>
        </div>
      </fieldset>
      <div className="formbar">
        <span className="muted" style={{ fontSize: 13 }}>
          {pending ? tp('saving') : tf('requiredNote')}
        </span>
        <div className="actions">
          <Link className="btn btn--ghost" href={cancelHref}>
            {tc('cancel')}
          </Link>
          <button type="submit" className="btn btn--gold" disabled={pending || !!photos.progress}>
            {id ? tc('saveChanges') : t('save')}
          </button>
        </div>
      </div>
    </form>
  );
}
