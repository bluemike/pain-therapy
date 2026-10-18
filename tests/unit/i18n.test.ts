import { describe, expect, it } from 'vitest';
import de from '../../messages/de.json';
import en from '../../messages/en.json';
import { pickLocale } from '@/i18n/request';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

/** localization: a text present in only one language fails the build (task 3.3) */
describe('translations', () => {
  it('German and English have exactly the same keys', () => {
    const d = keys(de).sort();
    const e = keys(en).sort();
    expect(
      d.filter((k) => !e.includes(k)),
      'missing in en.json',
    ).toEqual([]);
    expect(
      e.filter((k) => !d.includes(k)),
      'missing in de.json',
    ).toEqual([]);
  });

  it('uses the terms of iteration 8: Sitzung, Bereich, Therapeut:in, never Arzt (terminology)', () => {
    const texts = keys(de).map((k) =>
      String(k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown>)[p], de)),
    );
    expect(texts.filter((t) => /Konsultation/.test(t))).toEqual([]);
    expect(texts.filter((t) => /\bGruppe/.test(t))).toEqual([]);
    expect(texts.filter((t) => /Arzt/.test(t.replace(/Arzt-Diagnose|ärztlich/g, '')))).toEqual([]);
    expect(texts.filter((t) => /Arzt/.test(t))).toContain('Arzt-Diagnose');
  });

  it('no translation is empty', () => {
    const empty = (o: object) =>
      keys(o).filter(
        (k) => !String(k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown>)[p], o)).trim(),
      );
    expect(empty(de)).toEqual([]);
    expect(empty(en)).toEqual([]);
  });

  it('uses the browser language for German or English, else German', () => {
    expect(pickLocale(undefined, 'en-GB,en;q=0.9')).toBe('en');
    expect(pickLocale(undefined, 'fr-CH,fr;q=0.9,de;q=0.8')).toBe('de');
    expect(pickLocale(undefined, 'it-CH')).toBe('de');
    expect(pickLocale('en', 'de-CH')).toBe('en');
  });
});
