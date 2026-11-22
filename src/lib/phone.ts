/**
 * Handynummern (iteration 16, design D7): typed as "079 123 45 67", "+41 79 …" or "0041 79 …", stored in E.164.
 * Swiss numbers must be mobile numbers (074 to 079); numbers of the neighbouring countries are accepted with their
 * prefix. Pure functions, also used by the forms.
 */

/** Country codes accepted besides Switzerland: Liechtenstein, Germany, Austria, Italy, France */
const OTHER_COUNTRIES = ['423', '49', '43', '39', '33'];

/** E.164 like "+41791234567", or null for anything that is not a usable mobile number */
export function normalizeMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().replace(/[\s./()-]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  else if (s.startsWith('0')) s = `+41${s.slice(1)}`;
  if (!/^\+\d{8,15}$/.test(s)) return null;
  if (s.startsWith('+41')) return /^\+417[4-9]\d{7}$/.test(s) ? s : null;
  return OTHER_COUNTRIES.some((c) => s.startsWith(`+${c}`)) ? s : null;
}

/** Swiss numbers in the usual groups, others as stored: "+41 79 123 45 67" */
export function formatMobile(e164: string): string {
  const m = /^\+41(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/** For logs and the invitation page: "+41 79 *** ** 67" */
export function maskMobile(e164: string): string {
  const m = /^\+41(\d{2})\d{3}\d{2}(\d{2})$/.exec(e164);
  if (m) return `+41 ${m[1]} *** ** ${m[2]}`;
  return e164.length > 6 ? `${e164.slice(0, 4)}${'*'.repeat(e164.length - 6)}${e164.slice(-2)}` : '***';
}
