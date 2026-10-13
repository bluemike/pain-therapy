/**
 * home-program and exercise-library: repetitions and time per exercise, week and day (design D3, D4).
 * No server imports, so the consultation form computes the same totals as the PDF.
 */

export const REPETITIONS = [
  'DAILY_1',
  'DAILY_2',
  'DAILY_3',
  'WEEKLY_1',
  'WEEKLY_2',
  'WEEKLY_3',
  'WEEKLY_4',
  'WEEKLY_5',
  'WEEKLY_6',
  'WEEKLY_7',
] as const;
export type Repetition = (typeof REPETITIONS)[number];

/** Proposed for a newly prescribed exercise (decided by the practice on 13.10.2026) */
export const DEFAULT_REPETITION: Repetition = 'DAILY_1';

/** Intensity 1 to 9: the intensity must stay below 10 */
export const INTENSITIES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
/** "Schritte" as on the paper sheet: steps 1, 1-2 or 1-3 */
export const STEPS = [1, 2, 3] as const;

/** Above this many minutes per day the form shows that the programme is extensive */
export const MANY_MINUTES_PER_DAY = 30;

export function repetitionParts(r: Repetition): { daily: boolean; times: number } {
  const [kind, n] = r.split('_');
  return { daily: kind === 'DAILY', times: Number(n) };
}

/** Executions per week: täglich n× = 7·n, wöchentlich n× = n */
export function perWeek(r: Repetition): number {
  const { daily, times } = repetitionParts(r);
  return daily ? 7 * times : times;
}

/** The two fields of the paper sheet: "Häufigkeit pro Woche" and "täglich" */
export function sheetFields(r: Repetition): { perWeek: number; perDay: number } {
  const { daily, times } = repetitionParts(r);
  return daily ? { perWeek: 7, perDay: times } : { perWeek: times, perDay: 1 };
}

/** "1", "1-2" or "1-3" */
export const stepsLabel = (steps: number | null | undefined) => (steps ? (steps === 1 ? '1' : `1-${steps}`) : null);

export type Timing = { stretchSecondsPerSide: number | null; sides: number; rollingSeconds: number | null };

/**
 * Duration of one execution: rolling + stretch per side × sides. Values not yet set count as 0 and are reported, so
 * the form can show "Dehnung noch nicht festgelegt" (exercise-library: Wert fehlt).
 */
export function executionTime(t: Timing | null | undefined) {
  if (!t) return { seconds: 0, stretchMissing: true, rollingMissing: true };
  return {
    seconds: (t.rollingSeconds ?? 0) + (t.stretchSecondsPerSide ?? 0) * t.sides,
    stretchMissing: t.stretchSecondsPerSide === null,
    rollingMissing: t.rollingSeconds === null,
  };
}

export type ProgramItem = { code: string; repetition: Repetition; timing: Timing | null | undefined };

/** home-program: Gesamter Zeitbedarf. Week = Σ duration × executions per week; day = week / 7. */
export function programTime(items: ProgramItem[]) {
  let weekSeconds = 0;
  const incomplete: string[] = [];
  for (const it of items) {
    const e = executionTime(it.timing);
    if (e.stretchMissing || e.rollingMissing) incomplete.push(it.code);
    weekSeconds += e.seconds * perWeek(it.repetition);
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
