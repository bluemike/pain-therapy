import 'server-only';
import { z } from 'zod';
import { rawDb } from './db';
import { audit } from './audit';
import type { Actor } from './session';

/**
 * practice-settings (iteration 12, design D5): the Praxis-Admin maintains name, address, contact, default place,
 * Kürzel, logo and the privacy notice of the zone. Documents read them when they are created; archived PDFs stay.
 */

export const LOGO_MAX_BYTES = 500 * 1024;

export const practiceSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  street: z.string().trim().max(120, 'tooLong'),
  zip: z
    .string()
    .trim()
    .regex(/^(\d{4,5})?$/, 'zip'),
  city: z.string().trim().max(80, 'tooLong'),
  contactEmail: z.string().trim().toLowerCase().email('email').max(254, 'tooLong'),
  phone: z.string().trim().max(40, 'tooLong'),
  defaultPlace: z.string().trim().min(1, 'required').max(80, 'tooLong'),
  documentPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, 'prefix'),
  privacyNotice: z.string().trim().max(8000, 'tooLong'),
});

export type PracticeInput = z.infer<typeof practiceSchema>;

/** "Physio Muster | Bahnhofstrasse 10 | 7000 Chur", the line in PDF headers */
export const addressLineOf = (p: Pick<PracticeInput, 'name' | 'street' | 'zip' | 'city'>) =>
  [p.name, p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(' | ');

/** PNG or JPEG by its first bytes (the browser's type is not trusted) */
export function logoType(data: Buffer): 'image/png' | 'image/jpeg' | null {
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  return null;
}

export class LogoError extends Error {
  constructor(public code: 'logoType' | 'logoSize') {
    super(code);
  }
}

export async function updatePractice(
  actor: Actor,
  practiceId: string,
  input: PracticeInput,
  logo: { data: Buffer } | 'remove' | null,
): Promise<void> {
  let logoData: { logo: Uint8Array<ArrayBuffer> | null; logoType: string | null } | undefined;
  if (logo === 'remove') logoData = { logo: null, logoType: null };
  else if (logo) {
    if (logo.data.length > LOGO_MAX_BYTES) throw new LogoError('logoSize');
    const type = logoType(logo.data);
    if (!type) throw new LogoError('logoType');
    logoData = { logo: Uint8Array.from(logo.data), logoType: type };
  }
  const before = await rawDb.practice.findUniqueOrThrow({ where: { id: practiceId } });
  const data = {
    name: input.name,
    street: input.street || null,
    zip: input.zip || null,
    city: input.city || null,
    addressLine: addressLineOf(input),
    contactEmail: input.contactEmail,
    phone: input.phone || null,
    defaultPlace: input.defaultPlace,
    documentPrefix: input.documentPrefix,
    privacyNotice: input.privacyNotice || null,
    ...logoData,
  };
  await rawDb.practice.update({ where: { id: practiceId }, data });
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
    (k) => k !== 'logo' && String(before[k as keyof typeof before] ?? '') !== String(data[k] ?? ''),
  );
  if (logoData) changed.push('logo');
  if (changed.length) await audit(actor, 'practice.updated', { details: { fields: changed } });
}
