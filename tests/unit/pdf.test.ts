import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderSignedFormPdf, type PdfInput } from '@/lib/pdf';
import { INITIAL_TEXTS, parseBlocks } from '@/lib/consent-texts';
import { signatureSvg } from '@/lib/signature';

async function pdfText(buf: Buffer) {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    text += (await page.getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join(' ') + '\n';
  }
  // pdf.js puts a space between separate text runs; join them back for readable assertions
  return text
    .replace(/\s+/g, ' ')
    .replace(/([([«]) /g, '$1')
    .replace(/ ([)\],»])/g, '$1');
}

const input = (language: 'de' | 'en'): PdfInput => ({
  language,
  documentNumber: 'PT-2026-00001',
  textVersion: 1,
  title: INITIAL_TEXTS[language].title,
  body: INITIAL_TEXTS[language].body,
  patient: {
    firstName: 'Anna',
    lastName: 'Müller',
    dateOfBirth: new Date('1980-03-05T00:00:00Z'),
    street: 'Dorfstrasse 12',
    zip: '8932',
    city: 'Mettmenstetten',
    email: 'anna@example.ch',
  },
  consents: { liability: true, dataProcessing: true, unencryptedEmail: false },
  note: 'Neue Adresse',
  place: 'Mettmenstetten',
  signedAtText: '12.10.2026 10:14',
  signature: {
    ...signatureSvg(
      [
        [
          [10, 50, 0.5],
          [60, 20, 0.5],
          [120, 60, 0.5],
        ],
      ],
      600,
      220,
    ),
    width: 600,
    height: 220,
  },
});

/** consent-documents: PDF in the patient's language (task 7.1) */
describe('signed PDF', () => {
  it('contains the German text, details, consents and signature line', async () => {
    const text = await pdfText(await renderSignedFormPdf(input('de')));
    for (const s of [
      'Haftungsausschluss, Patienteninformation und Datenschutzhinweis',
      'Anna Müller',
      '05.03.1980',
      'Dorfstrasse 12, 8932 Mettmenstetten',
      '1. Haftungsausschluss',
      '3. Datenschutzhinweis',
      '(erteilt)',
      '(nicht erteilt)',
      'Neue Adresse',
      'Unterschrift: Anna Müller',
      'Mettmenstetten, 12.10.2026 10:14',
      'PT-2026-00001',
      'Textversion 1',
    ]) {
      expect(text).toContain(s);
    }
  });

  it('is in English for an English-speaking patient', async () => {
    const text = await pdfText(await renderSignedFormPdf(input('en')));
    for (const s of [
      'Liability waiver, patient information and privacy notice',
      '1. Liability waiver',
      'Date of birth',
      '(granted)',
      '(not granted)',
      'Signature: Anna Müller',
      'Text version 1',
    ]) {
      expect(text).toContain(s);
    }
    expect(text).not.toContain('Haftungsausschluss');
  });

  it('parses the form text format', () => {
    expect(parseBlocks('## A\nText one\nmore\n\n- x\n- y\n\nEnd')).toEqual([
      { type: 'h', text: 'A' },
      { type: 'p', text: 'Text one more' },
      { type: 'ul', items: ['x', 'y'] },
      { type: 'p', text: 'End' },
    ]);
  });
});
