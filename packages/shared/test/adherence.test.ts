import { describe, expect, it } from 'vitest';
import {
  adherence,
  openToday,
  progress,
  required,
  scheduledDays,
  weeklyTrend,
  type AdherenceEntry,
} from '../src/adherence';
import { DAY_MS } from '../src/time';

/** adherence-overview: Berechnung der Einhaltung and Hinweise (iteration 4), by weekdays since iteration 8 (design D8) */

const now = new Date('2026-10-14T10:00:00Z'); // Wednesday, 12:00 in Zurich
const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY_MS - hours * 3600_000);
const at = (day: number, hour = 8) => new Date(Date.UTC(2026, 9, day, hour)); // October 2026
const done = (code: string, when: Date, rating: number | null = 7): AdherenceEntry => ({
  exerciseCode: code,
  performedAt: when,
  done: true,
  rating,
});
const times = (n: number, code: string, start = 0.1) =>
  Array.from({ length: n }, (_, i) => done(code, ago(start + i * 0.5)));

const DAILY = (timesPerDay: number) => ({ timesPerDay, weekdays: 127 });
const MO_FR = { timesPerDay: 1, weekdays: 31 };
const MO_WE_FR = { timesPerDay: 1, weekdays: 1 | 4 | 16 };

describe('adherence of the last 7 days', () => {
  it('two exercises: 2A 2x every day 10 of 14, 2D 1x Mo to Fr 5 of 5, total 15 of 19', () => {
    const a = adherence(
      [
        { exerciseCode: '2A', schedule: DAILY(2) },
        { exerciseCode: '2D', schedule: MO_FR },
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
        { exerciseCode: '2D', schedule: MO_FR },
        { exerciseCode: '1F', schedule: DAILY(1) },
      ],
      times(7, '2D'),
      ago(30),
      now,
    );
    expect(a.perExercise[0]).toMatchObject({ required: 5, done: 5, percent: 100 });
    expect(a.perExercise[1]).toMatchObject({ required: 7, done: 0, percent: 0 });
    expect(a.total).toMatchObject({ required: 12, done: 5 });
  });

  it('counts only selected weekdays from the day of the session (Programm seit Montag)', () => {
    const monday = ago(2);
    expect(required(DAILY(1), monday, now)).toBe(3); // Mon, Tue, Wed
    expect(required(DAILY(2), monday, now)).toBe(6);
    expect(required({ timesPerDay: 1, weekdays: 1 | 4 }, monday, now)).toBe(2); // Mon, Wed
    expect(required(DAILY(1), now, now)).toBe(1); // the day of the session counts
    expect(required(MO_WE_FR, ago(9), now)).toBe(3); // window Thu 08.10 to Wed 14.10: Fri, Mon, Wed
    expect(required({ timesPerDay: 3, weekdays: 32 | 64 }, monday, now)).toBe(0); // weekend only
    expect(scheduledDays(MO_FR, '2026-10-05', '2026-10-18')).toBe(10);
  });

  it('ignores deleted entries, entries not done and entries older than 7 days', () => {
    const a = adherence(
      [{ exerciseCode: '2A', schedule: DAILY(1) }],
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

  it('counts an entry on a day that is not selected (Eintrag an einem freien Tag)', () => {
    // Mo to Fr, entries on Saturday 10.10 and Sunday 11.10
    const a = adherence(
      [{ exerciseCode: '2D', schedule: MO_FR }],
      [done('2D', at(10)), done('2D', at(11))],
      ago(20),
      now,
    );
    expect(a.perExercise[0]).toMatchObject({ required: 5, done: 2, percent: 40 });
  });

  it('averages the ratings of the last 7 days with one decimal', () => {
    const a = adherence(
      [{ exerciseCode: '2A', schedule: DAILY(2) }],
      [done('2A', ago(1), 7), done('2A', ago(2), 6), done('2A', ago(3), 8), done('2A', ago(3.5), 6)],
      ago(10),
      now,
    );
    expect(a.averageRating).toBe(6.8);
    expect(a.perExercise[0].averageRating).toBe(6.8);
  });
});

describe('flags (Hinweise)', () => {
  const rx = [{ exerciseCode: '2A', schedule: DAILY(1) }];

  it('"Seit 3 Tagen kein Eintrag" counts selected days after the last entry or, without entries, the session', () => {
    expect(adherence(rx, [done('2A', at(11))], ago(20), now).flags).toContain('noEntry'); // Mon, Tue, Wed
    expect(adherence(rx, [done('2A', at(12))], ago(20), now).flags).not.toContain('noEntry');
    expect(adherence(rx, [], ago(3), now).flags).toContain('noEntry');
    expect(adherence(rx, [], ago(2), now).flags).not.toContain('noEntry');
  });

  it('skips days that are not selected', () => {
    const mf = [{ exerciseCode: '2D', schedule: MO_FR }];
    // Last entry Friday 09.10: Sat and Sun do not count, Mon to Wed do
    expect(adherence(mf, [done('2D', at(9))], ago(20), now).flags).toContain('noEntry');
    // Saturday only, last entry Sunday 04.10: only Saturday 10.10 was due
    const sat = [{ exerciseCode: '1F', schedule: { timesPerDay: 1, weekdays: 32 } }];
    expect(adherence(sat, [done('1F', at(4))], ago(20), now).flags).not.toContain('noEntry');
  });

  it('"Einhaltung unter 50 %" from day 3 after the session (Geringe Einhaltung)', () => {
    const forty = adherence([{ exerciseCode: '2D', schedule: MO_FR }], times(2, '2D'), ago(20), now);
    expect(forty.total.percent).toBe(40);
    expect(forty.flags).toContain('lowAdherence');
    expect(adherence(rx, [], ago(2), now).flags).not.toContain('lowAdherence');
    expect(adherence(rx, [], ago(3), now).flags).toContain('lowAdherence');
    const half = adherence([{ exerciseCode: '2A', schedule: DAILY(2) }], times(7, '2A'), ago(20), now);
    expect(half.total.percent).toBe(50);
    expect(half.flags).toEqual([]);
  });
});

describe('trend per calendar week', () => {
  it('prorates the first and the current week', () => {
    // Session on Monday 05.10.2026, now Wednesday 14.10.2026: week of 05.10 (full) and 12.10 (Mon to Wed)
    const entries = [...Array.from({ length: 7 }, (_, i) => done('2A', at(5 + i))), done('2A', at(12))];
    const trend = weeklyTrend(
      [{ exerciseCode: '2A', schedule: DAILY(1) }],
      entries,
      new Date('2026-10-05T07:00:00Z'),
      now,
    );
    expect(trend).toEqual([
      { week: '2026-10-05', percent: 100 },
      { week: '2026-10-12', percent: 33 },
    ]);
  });

  it('expects only the selected weekdays', () => {
    const entries = [done('2A', at(5)), done('2A', at(7)), done('2A', at(9)), done('2A', at(12))];
    const trend = weeklyTrend(
      [{ exerciseCode: '2A', schedule: MO_WE_FR }],
      entries,
      new Date('2026-10-05T07:00:00Z'),
      now,
    );
    expect(trend).toEqual([
      { week: '2026-10-05', percent: 100 },
      { week: '2026-10-12', percent: 50 },
    ]);
  });
});

describe('progress in the patient zone', () => {
  const entries = [done('2A', ago(0, 1)), done('2D', ago(7))];
  it('"heute 1 von 2" on a selected day, target 0 on a free day (Übungen von heute)', () => {
    expect(progress({ exerciseCode: '2A', schedule: DAILY(2) }, entries, now)).toEqual({
      done: 1,
      target: 2,
      scheduledToday: true,
      complete: false,
    });
    expect(progress({ exerciseCode: '2D', schedule: { timesPerDay: 1, weekdays: 1 } }, entries, now)).toEqual({
      done: 0,
      target: 0,
      scheduledToday: false,
      complete: true,
    });
  });

  it('"Alle heutigen Übungen erledigt" fills the open executions of the exercises selected for today', () => {
    expect(
      openToday(
        [
          { exerciseCode: '2A', schedule: DAILY(2) },
          { exerciseCode: '1F', schedule: MO_WE_FR },
          { exerciseCode: '2D', schedule: { timesPerDay: 1, weekdays: 1 } },
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
