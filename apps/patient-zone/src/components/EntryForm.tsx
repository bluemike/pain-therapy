'use client';

import { useActionState, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { NOTE_MAX } from '@pain-therapy/shared/limits';
import { correctEntryAction, createEntryAction, type EntryState, type EntryValues } from '@/app/actions';

const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/**
 * exercise-log: Ausführung erfassen or correct an entry. "Gemacht?" and the rating 1 to 10 are radio buttons shown
 * as segments (44 px targets); with "Nein" the rating is hidden by CSS and not stored. Date and time are prefilled
 * with now and may not be in the future.
 */
export function EntryForm({
  mode,
  code,
  entryId,
  defaults,
  maxDate,
}: {
  mode: 'create' | 'correct';
  code: string;
  entryId?: string;
  defaults: EntryValues;
  maxDate: string;
}) {
  const t = useTranslations('entry');
  const [state, action, pending] = useActionState<EntryState, FormData>(
    mode === 'create' ? createEntryAction : correctEntryAction,
    {},
  );
  // After an error the fields are mounted again with what was entered
  const values = state.values ?? defaults;
  return (
    <form action={action} className="entry" aria-label={t(mode === 'create' ? 'legend' : 'legendCorrect', { code })}>
      <Fields key={state.attempt ?? 0} values={values} entryId={entryId} code={code} maxDate={maxDate} />
      {state.error ? (
        <div className="banner err" role="alert">
          {t(state.error)}
        </div>
      ) : null}
      <button className="btn btn--gold" disabled={pending}>
        {pending ? t('working') : t('save')}
      </button>
    </form>
  );
}

function Fields({
  values: defaults,
  entryId,
  code,
  maxDate,
}: {
  values: EntryValues;
  entryId?: string;
  code: string;
  maxDate: string;
}) {
  const t = useTranslations('entry');
  const id = useId();
  const [note, setNote] = useState(defaults.note);
  return (
    <>
      <input type="hidden" name="code" value={code} />
      {entryId ? <input type="hidden" name="id" value={entryId} /> : null}
      <fieldset className="seg">
        <legend className="lbl">{t('done')}</legend>
        <label>
          <input type="radio" name="done" value="yes" defaultChecked={defaults.done} />
          <span>{t('yes')}</span>
        </label>
        <label>
          <input type="radio" name="done" value="no" defaultChecked={!defaults.done} />
          <span>{t('no')}</span>
        </label>
      </fieldset>
      <fieldset className="rate">
        <legend className="lbl">{t('rating')}</legend>
        <div className="grid">
          {RATINGS.map((n) => (
            <label key={n}>
              <input type="radio" name="rating" value={n} defaultChecked={defaults.rating === n} />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <div className="scale" aria-hidden="true">
          <span>{t('scaleLow')}</span>
          <span>{t('scaleHigh')}</span>
        </div>
      </fieldset>
      <div className="dt">
        <label>
          <span className="lbl">{t('date')}</span>
          <input type="date" name="date" defaultValue={defaults.date} max={maxDate} required />
        </label>
        <label>
          <span className="lbl">{t('time')}</span>
          <input type="time" name="time" defaultValue={defaults.time} required />
        </label>
      </div>
      <label>
        <span className="lbl">{t('note')}</span>
        <textarea
          name="note"
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-describedby={`${id}-count`}
        />
        <span className="lbl" id={`${id}-count`}>
          {t('count', { n: note.length })}
        </span>
      </label>
    </>
  );
}
