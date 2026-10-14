'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { confirmAction, type ConfirmState } from '@/app/actions';
import { Invalid } from './Invalid';

/**
 * patient-access: Bestätigung mit dem Geburtsdatum (TT.MM.JJJJ in three fields with numeric keyboard). Neutral
 * messages: "Die Angabe stimmt nicht." or "Zu viele Versuche …"; nothing about the patient.
 */
export function ConfirmForm({ token, locked }: { token: string; locked: boolean }) {
  const t = useTranslations('confirm');
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmAction, {});
  if (state.error === 'invalid') return <Invalid />;
  const error = state.error ?? (locked ? 'locked' : undefined);
  const disabled = pending || error === 'locked' || error === 'tooMany';
  return (
    <form action={action} className="confirm" noValidate>
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
