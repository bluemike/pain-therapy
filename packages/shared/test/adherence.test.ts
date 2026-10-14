import { describe, expect, it } from 'vitest';
import { adherence, openToday, progress, required, weeklyTrend, type AdherenceEntry } from '../src/adherence';
import { DAY_MS } from '../src/time';

/** adherence-overview: Berechnung der Einhaltung and Hinweise (iteration 4, tasks 2.3 and 8.1) */

const now = new Date('2026-10-14T10:00:00Z'); // Wednesday, 12:00 in Zurich
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY_MS - hours * 3600_000);
const done = (code: string, at: Date, rating: number | null = 7): AdherenceEntry => ({
  exerciseCode: code,
  performedAt: at,
  done: true,
  rating,
});
const times = (n: number, code: string, start = 0.1) =>
  Array.from({ length: n }, (_, i) => done(code, ago(start + i * 0.5)));

describe('adherence of the last 7 days', () => {
  it('two exercises: 2A täglich 2x 10 of 14, 2D wöchentlich 5x 5 of 5, total 15 of 19 (Zwei Übungen)', () => {
    const a = adherence(
      [
        { exerciseCode: '2A', repetition: 'DAILY_2' },
        { exerciseCode: '2D', repetition: 'WEEKLY_5' },
      ],
      [...times(10, '2A'), ...times(5, '2D')],
      ago(20),
      now,
    );
    expect(a.perExercise.map((x) => [x.exerciseCode, x.required, x.done, x.percent])).toEqual([
      ['2A', 14, 10, 71],
      ['2D', 5, 5, 100],
    ]);
    expect(a.total).toEqual({ required: 19, done: 15, percent: 79 });
  });

  it('counts more executions than prescribed only up to the requirement (Mehr als verordnet)', () => {
    const a = adherence(
      [
        { exerciseCode: '2D', repetition: 'WEEKLY_5' },
        { exerciseCode: '1F', repetition: 'DAILY_1' },
      ],
      times(7, '2D'),
      ago(30),
      now,
    );
    expect(a.perExercise[0]).toMatchObject({ required: 5, done: 5, percent: 100 });
    expect(a.perExercise[1]).toMatchObject({ required: 7, done: 0, percent: 0 });
    expect(a.total).toMatchObject({ required: 12, done: 5 });
  });

  it('prorates a program younger than 7 days (Programm seit 2 Tagen)', () => {
    expect(required('DAILY_1', 2)).toBe(2);
    expect(required('DAILY_2', 2)).toBe(4);
    expect(required('WEEKLY_5', 2)).toBe(2); // 5 × 2 / 7 = 1.4, rounded up
    expect(required('DAILY_1', 0)).toBe(1); // the day of the consultation counts
    expect(required('WEEKLY_3', 9)).toBe(3);
    const a = adherence([{ exerciseCode: '1F', repetition: 'DAILY_1' }], [], ago(2), now);
    expect(a.perExercise[0].required).toBe(2);
  });

  it('ignores deleted entries, entries not done and entries older than 7 days', () => {
    const a = adherence(
      [{ exerciseCode: '2A', repetition: 'DAILY_1' }],
      [
        { ...done('2A', ago(1)), deletedAt: ago(0, 1) },
        { exerciseCode: '2A', performedAt: ago(2), done: false, rating: null },
        done('2A', ago(8)),
        done('2A', ago(3), 4),
        done('2A', ago(4), null),
      ],
      ago(40),
      now,
    );
    expect(a.perExercise[0]).toMatchObject({ required: 7, done: 2, percent: 29 });
    expect(a.averageRating).toBe(4);
    expect(a.perExercise[0].ratings.map((r) => r.rating)).toEqual([7, 4]);
  });

  it('averages the ratings of the last 7 days with one decimal', () => {
    const a = adherence(
      [{ exerciseCode: '2A', repetition: 'DAILY_2' }],
      [done('2A', ago(1), 7), done('2A', ago(2), 6), done('2A', ago(3), 8), done('2A', ago(3.5), 6)],
      ago(10),
      now,
    );
    expect(a.averageRating).toBe(6.8);
    expect(a.perExercise[0].averageRating).toBe(6.8);
  });
});

describe('flags (Hinweise)', () => {
  const rx = [{ exerciseCode: '2A', repetition: 'DAILY_1' as const }];

  it('"Seit 3 Tagen kein Eintrag" after the last entry or, without entries, after the consultation', () => {
    expect(adherence(rx, [done('2A', ago(3))], ago(20), now).flags).toContain('noEntry');
    expect(adherence(rx, [done('2A', ago(2, 23))], ago(20), now).flags).not.toContain('noEntry');
    expect(adherence(rx, [], ago(3), now).flags).toContain('noEntry');
    expect(adherence(rx, [], ago(2), now).flags).not.toContain('noEntry');
  });

  it('"Einhaltung unter 50 %" from day 3 after the consultation (Geringe Einhaltung)', () => {
    const forty = adherence([{ exerciseCode: '2D', repetition: 'WEEKLY_5' }], times(2, '2D'), ago(20), now);
    expect(forty.total.percent).toBe(40);
    expect(forty.flags).toContain('lowAdherence');
    expect(adherence(rx, [], ago(2), now).flags).not.toContain('lowAdherence');
    expect(adherence(rx, [], ago(3), now).flags).toContain('lowAdherence');
    const half = adherence([{ exerciseCode: '2A', repetition: 'DAILY_2' }], times(7, '2A'), ago(20), now);
    expect(half.total.percent).toBe(50);
    expect(half.flags).toEqual([]);
  });
});

describe('trend per calendar week', () => {
  it('prorates the first and the current week', () => {
    // Consultation on Monday 05.10.2026, now Wednesday 14.10.2026: week of 05.10 (full) and 12.10 (Mon to Wed)
    const entries = [
      ...Array.from({ length: 7 }, (_, i) => done('2A', new Date(Date.UTC(2026, 9, 5 + i, 8)))),
      done('2A', new Date(Date.UTC(2026, 9, 12, 8))),
    ];
    const trend = weeklyTrend(
      [{ exerciseCode: '2A', repetition: 'DAILY_1' }],
      entries,
      new Date('2026-10-05T07:00:00Z'),
      now,
    );
    expect(trend).toEqual([
      { week: '2026-10-05', percent: 100 },
      { week: '2026-10-12', percent: 33 },
    ]);
  });
});

describe('progress in the patient zone', () => {
  const entries = [done('2A', ago(0, 1)), done('2D', ago(7))];
  it('"heute 1 von 2" and "diese Woche 0 von 5" (Übungen von heute)', () => {
    expect(progress({ exerciseCode: '2A', repetition: 'DAILY_2' }, entries, now)).toEqual({
      period: 'today',
      done: 1,
      target: 2,
      complete: false,
    });
    expect(progress({ exerciseCode: '2D', repetition: 'WEEKLY_5' }, entries, now)).toMatchObject({
      period: 'week',
      done: 0,
      target: 5,
    });
  });

  it('"Alle heutigen Übungen erledigt" fills the open executions of daily exercises (Alles erledigt)', () => {
    expect(
      openToday(
        [
          { exerciseCode: '2A', repetition: 'DAILY_2' },
          { exerciseCode: '1F', repetition: 'DAILY_1' },
          { exerciseCode: '2D', repetition: 'WEEKLY_5' },
        ],
        entries,
        now,
      ),
    ).toEqual([
      { exerciseCode: '2A', count: 1 },
      { exerciseCode: '1F', count: 1 },
    ]);
  });
});
