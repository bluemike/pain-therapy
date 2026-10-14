import { perWeek, repetitionParts, type Repetition } from './home-program';
import { addDays, DAY_MS, dayKey, daysBetween, weekKey } from './time';

/**
 * adherence-overview: Berechnung der Einhaltung (iteration 4, design D9). Pure functions, used by the practice app
 * (Kachel "Heimprogramm", Reiter "Übungstagebuch") and the patient zone (Stand "heute" und "diese Woche").
 */

/** Hinweise (confirmed by the practice on 14.10.2026) */
export const LOW_ADHERENCE_PERCENT = 50;
export const LOW_ADHERENCE_FROM_DAY = 3;
export const NO_ENTRY_DAYS = 3;
export const WINDOW_DAYS = 7;

export type AdherencePrescription = { exerciseCode: string; repetition: Repetition };
export type AdherenceEntry = {
  exerciseCode: string;
  performedAt: Date;
  done: boolean;
  rating: number | null;
  deletedAt?: Date | null;
};
export type Flag = 'lowAdherence' | 'noEntry';

const percent = (done: number, required: number) => (required > 0 ? Math.round((100 * done) / required) : null);

/**
 * Soll of the last 7 days: täglich n× = 7n, wöchentlich n× = n. Younger prescriptions are prorated by the days since
 * the consultation / 7, rounded up (at least one day, so the day of the consultation already counts).
 */
export function required(repetition: Repetition, daysSinceConsultation: number): number {
  const week = perWeek(repetition);
  if (daysSinceConsultation >= WINDOW_DAYS) return week;
  return Math.ceil((week * Math.max(1, daysSinceConsultation)) / WINDOW_DAYS);
}

const average = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

/**
 * Adherence of the last 7 days per exercise and in total. `entries` are the entries of this program; deleted
 * entries never count. Done executions count per exercise at most up to its requirement.
 */
export function adherence(
  prescriptions: AdherencePrescription[],
  entries: AdherenceEntry[],
  consultationAt: Date,
  now = new Date(),
) {
  const live = entries.filter((e) => !e.deletedAt && e.performedAt.getTime() <= now.getTime());
  const days = daysBetween(consultationAt, now);
  const windowStart = now.getTime() - WINDOW_DAYS * DAY_MS;
  const inWindow = live.filter((e) => e.performedAt.getTime() > windowStart);
  const perExercise = prescriptions.map((p) => {
    const mine = live.filter((e) => e.exerciseCode === p.exerciseCode);
    const recent = inWindow.filter((e) => e.exerciseCode === p.exerciseCode);
    const req = required(p.repetition, days);
    const done = Math.min(req, recent.filter((e) => e.done).length);
    const last = mine.reduce<Date | null>((a, e) => (!a || e.performedAt > a ? e.performedAt : a), null);
    return {
      exerciseCode: p.exerciseCode,
      repetition: p.repetition,
      required: req,
      done,
      percent: percent(done, req),
      averageRating: average(recent.flatMap((e) => (e.done && e.rating !== null ? [e.rating] : []))),
      lastEntryAt: last,
      /** All ratings of this program, oldest first, for "Bewertung im Verlauf" */
      ratings: mine
        .filter((e) => e.done && e.rating !== null)
        .sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime())
        .map((e) => ({ at: e.performedAt, rating: e.rating! })),
    };
  });
  const totalRequired = perExercise.reduce((a, x) => a + x.required, 0);
  const totalDone = perExercise.reduce((a, x) => a + x.done, 0);
  const lastEntryAt = live.reduce<Date | null>((a, e) => (!a || e.performedAt > a ? e.performedAt : a), null);
  const total = { required: totalRequired, done: totalDone, percent: percent(totalDone, totalRequired) };
  const flags: Flag[] = [];
  if (total.percent !== null && total.percent < LOW_ADHERENCE_PERCENT && days >= LOW_ADHERENCE_FROM_DAY)
    flags.push('lowAdherence');
  const since = lastEntryAt ?? consultationAt;
  if (now.getTime() - since.getTime() >= NO_ENTRY_DAYS * DAY_MS) flags.push('noEntry');
  return {
    daysSinceConsultation: days,
    perExercise,
    total,
    averageRating: average(inWindow.flatMap((e) => (e.done && e.rating !== null ? [e.rating] : []))),
    lastEntryAt,
    flags,
    trend: weeklyTrend(prescriptions, live, consultationAt, now),
  };
}
export type Adherence = ReturnType<typeof adherence>;

/**
 * Trend: adherence per calendar week (Monday to Sunday, Swiss time) since the consultation. The first and the
 * current week are prorated by their days (from the day of the consultation, up to today).
 */
export function weeklyTrend(
  prescriptions: AdherencePrescription[],
  entries: AdherenceEntry[],
  consultationAt: Date,
  now = new Date(),
): { week: string; percent: number | null }[] {
  const startDay = dayKey(consultationAt);
  const today = dayKey(now);
  const weeks: { week: string; percent: number | null }[] = [];
  for (let week = weekKey(consultationAt); week <= today; week = addDays(week, 7)) {
    const from = week < startDay ? startDay : week;
    const lastDay = addDays(week, 6);
    const to = lastDay > today ? today : lastDay;
    const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1;
    let req = 0;
    let done = 0;
    for (const p of prescriptions) {
      const r = Math.ceil((perWeek(p.repetition) * days) / WINDOW_DAYS);
      const n = entries.filter(
        (e) =>
          e.exerciseCode === p.exerciseCode &&
          e.done &&
          !e.deletedAt &&
          dayKey(e.performedAt) >= from &&
          dayKey(e.performedAt) <= to,
      ).length;
      req += r;
      done += Math.min(r, n);
    }
    weeks.push({ week, percent: percent(done, req) });
  }
  return weeks;
}

/**
 * Stand in the patient zone: daily exercises count today's executions ("heute 1 von 2"), weekly exercises those of
 * the current calendar week ("diese Woche 3 von 5").
 */
export function progress(p: AdherencePrescription, entries: AdherenceEntry[], now = new Date()) {
  const { daily, times } = repetitionParts(p.repetition);
  const today = dayKey(now);
  const week = weekKey(now);
  const done = entries.filter(
    (e) =>
      e.exerciseCode === p.exerciseCode &&
      e.done &&
      !e.deletedAt &&
      (daily ? dayKey(e.performedAt) === today : weekKey(e.performedAt) === week),
  ).length;
  return { period: daily ? ('today' as const) : ('week' as const), done, target: times, complete: done >= times };
}

/** "Alle heutigen Übungen erledigt": open executions of today per daily exercise */
export function openToday(prescriptions: AdherencePrescription[], entries: AdherenceEntry[], now = new Date()) {
  return prescriptions.flatMap((p) => {
    const pr = progress(p, entries, now);
    return pr.period === 'today' && pr.done < pr.target
      ? [{ exerciseCode: p.exerciseCode, count: pr.target - pr.done }]
      : [];
  });
}
