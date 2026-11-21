'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { savePractice, type PracticeFormState } from '@/app/(app)/practice/actions';

type Values = {
  name: string;
  street: string;
  zip: string;
  city: string;
  contactEmail: string;
  phone: string;
  defaultPlace: string;
  documentPrefix: string;
  privacyNotice: string;
};

const MAX: Record<string, number> = {
  name: 120,
  street: 120,
  city: 80,
  contactEmail: 254,
  phone: 40,
  defaultPlace: 80,
  privacyNotice: 8000,
};

/** practice-settings: Formular «Praxis» */
export function PracticeForm({
  initial,
  logoUrl,
  footer,
}: {
  initial: Values;
  logoUrl: string | null;
  footer: string;
}) {
  const t = useTranslations('practice');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<PracticeFormState, FormData>(savePractice, {});
  const errors = state.errors ?? {};
  const v = (k: keyof Values) => state.values?.[k] ?? initial[k];
  const msg = (k: string) =>
    errors[k] ? (
      <span className="msg" id={`f_${k}_m`}>
        {t.has(`error_${errors[k]}`)
          ? t(`error_${errors[k]}` as never)
          : te(errors[k] as 'required', { max: MAX[k] ?? 0 })}
      </span>
    ) : null;
  const field = (k: keyof Values, opts: { type?: string; required?: boolean; hint?: string } = {}) => (
    <div className={`f ${errors[k] ? 'bad' : ''}`}>
      <label className="l" htmlFor={`f_${k}`}>
        {t(k)}
        {opts.required ? <span className="req"> *</span> : null}
      </label>
      <input
        id={`f_${k}`}
        name={k}
        className="inp"
        type={opts.type ?? 'text'}
        defaultValue={v(k)}
        maxLength={MAX[k]}
        aria-required={opts.required || undefined}
        aria-invalid={errors[k] ? true : undefined}
        aria-describedby={errors[k] ? `f_${k}_m` : opts.hint ? `f_${k}_h` : undefined}
      />
      {msg(k) ??
        (opts.hint ? (
          <span className="hint" id={`f_${k}_h`}>
            {opts.hint}
          </span>
        ) : null)}
    </div>
  );
  return (
    <form className="form" action={action} noValidate key={JSON.stringify(state.values ?? {})}>
      {Object.keys(errors).length ? (
        <div className="banner err" role="alert">
          <p>{te('summary')}</p>
        </div>
      ) : null}
      <fieldset>
        <legend>{t('logo')}</legend>
        <div className="fs-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo from the database
            <img src={logoUrl} alt={t('logoCurrent')} style={{ height: 48, maxWidth: 200, objectFit: 'contain' }} />
          ) : (
            <b style={{ fontSize: 20 }}>{initial.name}</b>
          )}
          <div className={`f ${errors.logo ? 'bad' : ''}`} style={{ flex: 1, minWidth: 220 }}>
            <label className="l" htmlFor="f_logo">
              {t('logoUpload')}
            </label>
            <input
              id="f_logo"
              name="logo"
              type="file"
              accept="image/png,image/jpeg"
              aria-describedby={errors.logo ? 'f_logo_m' : 'f_logo_h'}
            />
            {msg('logo') ?? (
              <span className="hint" id="f_logo_h">
                {t('logoHint')}
              </span>
            )}
            {logoUrl ? (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                <input type="checkbox" name="removeLogo" /> {t('logoRemove')}
              </label>
            ) : null}
          </div>
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('details')}</legend>
        <div className="grid">
          {field('name', { required: true })}
          {field('documentPrefix', { required: true, hint: t('documentPrefixHint') })}
          {field('street')}
          {field('zip')}
          {field('city')}
          {field('contactEmail', { type: 'email', required: true, hint: t('contactEmailHint') })}
          {field('phone', { type: 'tel' })}
          {field('defaultPlace', { required: true, hint: t('defaultPlaceHint') })}
        </div>
        <p className="hint fs-foot">{footer}</p>
      </fieldset>
      <fieldset>
        <legend>{t('privacyNotice')}</legend>
        <div className={`f fs-body ${errors.privacyNotice ? 'bad' : ''}`}>
          <label className="l" htmlFor="f_privacyNotice">
            {t('privacyNoticeLabel')}
          </label>
          <textarea
            id="f_privacyNotice"
            name="privacyNotice"
            className="inp"
            rows={8}
            maxLength={8000}
            defaultValue={v('privacyNotice')}
            aria-describedby={errors.privacyNotice ? 'f_privacyNotice_m' : 'f_privacyNotice_h'}
          />
          {msg('privacyNotice') ?? (
            <span className="hint" id="f_privacyNotice_h">
              {t('privacyNoticeHint')}
            </span>
          )}
        </div>
      </fieldset>
      <div className="actions">
        <button className="btn btn--gold" disabled={pending}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}
