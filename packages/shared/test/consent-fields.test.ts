import { describe, expect, it } from 'vitest';
import { fieldValuesOf, fillFields, unknownFields, usesFields } from '../src/consent-fields';

const falera = fieldValuesOf({
  name: 'Pain Therapy Falera',
  street: 'Via Prau da Cuort 5',
  zip: '7153',
  city: 'Falera',
  contactEmail: 'christina.franz@pain-therapy.online',
  phone: null,
  privacyOfficer: 'Christina Franz',
});

describe('consent fields (iteration 17, design D1)', () => {
  it('builds the address from street, zip and town', () => {
    expect(falera.address).toBe('Via Prau da Cuort 5, 7153 Falera');
  });

  it('fills fields in German and English, case-insensitive', () => {
    expect(fillFields('- «Adresse»\n- E-Mail: «e-mail»', falera)).toBe(
      '- Via Prau da Cuort 5, 7153 Falera\n- E-Mail: christina.franz@pain-therapy.online',
    );
    expect(fillFields('«Practice name» in «Address»', falera)).toBe(
      'Pain Therapy Falera in Via Prau da Cuort 5, 7153 Falera',
    );
  });

  it('leaves out a line whose only field is empty', () => {
    expect(fillFields('- E-Mail: «E-Mail»\n- Telefon: «Telefon»\n- Ende', falera)).toBe(
      '- E-Mail: christina.franz@pain-therapy.online\n- Ende',
    );
  });

  it('drops an empty field with its comma and keeps the rest of the line', () => {
    const none = { ...falera, responsible: '' };
    expect(fillFields('- «Verantwortliche Person», «Praxisname»', none)).toBe('- Pain Therapy Falera');
    expect(fillFields('- «Praxisname», «Verantwortliche Person»', none)).toBe('- Pain Therapy Falera');
    expect(fillFields('- «Verantwortliche Person», «Praxisname»', falera)).toBe(
      '- Christina Franz, Pain Therapy Falera',
    );
  });

  it('finds unknown fields and keeps them as written', () => {
    expect(unknownFields('«Praxisnam» und «Praxisname» und «Praxisnam»')).toEqual(['Praxisnam']);
    expect(fillFields('«Praxisnam»', falera)).toBe('«Praxisnam»');
    expect(usesFields('kein Feld')).toBe(false);
    expect(usesFields('«Telefon»')).toBe(true);
  });
});
