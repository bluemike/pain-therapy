/**
 * Addresses at pain-therapy.online (iteration 16, design D3): suggestion from the name and the rules for the part before
 * the @. Pure functions, also used by the invitation form in the browser.
 */

/** Addresses the app never hands out */
export const RESERVED_LOCAL_PARTS = new Set([
  'admin',
  'api',
  'noreply',
  'no-reply',
  'postmaster',
  'abuse',
  'info',
  'support',
  'root',
]);

/** "Jürg Müller" → "juerg.mueller"; "Zoë D'Arc-Lévy" → "zoe.darc-levy" */
export function suggestLocalPart(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9-]+/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^[.-]+|[.-]+$/g, '');
  return s.slice(0, 64).replace(/[.-]+$/, '');
}

/** Lower-case local part of 2 to 64 characters: letters, digits, dot, dash, underscore, no dots at the ends */
export function validLocalPart(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])$/.test(s) && !s.includes('..') && !RESERVED_LOCAL_PARTS.has(s);
}
