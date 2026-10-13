'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { publishConsentText, type PublishState } from '@/app/(app)/actions';

export function ConsentTextForm({
  nextVersion,
  initial,
}: {
  nextVersion: number;
  initial: Record<'titleDe' | 'bodyDe' | 'titleEn' | 'bodyEn', string>;
}) {
  const t = useTranslations('admin');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<PublishState, FormData>(publishConsentText, {});
  const field = (name: keyof typeof initial, label: string, area?: boolean) => (
    <div className={`f ${state.errors?.[name] ? 'bad' : ''}`}>
      <label className="l" htmlFor={name}>
        {label}
      </label>
      {area ? (
        <textarea
          className="inp"
          id={name}
          name={name}
          defaultValue={initial[name]}
          rows={12}
          style={{ fontSize: 14 }}
        />
      ) : (
        <input className="inp" id={name} name={name} defaultValue={initial[name]} />
      )}
      {state.errors?.[name] ? <span className="msg">{te('required')}</span> : null}
    </div>
  );
  return (
    <form action={action} className="form" style={{ gap: 14 }}>
      {state.published ? (
        <div className="banner ok" role="status">
          <p>{t('published', { version: state.published })}</p>
        </div>
      ) : null}
      {field('titleDe', t('titleDe'))}
      {field('bodyDe', t('bodyDe'), true)}
      {field('titleEn', t('titleEn'))}
      {field('bodyEn', t('bodyEn'), true)}
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {t('bodyHint')}
      </p>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {t('publishNote')}
      </p>
      <button className="btn btn--gold" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {t('publish', { version: state.published ? state.published + 1 : nextVersion })}
      </button>
    </form>
  );
}
