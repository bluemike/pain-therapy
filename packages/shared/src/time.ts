/**
 * Calendar days and weeks in Swiss time (Europe/Zurich), for "heute", "diese Woche", the adherence of the last 7 days
 * and the trend per calendar week (iteration 4, design D7, D9). Days are compared as keys "YYYY-MM-DD", so summer and
 * winter time never shift an entry to another day.
 */
export const TZ = 'Europe/Zurich';
export const DAY_MS = 24 * 60 * 60 * 1000;

const keyFormat = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: TZ });

/** "2026-10-14" for the Swiss calendar day of `d` */
export function dayKey(d: Date): string {
  return keyFormat.format(d);
}

const keyToUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Whole calendar days from the day of `from` to the day of `to` (0 on the same day) */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((keyToUtc(dayKey(to)) - keyToUtc(dayKey(from))) / DAY_MS);
}

/** Key of the Monday of the calendar week of `d` */
export function weekKey(d: Date): string {
  const utc = keyToUtc(dayKey(d));
  const weekday = (new Date(utc).getUTCDay() + 6) % 7; // Monday = 0
  return new Date(utc - weekday * DAY_MS).toISOString().slice(0, 10);
}

/** Adds days to a day key */
export function addDays(key: string, days: number): string {
  return new Date(keyToUtc(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Calendar months, e.g. the 6 months a link is valid; the day is kept (31 → last day of a shorter month) */
export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + months);
  const last = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TZ,
});

/** Date and time fields in Swiss time, e.g. { date: "2026-10-14", time: "08:12" }, for <input type="date|time"> */
export function zurichInputs(d: Date): { date: string; time: string } {
  const parts = partsFormat.formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
  return { date: `${p('year')}-${p('month')}-${p('day')}`, time: `${p('hour')}:${p('minute')}` };
}

/** Parses date ("YYYY-MM-DD") and time ("HH:MM") as Swiss time, or null if invalid */
export function fromZurichInputs(date: string, time: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const tm = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time.trim());
  if (!dm || !tm) return null;
  const [y, mo, d] = dm.slice(1).map(Number);
  const [h, mi] = tm.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wall);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59 || y < 1900) return null;
  // Start from UTC and correct by the Zurich offset; the second pass settles the days the clocks change
  let t = wall;
  for (let i = 0; i < 2; i++) {
    const shown = zurichInputs(new Date(t));
    const [sy, smo, sd] = shown.date.split('-').map(Number);
    const [sh, smi] = shown.time.split(':').map(Number);
    t += wall - Date.UTC(sy, smo - 1, sd, sh, smi);
  }
  return new Date(t);
}
