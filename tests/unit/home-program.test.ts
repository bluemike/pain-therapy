import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCHEDULE,
  executionTime,
  formatMinutes,
  perWeek,
  programTime,
  scheduleText,
  validSchedule,
  weekdaysOf,
  withVariant,
  type Timing,
} from '@/lib/home-program';
import { translator } from '@/lib/i18n-server';
import sheets from '../../prisma/catalog/exercise-sheets.json';

const twoSides: Timing = { stretchSecondsPerSide: 120, sides: 2, rollingSeconds: 120 };
const oneSide: Timing = { stretchSecondsPerSide: 120, sides: 1, rollingSeconds: 120 };
const notSet: Timing = { stretchSecondsPerSide: null, sides: 1, rollingSeconds: 120 };

const daily = (timesPerDay: number) => ({ timesPerDay, weekdays: 127 });
const MO_FR = 31;

/** exercise-library: Zeitbedarf einer Übung; home-schedule (iteration 8, tasks 2.2, 4.1): pro Tag und Wochentage */
describe('time needed', () => {
  it('prescribes 1× per day on every weekday by default, 1× to 3× and at least one day (Tage abwählen)', () => {
    expect(DEFAULT_SCHEDULE).toEqual({ timesPerDay: 1, weekdays: 127 });
    expect(perWeek(daily(2))).toBe(14);
    expect(perWeek({ timesPerDay: 2, weekdays: MO_FR })).toBe(10);
    expect(weekdaysOf(MO_FR)).toEqual(['mo', 'tu', 'we', 'th', 'fr']);
    expect(validSchedule({ timesPerDay: 3, weekdays: 64 })).toBe(true);
    expect(validSchedule({ timesPerDay: 4, weekdays: 127 })).toBe(false);
    expect(validSchedule({ timesPerDay: 1, weekdays: 0 })).toBe(false);
    const th = translator('de', 'home');
    expect(scheduleText({ timesPerDay: 1, weekdays: MO_FR }, th)).toBe('1× pro Tag · Mo Di Mi Do Fr');
    expect(scheduleText(daily(2), th)).toBe('2× pro Tag · jeden Tag');
    expect(scheduleText({ timesPerDay: 1, weekdays: 1 | 64 }, translator('en', 'home'))).toBe('1× per day · Mo Su');
  });

  it('uses the time of a variant when the sheet states one, otherwise the standard exercise (exercise-segments)', () => {
    expect(executionTime(withVariant(twoSides, null)).seconds).toBe(360);
    expect(executionTime(withVariant(twoSides, 90)).seconds).toBe(210);
    expect(executionTime(withVariant(notSet, 60))).toMatchObject({ seconds: 180, stretchMissing: false });
  });

  it('1D with 6 min, 1× on 5 days: 30 min per week, about 4 min per day (Zeit)', () => {
    const t = programTime([{ code: '1D', schedule: { timesPerDay: 1, weekdays: MO_FR }, timing: twoSides }]);
    expect(t.weekMinutes).toBe(30);
    expect(formatMinutes(t.dayMinutes)).toBe('4 min');
  });

  it('computes one execution as rolling + stretch per side × sides (Übung mit zwei Seiten)', () => {
    expect(executionTime(twoSides)).toEqual({ seconds: 360, stretchMissing: false, rollingMissing: false });
    expect(formatMinutes(executionTime(twoSides).seconds / 60)).toBe('6 min');
    expect(executionTime(oneSide).seconds).toBe(240);
  });

  it('counts only the rolling while the stretch is not set (Wert fehlt)', () => {
    expect(executionTime(notSet)).toEqual({ seconds: 120, stretchMissing: true, rollingMissing: false });
    const t = programTime([
      { code: '1C', schedule: daily(1), timing: notSet },
      { code: '2A', schedule: daily(1), timing: oneSide },
    ]);
    expect(t.weekMinutes).toBe(2 * 7 + 4 * 7);
    expect(t.incomplete).toEqual(['1C']);
  });

  it('sums the week and averages the day (Zwei Übungen)', () => {
    const t = programTime([
      { code: '2A', schedule: daily(2), timing: oneSide },
      { code: '2D', schedule: { timesPerDay: 1, weekdays: MO_FR }, timing: oneSide },
    ]);
    expect(t.weekMinutes).toBe(56 + 20);
    expect(formatMinutes(t.dayMinutes)).toBe('11 min');
    expect(t.extensive).toBe(false);
  });

  it('three times daily (Dreimal täglich)', () => {
    const t = programTime([{ code: '2B', schedule: daily(3), timing: twoSides }]);
    expect(t.weekMinutes).toBe(126);
    expect(t.dayMinutes).toBe(18);
  });

  it('flags more than 30 minutes per day (Viel Zeitbedarf)', () => {
    const five = ['1B', '1D', '2B', '2E', '2F'].map((code) => ({
      code,
      schedule: daily(1),
      timing: twoSides,
    }));
    expect(programTime(five).dayMinutes).toBe(30);
    expect(programTime(five).extensive).toBe(false);
    const six = [...five, { code: '3C', schedule: daily(1), timing: twoSides }];
    expect(programTime(six).extensive).toBe(true);
  });

  it('formats minutes in both languages', () => {
    // Whole minutes, rounded half up (iteration 9)
    expect(formatMinutes(4.5)).toBe('5 min');
    expect(formatMinutes(4.5, 'en')).toBe('5 min');
    expect(formatMinutes(12.5)).toBe('13 min');
    expect(formatMinutes(4.3)).toBe('4 min');
    expect(formatMinutes(10.857)).toBe('11 min');
    expect(formatMinutes(0)).toBe('0 min');
  });

  it('uses the timing of the reference file: rolling 2 min everywhere, 1C and 2C not yet set', () => {
    expect(sheets).toHaveLength(27);
    expect(new Set(sheets.map((s) => s.timing.rollingSeconds))).toEqual(new Set([120]));
    expect(sheets.filter((s) => s.timing.stretchSecondsPerSide === null).map((s) => s.code)).toEqual(['1C', '2C']);
    expect(sheets.filter((s) => s.timing.sides === 2)).toHaveLength(18);
  });
});
