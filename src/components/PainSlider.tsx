'use client';

import { useTranslations } from 'next-intl';

/**
 * pain-input (iteration 11): Schieberegler for a pain level from 0 to 100 % in steps of 10, replacing the buttons
 * 0 to 100. Without a value the thumb is shown dimmed and the readout says "nicht erfasst"; the first touch or arrow key
 * sets a value. "Zurücksetzen" clears it again, unless the value is required. With `name` the value goes into the form
 * as a hidden field ('' without value).
 */
export function PainSlider({
  id,
  label,
  value,
  onChange,
  name,
  required = false,
  describedBy,
  invalid,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  name?: string;
  required?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const t = useTranslations('scales');
  const unset = value === null;
  const pick = (e: React.SyntheticEvent<HTMLInputElement>) => onChange(Number(e.currentTarget.value));
  return (
    <span className={`painslider${unset ? ' unset' : ''}`}>
      <input
        type="range"
        className="inp"
        id={id}
        min={0}
        max={100}
        step={10}
        value={value ?? 50}
        aria-label={label}
        aria-valuetext={unset ? t('painUnset') : `${value} %`}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={pick}
        // A tap on the dimmed thumb keeps the position and fires no change: it still sets the value
        onPointerUp={unset ? pick : undefined}
        onKeyDown={unset ? (e) => (e.key === ' ' || e.key === 'Enter') && pick(e) : undefined}
      />
      <output htmlFor={id} className="num" aria-live="polite">
        {unset ? t('painUnset') : `${value} %`}
      </output>
      {!required && !unset ? (
        <button type="button" className="btn btn--ghost" onClick={() => onChange(null)}>
          {t('painClear')}
        </button>
      ) : null}
      {name ? <input type="hidden" name={name} value={unset ? '' : String(value)} /> : null}
    </span>
  );
}
