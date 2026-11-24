'use client';

import { useActionState, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { parseBlocks } from '@pain-therapy/shared/consent-blocks';
import { FIELD_NAMES, fillFields, type FieldKey, type FieldValues } from '@pain-therapy/shared/consent-fields';
import { publishConsentText, type PublishState } from '@/app/(app)/actions';

type Name = 'titleDe' | 'bodyDe' | 'titleEn' | 'bodyEn';
const KEYS: FieldKey[] = ['practiceName', 'address', 'email', 'phone', 'responsible'];

/** Text with the fields filled, as patients see it (iteration 17, design D1) */
function Preview({ title, body, values }: { title: string; body: string; values: FieldValues }) {
  return (
    <div className="admin-text consent-preview">
      <b>{fillFields(title, values)}</b>
      {parseBlocks(fillFields(body, values)).map((b, i) =>
        b.type === 'h' ? (
          <h4 key={i}>{b.text}</h4>
        ) : b.type === 'ul' ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>{it}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.text}</p>
        ),
      )}
    </div>
  );
}

export function ConsentTextForm({
  nextVersion,
  initial,
  values,
  fromTemplate = false,
}: {
  nextVersion: number;
  initial: Record<Name, string>;
  /** Current practice details for the fields and the preview */
  values: FieldValues;
  fromTemplate?: boolean;
}) {
  const t = useTranslations('admin');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<PublishState, FormData>(publishConsentText, {});
  const [text, setText] = useState(initial);
  // Iteration 18 (design D3): by default the new version is signed at the next new treatment or session
  const [resignMode, setResignMode] = useState<'next' | 'all'>('next');
  const last = useRef<Name>('bodyDe');
  const refs = useRef<Partial<Record<Name, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  /** Inserts a field at the cursor of the text last edited (body in the language of the field name) */
  const insert = (name: string, lang: 'de' | 'en') => {
    const target: Name = last.current.endsWith(lang === 'de' ? 'De' : 'En')
      ? last.current
      : lang === 'de'
        ? 'bodyDe'
        : 'bodyEn';
    const el = refs.current[target];
    const token = `«${name}»`;
    const cur = text[target];
    const at = el && document.activeElement !== null ? (el.selectionStart ?? cur.length) : cur.length;
    const next = cur.slice(0, at) + token + cur.slice(el?.selectionEnd ?? at);
    setText((s) => ({ ...s, [target]: next }));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const field = (name: Name, label: string, area?: boolean) => {
    const err = state.errors?.[name];
    const common = {
      className: 'inp',
      id: name,
      name,
      value: text[name],
      onFocus: () => (last.current = name),
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setText((s) => ({ ...s, [name]: e.target.value })),
    };
    return (
      <div className={`f ${err ? 'bad' : ''}`}>
        <label className="l" htmlFor={name}>
          {label}
        </label>
        {area ? (
          <textarea {...common} ref={(el) => void (refs.current[name] = el)} rows={12} style={{ fontSize: 14 }} />
        ) : (
          <input {...common} ref={(el) => void (refs.current[name] = el)} />
        )}
        {err ? (
          <span className="msg">
            {err === 'unknownField'
              ? t('unknownField', {
                  names: (state.unknown?.[name] ?? []).map((n) => `«${n}»`).join(', '),
                  allowed: KEYS.map((k) => `«${FIELD_NAMES[name.endsWith('En') ? 'en' : 'de'][k]}»`).join(', '),
                })
              : te('required')}
          </span>
        ) : null}
      </div>
    );
  };

  const fieldList = (lang: 'de' | 'en') => (
    <div className="consent-fields" data-testid={`fields-${lang}`}>
      <span className="muted">{t(lang === 'de' ? 'fieldsDe' : 'fieldsEn')}</span>
      <dl>
        {KEYS.map((k) => (
          <div key={k}>
            <dt>
              <button type="button" className="field-chip" onClick={() => insert(FIELD_NAMES[lang][k], lang)}>
                «{FIELD_NAMES[lang][k]}»
              </button>
            </dt>
            <dd className={values[k] ? undefined : 'muted'}>{values[k] || t('fieldEmpty')}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <form action={action} className="form" style={{ gap: 14 }}>
      {fromTemplate ? <input type="hidden" name="fromTemplate" value="1" /> : null}
      {state.published ? (
        <div className="banner ok" role="status">
          <p>{t('published', { version: state.published })}</p>
        </div>
      ) : null}
      {field('titleDe', t('titleDe'))}
      {field('bodyDe', t('bodyDe'), true)}
      {fieldList('de')}
      <details>
        <summary>{t('previewDe')}</summary>
        <Preview title={text.titleDe} body={text.bodyDe} values={values} />
      </details>
      {field('titleEn', t('titleEn'))}
      {field('bodyEn', t('bodyEn'), true)}
      {fieldList('en')}
      <details>
        <summary>{t('previewEn')}</summary>
        <Preview title={text.titleEn} body={text.bodyEn} values={values} />
      </details>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {t('bodyHint')}
      </p>
      <fieldset className="choice" data-testid="resign-mode">
        <legend>{t('resignLegend')}</legend>
        <label className={`card ${resignMode === 'next' ? 'on' : ''}`}>
          <input
            type="radio"
            name="resignMode"
            value="next"
            checked={resignMode === 'next'}
            onChange={() => setResignMode('next')}
          />
          <span>
            <b>{t('resignNext')}</b>
            <span className="d">{t('resignNextText')}</span>
          </span>
        </label>
        <label className={`card ${resignMode === 'all' ? 'on' : ''}`}>
          <input
            type="radio"
            name="resignMode"
            value="all"
            checked={resignMode === 'all'}
            onChange={() => setResignMode('all')}
          />
          <span>
            <b>{t('resignAll')}</b>
            <span className="d">{t('resignAllText')}</span>
          </span>
        </label>
      </fieldset>
      <button className="btn btn--gold" disabled={pending} style={{ alignSelf: 'flex-start' }}>
        {t('publish', { version: state.published ? state.published + 1 : nextVersion })}
      </button>
    </form>
  );
}
