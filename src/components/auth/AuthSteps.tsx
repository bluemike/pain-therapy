import { Check } from 'lucide-react';

/**
 * Steps of sign-in and invitation (iteration 13): numbered chips in a row, done steps ticked, the current one
 * highlighted.
 */
export function AuthSteps({
  label,
  steps,
  current,
  onBack = {},
}: {
  label: string;
  steps: { key: string; label: string }[];
  current: string;
  /** Done steps the person can go back to, e.g. «E-Mail» to use another address */
  onBack?: Record<string, { label: string; go: () => void }>;
}) {
  const at = steps.findIndex((s) => s.key === current);
  return (
    <ol className="auth-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li
          key={s.key}
          className={i === at ? 'on' : i < at ? 'done' : undefined}
          aria-current={i === at ? 'step' : undefined}
        >
          {i < at && onBack[s.key] ? (
            <button type="button" className="back" onClick={onBack[s.key]!.go} title={onBack[s.key]!.label}>
              <span className="n" aria-hidden="true">
                <Check size={14} strokeWidth={3} />
              </span>
              <span className="t">{s.label}</span>
              <span className="sr-only">{` (${onBack[s.key]!.label})`}</span>
            </button>
          ) : (
            <>
              <span className="n" aria-hidden="true">
                {i < at ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <span className="t">{s.label}</span>
            </>
          )}
        </li>
      ))}
    </ol>
  );
}
