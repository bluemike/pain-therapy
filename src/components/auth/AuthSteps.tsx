/**
 * Steps of sign-in and invitation (iteration 13): numbered chips in a row, done steps ticked, the current one
 * highlighted.
 */
export function AuthSteps({
  label,
  steps,
  current,
}: {
  label: string;
  steps: { key: string; label: string }[];
  current: string;
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
          <span className="n" aria-hidden="true">
            {i < at ? '✓' : i + 1}
          </span>
          <span className="t">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
