import { describe, expect, it } from 'vitest';
import { backfilled, chosenDay, dayReference } from '../src/log-entry';

/** zone-exercise-backfill: Tag wählen, Grenzen (iteration 6, design D7, task 5.4) */
describe('chosen day', () => {
  const consultationAt = new Date('2026-10-05T14:30:00Z'); // Mo 5.10. 16:30 in Zurich
  const now = new Date('2026-10-15T06:10:00Z'); // Do 15.10. 08:10 in Zurich

  it('defaults to today and offers the previous day', () => {
    expect(chosenDay(undefined, consultationAt, now)).toEqual({
      day: '2026-10-15',
      today: true,
      first: '2026-10-05',
      last: '2026-10-15',
      previous: '2026-10-14',
      next: null,
    });
  });

  it('chooses yesterday with both neighbours', () => {
    expect(chosenDay('2026-10-14', consultationAt, now)).toMatchObject({
      day: '2026-10-14',
      today: false,
      previous: '2026-10-13',
      next: '2026-10-15',
    });
  });

  it('stops at the day of the consultation (Grenzen)', () => {
    expect(chosenDay('2026-10-05', consultationAt, now)).toMatchObject({ day: '2026-10-05', previous: null });
  });

  it('treats days outside the program and invalid input as today', () => {
    for (const tag of ['2026-10-04', '2026-10-16', '2026-02-30', 'gestern', '']) {
      expect(chosenDay(tag, consultationAt, now).day, tag).toBe('2026-10-15');
    }
  });

  it('uses now for today, 12:00 for past days and the consultation time on its own day', () => {
    expect(dayReference('2026-10-15', consultationAt, now)).toEqual(now);
    expect(dayReference('2026-10-14', consultationAt, now)).toEqual(new Date('2026-10-14T10:00:00Z'));
    expect(dayReference('2026-10-05', consultationAt, now)).toEqual(consultationAt);
    // After the change to winter time 12:00 is 11:00 UTC
    expect(dayReference('2026-10-26', new Date('2026-10-20T08:00:00Z'), new Date('2026-10-28T08:00:00Z'))).toEqual(
      new Date('2026-10-26T11:00:00Z'),
    );
  });
});

/** zone-exercise-backfill: Nachgetragene Einträge in der Praxis (Kennzeichnung) */
describe('backfilled entries', () => {
  it('marks an entry recorded more than 24 hours after the execution', () => {
    const tuesday = new Date('2026-10-13T10:00:00Z');
    expect(backfilled(tuesday, new Date('2026-10-16T07:00:00Z'))).toBe(true);
    expect(backfilled(tuesday, new Date('2026-10-14T10:00:00Z'))).toBe(false);
    expect(backfilled(tuesday, tuesday)).toBe(false);
  });
});
