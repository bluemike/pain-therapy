import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { rawDb } from '@/lib/db';
import { addressLineOf, logoType, LogoError, practiceSchema, updatePractice } from '@/lib/practice-settings';
import { currentBrand } from '@/lib/brand';
import { resetDatabase } from './db-reset';
import { TEST_PRACTICE_ID } from './test-practice';

/** practice-settings (iteration 12, design D5): Praxisangaben, Logo, Kürzel */

const actor = { id: 'u-admin', name: 'Anna Beispiel', email: 'anna@example.test', roles: ['ADMIN' as const] };
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const valid = {
  name: 'Physio Muster',
  street: 'Bahnhofstrasse 10',
  zip: '7000',
  city: 'Chur',
  contactEmail: 'Anna@Example.test',
  phone: '081 000 00 00',
  defaultPlace: 'Chur',
  documentPrefix: 'pm',
  privacyNotice: '',
};

beforeAll(resetDatabase);
afterAll(resetDatabase);

describe('practice settings', () => {
  it('validates the Kürzel and the postcode', () => {
    expect(practiceSchema.safeParse(valid).success).toBe(true);
    expect(practiceSchema.parse(valid).documentPrefix).toBe('PM');
    expect(practiceSchema.safeParse({ ...valid, documentPrefix: 'P1' }).success).toBe(false);
    expect(practiceSchema.safeParse({ ...valid, documentPrefix: 'PRAXIS' }).success).toBe(false);
    expect(practiceSchema.safeParse({ ...valid, zip: '70' }).success).toBe(false);
    expect(practiceSchema.safeParse({ ...valid, contactEmail: 'kein' }).success).toBe(false);
  });

  it('builds the address line for the PDF header', () => {
    expect(addressLineOf(valid)).toBe('Physio Muster | Bahnhofstrasse 10 | 7000 Chur');
    expect(addressLineOf({ ...valid, street: '', zip: '' })).toBe('Physio Muster | Chur');
  });

  it('recognises PNG and JPEG by their bytes only', () => {
    expect(logoType(PNG)).toBe('image/png');
    expect(logoType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(logoType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it('saves the details, the documents read them, and the change is in the audit log (Adresse im PDF)', async () => {
    await updatePractice(actor, TEST_PRACTICE_ID, practiceSchema.parse(valid), { data: PNG });
    const p = await rawDb.practice.findUniqueOrThrow({ where: { id: TEST_PRACTICE_ID } });
    expect(p).toMatchObject({
      name: 'Physio Muster',
      addressLine: 'Physio Muster | Bahnhofstrasse 10 | 7000 Chur',
      contactEmail: 'anna@example.test',
      documentPrefix: 'PM',
      logoType: 'image/png',
    });
    const brand = await currentBrand();
    expect(brand.addressLine).toBe('Physio Muster | Bahnhofstrasse 10 | 7000 Chur');
    expect(brand.logo?.data.equals(PNG)).toBe(true);
    const event = await rawDb.auditEvent.findFirstOrThrow({ where: { action: 'practice.updated' } });
    expect((event.details as { fields: string[] }).fields).toEqual(expect.arrayContaining(['name', 'logo']));

    await updatePractice(actor, TEST_PRACTICE_ID, practiceSchema.parse(valid), 'remove');
    expect((await currentBrand()).logo).toBeNull();
  });

  it('refuses a logo that is not PNG or JPEG, or larger than 500 KB', async () => {
    const input = practiceSchema.parse(valid);
    await expect(updatePractice(actor, TEST_PRACTICE_ID, input, { data: Buffer.from('<svg/>') })).rejects.toThrow(
      LogoError,
    );
    const big = Buffer.concat([PNG, Buffer.alloc(500 * 1024)]);
    await expect(updatePractice(actor, TEST_PRACTICE_ID, input, { data: big })).rejects.toMatchObject({
      code: 'logoSize',
    });
  });
});
