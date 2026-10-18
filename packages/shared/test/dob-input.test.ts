import { describe, expect, it } from 'vitest';
import { dobStep, onlyDigits } from '../src/dob-input';

describe('date of birth input', () => {
  it('moves on after 2 digits of day or month', () => {
    expect(dobStep('day', '0', { day: '', month: '' })).toBeNull();
    expect(dobStep('day', '05', { day: '', month: '' })).toBe('next');
    expect(dobStep('month', '03', { day: '05', month: '' })).toBe('next');
  });

  it('submits after 4 digits of the year only when day and month are there', () => {
    expect(dobStep('year', '198', { day: '05', month: '03' })).toBeNull();
    expect(dobStep('year', '1980', { day: '05', month: '03' })).toBe('submit');
    expect(dobStep('year', '1980', { day: '', month: '03' })).toBeNull();
  });

  it('keeps only digits up to the field length', () => {
    expect(onlyDigits('1a9-80x', 4)).toBe('1980');
    expect(onlyDigits('123', 2)).toBe('12');
  });
});
