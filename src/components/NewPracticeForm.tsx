'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { createPracticeAction, type NewPracticeState } from '@/app/platform/actions';

const FIELDS: { k: string; type?: string; required?: boolean; hint?: string; max: number }[] = [
  { k: 'name', required: true, max: 120 },
  { k: 'slug', required: true, hint: 'slugHint', max: 40 },
  { k: 'street', max: 120 },
  { k: 'zip', max: 5 },
  { k: 'city', required: true, max: 80 },
  { k: 'contactEmail', type: 'email', required: true, max: 254 },
  { k: 'documentPrefix', required: true, max: 4 },
  { k: 'adminName', required: true, max: 100 },
  { k: 'adminEmail', type: 'email', required: true, max: 200 },
];

/** platform-admin: «Neue Praxis» with its first practice admin */
export function NewPracticeForm() {
  const t = useTranslations('platformAdmin');
  const tp = useTranslations('practice');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<NewPracticeState, FormData>(createPracticeAction, {});
  const errors = state.errors ?? {};
  const msg = (k: string, max: number) => {
    const e = errors[k];
    if (!e) return null;
    const text =
      e === 'slug' ? t('slugHint') : tp.has(`error_${e}`) ? tp(`error_${e}` as never) : te(e as 'required', { max });
    return (
      <span className="msg" id={`n_${k}_m`}>
        {text}
      </span>
    );
  };
  return (
    <form action={action} className="platform-form" noValidate>
      {FIELDS.map(({ k, type, required, hint, max }) => (
        <div key={k} className={`f ${errors[k] ? 'bad' : ''}`}>
          <label className="l" htmlFor={`n_${k}`}>
            {t(k as 'name')}
            {required ? <span className="req"> *</span> : null}
          </label>
          <input
            id={`n_${k}`}
            name={k}
            type={type ?? 'text'}
            maxLength={max}
            defaultValue={state.values?.[k] ?? (k === 'documentPrefix' ? 'PT' : '')}
            aria-invalid={errors[k] ? true : undefined}
            aria-describedby={errors[k] ? `n_${k}_m` : hint ? `n_${k}_h` : undefined}
            autoComplete="off"
          />
          {hint && !errors[k] ? (
            <span className="hint" id={`n_${k}_h`}>
              {t(hint as 'slugHint')}
            </span>
          ) : null}
          {msg(k, max)}
        </div>
      ))}
      <button className="btn btn--gold" disabled={pending}>
        {t('create')}
      </button>
    </form>
  );
}
