import { scheduledOn, type Schedule } from './home-program';
import { addDays, dayKey, daysBetween, weekKey } from './time';

/**
 * adherence-overview: Berechnung der Einhaltung (iteration 4, design D9). Pure functions, used by the practice app
 * (Kachel "Heimprogramm", Reiter "Übungstagebuch") and the patient zone (Stand "heute"). Since iteration 8 (design
 * D8) only the selected weekdays count: Soll = selected days × executions per day.
 */

/** Hinweise (confirmed by the practice on 14.10.2026) */
export const LOW_ADHERENCE_PERCENT = 50;
export const LOW_ADHERENCE_FROM_DAY = 3;
export const NO_ENTRY_DAYS = 3;
export const WINDOW_DAYS = 7;

export type AdherencePrescription = { exerciseCode: string; schedule: Schedule };
export type AdherenceEntry = {
  exerciseCode: string;
  performedAt: Date;
  done: boolean;
  rating: number | null;
  deletedAt?: Date | null;
};
export type Flag = 'lowAdherence' | 'noEntry';

const percent = (done: number, required: number) => (required > 0 ? Math.round((100 * done) / required) : null);

/** Selected days from the day key `from` to `to` (both included) */
export function scheduledDays(schedule: Pick<Schedule, 'weekdays'>, from: string, to: string): number {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (scheduledOn(schedule, d)) n++;
  return n;
}

/**
 * Soll of the last 7 days (today and the 6 days before, from the day of the session at the earliest): selected
 * weekdays in that window × executions per day.
 */
export function required(schedule: Schedule, consultationAt: Date, now = new Date()): number {
  const today = dayKey(now);
  const windowStart = addDays(today, -(WINDOW_DAYS - 1));
  const start = dayKey(consultationAt);
  return scheduledDays(schedule, start > windowStart ? start : windowStart, today) * schedule.timesPerDay;
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
  const today = dayKey(now);
  // The same 7 calendar days as the Soll: today and the 6 days before
  const windowStart = addDays(today, -(WINDOW_DAYS - 1));
  const inWindow = live.filter((e) => dayKey(e.performedAt) >= windowStart);
  const perExercise = prescriptions.map((p) => {
    const mine = live.filter((e) => e.exerciseCode === p.exerciseCode);
    const recent = inWindow.filter((e) => e.exerciseCode === p.exerciseCode);
    const req = required(p.schedule, consultationAt, now);
    const done = Math.min(req, recent.filter((e) => e.done).length);
    const last = mine.reduce<Date | null>((a, e) => (!a || e.performedAt > a ? e.performedAt : a), null);
    return {
      exerciseCode: p.exerciseCode,
      schedule: p.schedule,
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
  // "3 Tage ohne Eintrag": selected days of any prescription after the day of the last entry (or of the session)
  const since = dayKey(lastEntryAt ?? consultationAt);
  let missed = 0;
  for (let d = addDays(since, 1); d <= today; d = addDays(d, 1))
    if (prescriptions.some((p) => scheduledOn(p.schedule, d))) missed++;
  if (missed >= NO_ENTRY_DAYS) flags.push('noEntry');
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
    let req = 0;
    let done = 0;
    for (const p of prescriptions) {
      const r = scheduledDays(p.schedule, from, to) * p.schedule.timesPerDay;
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
 * Stand in the patient zone: today's executions ("heute 1 von 2"). On a day that is not selected the target is 0 and
 * the exercise is not open; an entry is still possible and counts (iteration 8, design D8).
 */
export function progress(p: AdherencePrescription, entries: AdherenceEntry[], now = new Date()) {
  const today = dayKey(now);
  const scheduledToday = scheduledOn(p.schedule, today);
  const target = scheduledToday ? p.schedule.timesPerDay : 0;
  const done = entries.filter(
    (e) => e.exerciseCode === p.exerciseCode && e.done && !e.deletedAt && dayKey(e.performedAt) === today,
  ).length;
  return { done, target, scheduledToday, complete: done >= target };
}

/** "Alle heutigen Übungen erledigt": open executions of today per exercise selected for today */
export function openToday(prescriptions: AdherencePrescription[], entries: AdherenceEntry[], now = new Date()) {
  return prescriptions.flatMap((p) => {
    const pr = progress(p, entries, now);
    return pr.done < pr.target ? [{ exerciseCode: p.exerciseCode, count: pr.target - pr.done }] : [];
  });
}
