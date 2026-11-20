import type { Practice } from '@prisma/client';
import { requirePractice } from './practice';

/**
 * What documents and pages show of a practice (iteration 12, practice-settings): name, address line, logo. Without a
 * logo the name stands as text.
 */
export type Brand = {
  name: string;
  addressLine: string;
  contactEmail: string;
  logo: { data: Buffer; type: string } | null;
};

export const brandOf = (p: Pick<Practice, 'name' | 'addressLine' | 'contactEmail' | 'logo' | 'logoType'>): Brand => ({
  name: p.name,
  addressLine: p.addressLine,
  contactEmail: p.contactEmail,
  logo: p.logo && p.logoType ? { data: Buffer.from(p.logo), type: p.logoType } : null,
});

/** Brand of the practice of the current request (PDFs are rendered inside it) */
export async function currentBrand(): Promise<Brand> {
  return brandOf(await requirePractice());
}
