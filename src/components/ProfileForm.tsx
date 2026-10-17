'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { saveProfile, type ProfileFormState } from '@/app/(app)/profile/actions';
import { TITLES } from '@/lib/schemas';

/** user-profile: Formular "Mein Profil" */
export function ProfileForm({ initial }: { initial: { displayName: string; title: (typeof TITLES)[number] } }) {
  const t = useTranslations('profile');
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfile, {});
  const errors = state.errors ?? {};
  return (
    <form className="form" action={action} noValidate>
      <fieldset>
        <legend>{t('title')}</legend>
        <div className="grid">
          <div className={`f ${errors.displayName ? 'bad' : ''}`}>
            <label className="l" htmlFor="f_displayName">
              {t('displayName')}
              <span className="req"> *</span>
            </label>
            <input
              id="f_displayName"
              name="displayName"
              className="inp"
              maxLength={40}
              defaultValue={initial.displayName}
              aria-required
              aria-invalid={errors.displayName ? true : undefined}
              aria-describedby={errors.displayName ? 'f_displayName_m' : 'f_displayName_h'}
            />
            {errors.displayName ? (
              <span className="msg" id="f_displayName_m">
                {te(errors.displayName as 'tooLong', { max: 40 })}
              </span>
            ) : (
              <span className="hint" id="f_displayName_h">
                {t('displayNameHint')}
              </span>
            )}
          </div>
          <div className="f">
            <label className="l" htmlFor="f_title">
              {t('professionalTitle')}
            </label>
            <select id="f_title" name="title" className="inp" defaultValue={initial.title}>
              {TITLES.map((x) => (
                <option key={x} value={x}>
                  {t(`title_${x}`)}
                </option>
              ))}
            </select>
            <span className="hint">{t('titleHint')}</span>
          </div>
        </div>
      </fieldset>
      <div className="formbar">
        <span />
        <div className="actions">
          <button type="submit" className="btn btn--gold" disabled={pending}>
            {tc('saveChanges')}
          </button>
        </div>
      </div>
    </form>
  );
}
