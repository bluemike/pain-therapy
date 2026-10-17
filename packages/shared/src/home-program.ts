/**
 * home-program and exercise-library: schedule and time per exercise, week and day (iteration 3, design D3, D4;
 * iteration 8, design D7).
 * No server imports, so the consultation form computes the same totals as the PDF. Shared by the practice app and
 * the patient zone (iteration 4, design D11).
 */

/**
 * Selbstausführung (iteration 8, design D7): executions per day and weekdays instead of "täglich/wöchentlich n×".
 * Weekdays are a bit mask, Monday = 1, Tuesday = 2 … Sunday = 64; 127 = every day.
 */
export const TIMES_PER_DAY = [1, 2, 3] as const;
export const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export const ALL_WEEKDAYS = 127;

export type Schedule = { timesPerDay: number; weekdays: number };

/** Proposed for a newly prescribed exercise: 1× per day, every day */
export const DEFAULT_SCHEDULE: Schedule = { timesPerDay: 1, weekdays: ALL_WEEKDAYS };

/** Above this many minutes per day the form shows that the programme is extensive */
export const MANY_MINUTES_PER_DAY = 30;

export const weekdayBit = (index: number) => 1 << index;

/** The selected weekdays, Monday first */
export function weekdaysOf(mask: number): Weekday[] {
  return WEEKDAYS.filter((_, i) => mask & weekdayBit(i));
}

export function dayCount(mask: number): number {
  return weekdaysOf(mask).length;
}

export const validSchedule = (s: Schedule) =>
  (TIMES_PER_DAY as readonly number[]).includes(s.timesPerDay) &&
  Number.isInteger(s.weekdays) &&
  s.weekdays >= 1 &&
  s.weekdays <= ALL_WEEKDAYS;

/** Executions per week: per day × selected weekdays */
export function perWeek(s: Schedule): number {
  return s.timesPerDay * dayCount(s.weekdays);
}

/** Weekday index (Monday = 0) of a day key "YYYY-MM-DD" */
export function weekdayIndex(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Is the exercise prescribed on this day? */
export function scheduledOn(s: Pick<Schedule, 'weekdays'>, dayKey: string): boolean {
  return (s.weekdays & weekdayBit(weekdayIndex(dayKey))) !== 0;
}

/**
 * Duration parts of an exercise: FRM (rollingSeconds) and EPD. With a variant that states its own time,
 * `epdSeconds` replaces the standard exercise (iteration 8, design D2).
 */
export type Timing = {
  stretchSecondsPerSide: number | null;
  sides: number;
  rollingSeconds: number | null;
  epdSeconds?: number | null;
};

/** The timing of an exercise with the chosen EPD: a variant's own time, otherwise that of the standard exercise */
export function withVariant(t: Timing | null | undefined, variantSeconds: number | null | undefined): Timing | null {
  if (!t) return null;
  return variantSeconds ? { ...t, epdSeconds: variantSeconds } : t;
}

/**
 * Duration of one execution: rolling + stretch per side × sides. Values not yet set count as 0 and are reported, so
 * the form can show "Dehnung noch nicht festgelegt" (exercise-library: Wert fehlt).
 */
export function executionTime(t: Timing | null | undefined) {
  if (!t) return { seconds: 0, stretchMissing: true, rollingMissing: true };
  const epd = t.epdSeconds ?? (t.stretchSecondsPerSide === null ? null : t.stretchSecondsPerSide * t.sides);
  return {
    seconds: (t.rollingSeconds ?? 0) + (epd ?? 0),
    stretchMissing: epd === null,
    rollingMissing: t.rollingSeconds === null,
  };
}

export type ProgramItem = { code: string; schedule: Schedule; timing: Timing | null | undefined };

/** home-program: Gesamter Zeitbedarf. Week = Σ duration × executions per week; day = week / 7. */
export function programTime(items: ProgramItem[]) {
  let weekSeconds = 0;
  const incomplete: string[] = [];
  for (const it of items) {
    const e = executionTime(it.timing);
    if (e.stretchMissing || e.rollingMissing) incomplete.push(it.code);
    weekSeconds += e.seconds * perWeek(it.schedule);
  }
  const weekMinutes = weekSeconds / 60;
  const dayMinutes = weekMinutes / 7;
  return {
    weekMinutes,
    dayMinutes,
    /** Exercises whose duration is incomplete (left out of the sums except for the parts that are set) */
    incomplete,
    extensive: dayMinutes > MANY_MINUTES_PER_DAY,
  };
}

/** Minutes for display: whole minutes, one decimal below 10 minutes when not whole (e.g. 4.5) */
export function formatMinutes(minutes: number, locale = 'de'): string {
  const rounded =
    minutes < 10 && Math.round(minutes * 10) % 10 !== 0 ? Math.round(minutes * 10) / 10 : Math.round(minutes);
  return `${rounded.toLocaleString(locale === 'en' ? 'en-GB' : 'de-CH')} min`;
}
