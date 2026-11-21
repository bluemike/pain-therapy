import { describe, expect, it } from 'vitest';
import { audioFileIn, audioLanguageOf, isAudioLanguage } from '@pain-therapy/shared/audio-language';
import { jobsOf } from '../../scripts/exercise-audio-parts';

describe('exercise audio in three languages (iteration 15, design D3)', () => {
  it('chooses English for an English interface, otherwise Hochdeutsch or Mundart', () => {
    expect(audioLanguageOf('en', 'gsw')).toBe('en');
    expect(audioLanguageOf('de', 'gsw')).toBe('gsw');
    expect(audioLanguageOf('de', null)).toBe('de');
    expect(audioLanguageOf('de', 'xx')).toBe('de');
    expect(isAudioLanguage('gsw')).toBe(true);
    expect(isAudioLanguage('fr')).toBe(false);
  });

  it('keeps the Hochdeutsch names and adds the language to the others', () => {
    expect(audioFileIn('2A-frm.mp3', 'de')).toBe('2A-frm.mp3');
    expect(audioFileIn('2A-frm.mp3', 'gsw')).toBe('2A-frm.gsw.mp3');
    expect(audioFileIn('2A-V3.mp3', 'en')).toBe('2A-V3.en.mp3');
  });

  it('generates one file per part with the names the apps read', () => {
    const sheet = {
      code: '2A',
      name: 'Lenden-Übung',
      frm: { items: [{ n: [1], text: 'Rolle …' }] },
      standard: { intro: null, steps: [{ label: 'Schritt 1', text: 'Stelle …' }], note: null },
      variants: { intro: 'Varianten', items: [{ id: '2A-V1', n: [1], text: 'Lege …' }] },
    };
    expect(jobsOf(sheet, 'gsw').map(([f]) => f)).toEqual(['2A-frm.gsw.mp3', '2A-std.gsw.mp3', '2A-V1.gsw.mp3']);
    const en = jobsOf(sheet, 'en');
    expect(en.map(([f]) => f)).toEqual(['2A-frm.en.mp3', '2A-std.en.mp3', '2A-V1.en.mp3']);
    expect(en[0][1][0]).toBe('Fascia rolling massage for exercise 2A, Lenden-Übung.');
    expect(jobsOf(sheet, 'de')[1][1]).toEqual(['Engpassdehnung 2A, Lenden-Übung.', 'Schritt 1. Stelle …']);
  });
});
