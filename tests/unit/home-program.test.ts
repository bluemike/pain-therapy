import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REPETITION,
  executionTime,
  formatMinutes,
  perWeek,
  programTime,
  REPETITIONS,
  sheetFields,
  stepsLabel,
  type Timing,
} from '@/lib/home-program';
import sheets from '../../prisma/catalog/exercise-sheets.json';

const twoSides: Timing = { stretchSecondsPerSide: 120, sides: 2, rollingSeconds: 120 };
const oneSide: Timing = { stretchSecondsPerSide: 120, sides: 1, rollingSeconds: 120 };
const notSet: Timing = { stretchSecondsPerSide: null, sides: 1, rollingSeconds: 120 };

/** exercise-library: Zeitbedarf einer Übung; home-program: Wiederholung, Gesamter Zeitbedarf (task 2.2) */
describe('time needed', () => {
  it('offers ten repetitions, "täglich 1x" first and as default (Zehn Optionen)', () => {
    expect(REPETITIONS).toEqual([
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
    ]);
    expect(DEFAULT_REPETITION).toBe('DAILY_1');
    expect(REPETITIONS.map(perWeek)).toEqual([7, 14, 21, 1, 2, 3, 4, 5, 6, 7]);
    expect(sheetFields('DAILY_2')).toEqual({ perWeek: 7, perDay: 2 });
    expect(sheetFields('WEEKLY_5')).toEqual({ perWeek: 5, perDay: 1 });
    expect([1, 2, 3, null].map(stepsLabel)).toEqual(['1', '1-2', '1-3', null]);
  });

  it('computes one execution as rolling + stretch per side × sides (Übung mit zwei Seiten)', () => {
    expect(executionTime(twoSides)).toEqual({ seconds: 360, stretchMissing: false, rollingMissing: false });
    expect(formatMinutes(executionTime(twoSides).seconds / 60)).toBe('6 min');
    expect(executionTime(oneSide).seconds).toBe(240);
  });

  it('counts only the rolling while the stretch is not set (Wert fehlt)', () => {
    expect(executionTime(notSet)).toEqual({ seconds: 120, stretchMissing: true, rollingMissing: false });
    const t = programTime([
      { code: '1C', repetition: 'DAILY_1', timing: notSet },
      { code: '2A', repetition: 'DAILY_1', timing: oneSide },
    ]);
    expect(t.weekMinutes).toBe(2 * 7 + 4 * 7);
    expect(t.incomplete).toEqual(['1C']);
  });

  it('sums the week and averages the day (Zwei Übungen)', () => {
    const t = programTime([
      { code: '2A', repetition: 'DAILY_2', timing: oneSide },
      { code: '2D', repetition: 'WEEKLY_5', timing: oneSide },
    ]);
    expect(t.weekMinutes).toBe(56 + 20);
    expect(formatMinutes(t.dayMinutes)).toBe('11 min');
    expect(t.extensive).toBe(false);
  });

  it('three times daily (Dreimal täglich)', () => {
    const t = programTime([{ code: '2B', repetition: 'DAILY_3', timing: twoSides }]);
    expect(t.weekMinutes).toBe(126);
    expect(t.dayMinutes).toBe(18);
  });

  it('flags more than 30 minutes per day (Viel Zeitbedarf)', () => {
    const five = ['1B', '1D', '2B', '2E', '2F'].map((code) => ({
      code,
      repetition: 'DAILY_1' as const,
      timing: twoSides,
    }));
    expect(programTime(five).dayMinutes).toBe(30);
    expect(programTime(five).extensive).toBe(false);
    const six = [...five, { code: '3C', repetition: 'DAILY_1' as const, timing: twoSides }];
    expect(programTime(six).extensive).toBe(true);
  });

  it('formats minutes in both languages', () => {
    // Swiss format: decimal point in German too
    expect(formatMinutes(4.5)).toBe('4.5 min');
    expect(formatMinutes(4.5, 'en')).toBe('4.5 min');
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
