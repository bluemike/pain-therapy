/** Behandlungslage of an Osteopressur point (iteration 15, design D1); usable on the client */
export type PositionName = { code: string; nameDe: string; nameEn: string };

/** Full name of a code or a combination: "BL/HSL" → "Bauchlage / Halbseitenlage"; unknown parts stay as code */
export function positionLabel(code: string | null | undefined, positions: PositionName[], locale: string): string {
  if (!code) return '';
  return code
    .split('/')
    .map((c) => {
      const p = positions.find((x) => x.code === c);
      return p ? (locale === 'en' ? p.nameEn : p.nameDe) : c;
    })
    .join(' / ');
}
