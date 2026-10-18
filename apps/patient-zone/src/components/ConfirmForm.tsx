'use client';

import { useActionState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { dobStep, onlyDigits, type DobField } from '@pain-therapy/shared/dob-input';
import { confirmAction, type ConfirmState } from '@/app/actions';
import { Invalid } from './Invalid';

/**
 * patient-access: Bestätigung mit dem Geburtsdatum (TT.MM.JJJJ in three fields with numeric keyboard). Neutral
 * messages: "Die Angabe stimmt nicht." or "Zu viele Versuche …"; nothing about the patient.
 *
 * zone-login (iteration 9): after 2 digits of day and month the cursor moves on, deleting in an empty field goes
 * back, and 4 digits of the year submit the form.
 */
export function ConfirmForm({ token, locked }: { token: string; locked: boolean }) {
  const t = useTranslations('confirm');
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmAction, {});
  const form = useRef<HTMLFormElement>(null);
  const refs = {
    day: useRef<HTMLInputElement>(null),
    month: useRef<HTMLInputElement>(null),
    year: useRef<HTMLInputElement>(null),
  };
  if (state.error === 'invalid') return <Invalid />;
  const error = state.error ?? (locked ? 'locked' : undefined);
  const disabled = pending || error === 'locked' || error === 'tooMany';
  const order: DobField[] = ['day', 'month', 'year'];
  const field = (name: DobField, max: number) => ({
    ref: refs[name],
    onInput: (e: React.FormEvent<HTMLInputElement>) => {
      const el = e.currentTarget;
      el.value = onlyDigits(el.value, max);
      const step = dobStep(name, el.value, {
        day: refs.day.current?.value ?? '',
        month: refs.month.current?.value ?? '',
      });
      if (step === 'next') refs[order[order.indexOf(name) + 1]].current?.focus();
      if (step === 'submit') form.current?.requestSubmit();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      const i = order.indexOf(name);
      if (e.key === 'Backspace' && e.currentTarget.value === '' && i > 0) {
        e.preventDefault();
        refs[order[i - 1]].current?.focus();
      }
    },
  });
  return (
    <form ref={form} action={action} className="confirm" noValidate>
      <input type="hidden" name="token" value={token} />
      {error ? (
        <div className="banner err" role="alert">
          {t(error)}
        </div>
      ) : null}
      <fieldset>
        <legend className="lbl">{t('dob')}</legend>
        <div className="dob">
          <label>
            <span className="lbl">{t('day')}</span>
            <input
              name="day"
              {...field('day', 2)}
              defaultValue={state.values?.day}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              autoComplete="bday-day"
              disabled={disabled}
              required
            />
          </label>
          <label>
            <span className="lbl">{t('month')}</span>
            <input
              name="month"
              {...field('month', 2)}
              defaultValue={state.values?.month}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              autoComplete="bday-month"
              disabled={disabled}
              required
            />
          </label>
          <label>
            <span className="lbl">{t('year')}</span>
            <input
              name="year"
              {...field('year', 4)}
              defaultValue={state.values?.year}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              autoComplete="bday-year"
              disabled={disabled}
              required
            />
          </label>
        </div>
      </fieldset>
      <button className="btn btn--gold btn--block" disabled={disabled}>
        {pending ? t('working') : t('submit')}
      </button>
      <p className="lbl">{t('remember')}</p>
    </form>
  );
}
