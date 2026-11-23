'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createPracticeAction, practiceDetailsAction, type NewPracticeState } from '@/app/platform/actions';

type Field = { k: string; type?: string; required?: boolean; hint?: string; max: number };
type Group = { title: string; note?: string; fields: Field[] };

const NEW: Group[] = [
  {
    title: 'groupPractice',
    fields: [
      { k: 'name', required: true, max: 120 },
      { k: 'slug', required: true, hint: 'slugHint', max: 40 },
      { k: 'street', max: 120 },
      { k: 'zip', max: 5 },
      { k: 'city', required: true, max: 80 },
      { k: 'contactEmail', type: 'email', required: true, max: 254 },
      { k: 'documentPrefix', required: true, hint: 'documentPrefixHint', max: 4 },
    ],
  },
  {
    title: 'groupAdmin',
    fields: [
      { k: 'adminName', required: true, max: 100 },
      { k: 'adminEmail', type: 'email', required: true, max: 200 },
    ],
  },
];

const EDIT: Group[] = [
  {
    title: 'groupPractice',
    note: 'groupPracticeNote',
    fields: [
      { k: 'name', required: true, max: 120 },
      { k: 'documentPrefix', required: true, hint: 'documentPrefixHint', max: 4 },
      { k: 'street', max: 120 },
      { k: 'zip', max: 5 },
      { k: 'city', required: true, max: 80 },
      { k: 'defaultPlace', required: true, hint: 'defaultPlaceHint', max: 80 },
      { k: 'contactEmail', type: 'email', required: true, max: 254 },
      { k: 'phone', type: 'tel', max: 40 },
      { k: 'privacyOfficer', hint: 'privacyOfficerHint', max: 100 },
    ],
  },
  {
    title: 'groupAdminOptional',
    note: 'groupAdminNote',
    fields: [
      { k: 'adminName', max: 100 },
      { k: 'adminEmail', type: 'email', max: 200 },
    ],
  },
];

/**
 * platform-admin: «Neue Praxis» with its first practice admin, or (iteration 13) the details of an existing practice
 * together with the optional invitation of its practice admin.
 */
export function PlatformPracticeForm({ practice }: { practice?: { id: string; values: Record<string, string> } }) {
  const t = useTranslations('platformAdmin');
  const tp = useTranslations('practice');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<NewPracticeState, FormData>(
    practice ? practiceDetailsAction : createPracticeAction,
    {},
  );
  const [withAdmin, setWithAdmin] = useState(false);
  const errors = state.errors ?? {};
  const prefix = practice ? `e_${practice.id}_` : 'n_';
  const initial = (k: string) =>
    state.values?.[k] ?? practice?.values[k] ?? (k === 'documentPrefix' && !practice ? 'PT' : '');
  const msg = (k: string, max: number) => {
    const e = errors[k];
    if (!e) return null;
    const text =
      e === 'slug' ? t('slugHint') : tp.has(`error_${e}`) ? tp(`error_${e}` as never) : te(e as 'required', { max });
    return (
      <span className="msg" id={`${prefix}${k}_m`}>
        {text}
      </span>
    );
  };
  return (
    <form
      action={action}
      className="platform-form"
      noValidate
      onChange={(e) => {
        const email = e.currentTarget.elements.namedItem('adminEmail') as HTMLInputElement | null;
        setWithAdmin(!!email?.value.trim());
      }}
    >
      {practice ? <input type="hidden" name="id" value={practice.id} /> : null}
      {(practice ? EDIT : NEW).map((g) => [
        <p key={g.title} className="group">
          {t(g.title as 'groupPractice')}
          {g.note ? <small>{t(g.note as 'groupAdminNote')}</small> : null}
        </p>,
        ...g.fields.map(({ k, type, required, hint, max }) => (
          <div key={k} className={`f ${errors[k] ? 'bad' : ''}`}>
            <label className="l" htmlFor={`${prefix}${k}`}>
              {t(k as 'name')}
              {required ? <span className="req"> *</span> : null}
            </label>
            <input
              className="inp"
              id={`${prefix}${k}`}
              name={k}
              type={type ?? 'text'}
              maxLength={max}
              defaultValue={initial(k)}
              aria-invalid={errors[k] ? true : undefined}
              aria-describedby={errors[k] ? `${prefix}${k}_m` : hint ? `${prefix}${k}_h` : undefined}
              autoComplete="off"
            />
            {hint && !errors[k] ? (
              <span className="hint" id={`${prefix}${k}_h`}>
                {t(hint as 'slugHint')}
              </span>
            ) : null}
            {msg(k, max)}
          </div>
        )),
      ])}
      <button className="btn btn--gold" disabled={pending}>
        {practice ? (withAdmin ? t('saveAndInvite') : t('saveDetails')) : t('create')}
      </button>
    </form>
  );
}
