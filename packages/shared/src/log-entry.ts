import { z } from 'zod';
import { DAY_MS, fromZurichInputs } from './time';
import { EDIT_HOURS, HISTORY_DAYS, NOTE_MAX, RATING_MAX, RATING_MIN } from './limits';

/**
 * exercise-log: Ausführung erfassen, Datum und Zeit, Korrektur (iteration 4, design D7, D8). The same limits are
 * enforced by the database (ExerciseLogEntry_*_check).
 */
export * from './limits';

const blankToNull = (v: unknown) => (v === '' || v === undefined ? null : v);

/**
 * Fields of the entry form: done "yes"/"no", rating 1 to 10 (required when done, never when not done), date and
 * time in Swiss time, optional note. Error messages are keys of the patient zone's "entry" namespace.
 */
export const logEntryFormSchema = z
  .object({
    code: z.string().regex(/^[1-9][A-Z]$/, 'error'),
    done: z.enum(['yes', 'no'], { error: 'doneRequired' }),
    rating: z.preprocess(
      blankToNull,
      z.coerce
        .number({ error: 'ratingRange' })
        .int('ratingRange')
        .min(RATING_MIN, 'ratingRange')
        .max(RATING_MAX, 'ratingRange')
        .nullable(),
    ),
    date: z.string(),
    time: z.string(),
    note: z.preprocess(
      (v) => (typeof v === 'string' && v.trim() === '' ? null : typeof v === 'string' ? v.trim() : null),
      z.string().max(NOTE_MAX, 'noteTooLong').nullable(),
    ),
  })
  .superRefine((x, ctx) => {
    if (x.done === 'yes' && x.rating === null)
      ctx.addIssue({ code: 'custom', path: ['rating'], message: 'ratingRequired' });
    if (x.done === 'no' && x.rating !== null)
      ctx.addIssue({ code: 'custom', path: ['rating'], message: 'ratingWithoutDone' });
    if (!fromZurichInputs(x.date, x.time)) ctx.addIssue({ code: 'custom', path: ['date'], message: 'dateInvalid' });
  })
  .transform((x) => ({
    code: x.code,
    done: x.done === 'yes',
    rating: x.done === 'yes' ? x.rating : null,
    note: x.note,
    performedAt: fromZurichInputs(x.date, x.time)!,
  }));
export type LogEntryInput = z.output<typeof logEntryFormSchema>;

/** Rating of a stored entry: 1 to 10 or null, and null unless done (also for the quick entry, completed later) */
export function validRating(done: boolean, rating: number | null): boolean {
  if (rating === null) return true;
  return done && Number.isInteger(rating) && rating >= RATING_MIN && rating <= RATING_MAX;
}

/** Datum und Zeit: not in the future, not before the consultation of the prescription */
export function performedAtProblem(
  performedAt: Date,
  consultationAt: Date,
  now = new Date(),
): 'future' | 'beforeConsultation' | null {
  if (performedAt.getTime() > now.getTime()) return 'future';
  if (performedAt.getTime() < consultationAt.getTime()) return 'beforeConsultation';
  return null;
}

/** Korrektur innerhalb von 24 Stunden after recording the entry */
export function editable(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() < EDIT_HOURS * 60 * 60 * 1000;
}

/** Start of "Letzte 14 Tage" */
export function historyStart(now = new Date()): Date {
  return new Date(now.getTime() - HISTORY_DAYS * DAY_MS);
}
