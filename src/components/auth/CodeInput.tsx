'use client';

/**
 * Six-digit code as separate boxes (iteration 13, Mike 20.11.2026). One real input lies over the boxes, so paste,
 * autofill of one-time codes (iOS, Android) and screen readers work as with a normal field.
 */
export function CodeInput({
  id,
  value,
  onChange,
  autoFocus,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  describedBy?: string;
}) {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  return (
    <div className="otp">
      <input
        className="otp-input"
        id={id}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        value={digits}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
      <div className="otp-boxes" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`${digits[i] ? 'full' : ''} ${i === Math.min(digits.length, 5) ? 'cur' : ''}`}>
            {digits[i] ?? ''}
          </span>
        ))}
      </div>
    </div>
  );
}
