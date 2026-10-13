'use client';

/**
 * Segmentschalter (iteration 2, design D3): one tap chooses a value, a tap on the chosen value clears it. Buttons with aria-pressed
 * in a labelled group, so they work with the keyboard (Tab, Space, Enter) and announce their state.
 */
export function Seg<V extends string | number>({
  label,
  options,
  value,
  onChange,
  className = 'seg',
  required = false,
}: {
  label: string;
  options: [V, string][];
  value: V | null;
  onChange: (v: V | null) => void;
  className?: string;
  /** A tap on the chosen value keeps it (home-program: Wiederholung is required) */
  required?: boolean;
}) {
  return (
    <span className={className} role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(value === v && !required ? null : v)}
        >
          {l}
        </button>
      ))}
    </span>
  );
}
