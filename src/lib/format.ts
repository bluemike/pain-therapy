/** Swiss formats in both languages (localization: Schweizer Formate). */
const TZ = 'Europe/Zurich';

export function formatDate(d: Date | null | undefined): string {
  if (!d) return '';
  // Dates of birth are stored as UTC midnight (@db.Date); format them in UTC so they never shift.
  return new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return '';
  const parts = new Intl.DateTimeFormat('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
    hour12: false,
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  return `${p('day')}.${p('month')}.${p('year')} ${p('hour')}:${p('minute')}`;
}

export function formatDateZurich(d: Date): string {
  return formatDateTime(d).slice(0, 10);
}

/** Parses DD.MM.YYYY (also D.M.YYYY) into a UTC date, or null if invalid. */
export function parseSwissDate(input: string): Date | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(input);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900) return null;
  return date;
}

export function ageOn(dob: Date, at = new Date()): number {
  let age = at.getUTCFullYear() - dob.getUTCFullYear();
  const m = at.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && at.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

export function hourInZurich(d = new Date()): number {
  // formatToParts: de-CH formats a lone hour as "12 Uhr"
  const parts = new Intl.DateTimeFormat('de-CH', { hour: '2-digit', hourCycle: 'h23', timeZone: TZ }).formatToParts(d);
  return Number(parts.find((p) => p.type === 'hour')?.value);
}

/** dashboard: Begrüssung nach Tageszeit (Swiss time) */
export function greetingKey(hour: number): 'greetingMorning' | 'greetingDay' | 'greetingEvening' {
  return hour < 11 ? 'greetingMorning' : hour < 18 ? 'greetingDay' : 'greetingEvening';
}
