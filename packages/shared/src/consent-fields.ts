/**
 * consent-template (iteration 17, design D1): fields in the consent form text, filled with the practice details
 * wherever the text is shown to a patient or written into the signed PDF. The stored text keeps the fields, so a new
 * address applies at once without a new version; the values used are stored with the signed session.
 */

export type FieldKey = 'practiceName' | 'address' | 'email' | 'phone' | 'responsible';
export type FieldValues = Record<FieldKey, string>;

/** Allowed names in both languages (case does not matter) */
const NAMES: Record<string, FieldKey> = {
  praxisname: 'practiceName',
  'practice name': 'practiceName',
  adresse: 'address',
  address: 'address',
  'e-mail': 'email',
  email: 'email',
  telefon: 'phone',
  phone: 'phone',
  'verantwortliche person': 'responsible',
  'responsible person': 'responsible',
};

/** Names shown in the editor, per language, in this order */
export const FIELD_NAMES: Record<'de' | 'en', Record<FieldKey, string>> = {
  de: {
    practiceName: 'Praxisname',
    address: 'Adresse',
    email: 'E-Mail',
    phone: 'Telefon',
    responsible: 'Verantwortliche Person',
  },
  en: {
    practiceName: 'Practice name',
    address: 'Address',
    email: 'Email',
    phone: 'Phone',
    responsible: 'Responsible person',
  },
};

const FIELD = /«([^«»\n]{1,40})»/g;

const keyOf = (name: string): FieldKey | undefined => NAMES[name.trim().toLowerCase()];

/** Field names in guillemets that are not allowed, each once, as written */
export function unknownFields(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(FIELD)) if (!keyOf(m[1])) out.add(m[1]);
  return [...out];
}

/** Whether the text uses any field at all */
export function usesFields(body: string): boolean {
  for (const m of body.matchAll(FIELD)) if (keyOf(m[1])) return true;
  return false;
}

/** Practice columns the values come from */
export type PracticeFieldSource = {
  name: string;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  contactEmail: string;
  phone?: string | null;
  privacyOfficer?: string | null;
};

export function fieldValuesOf(p: PracticeFieldSource): FieldValues {
  const town = [p.zip, p.city]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' ');
  return {
    practiceName: p.name.trim(),
    address: [p.street?.trim(), town].filter(Boolean).join(', '),
    email: p.contactEmail.trim(),
    phone: p.phone?.trim() ?? '',
    responsible: p.privacyOfficer?.trim() ?? '',
  };
}

/**
 * Replaces the allowed fields line by line. A line whose fields are all empty is left out (no "Telefon:" without a
 * number); an empty field next to filled ones goes together with one adjoining comma. Unknown fields stay as written.
 */
export function fillFields(body: string, values: FieldValues): string {
  const lines: string[] = [];
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const keys = [...line.matchAll(FIELD)].map((m) => keyOf(m[1])).filter((k): k is FieldKey => !!k);
    if (!keys.length) {
      lines.push(line);
      continue;
    }
    if (keys.every((k) => !values[k])) continue;
    const filled = line
      .replace(/«([^«»\n]{1,40})»\s*,\s*/g, (all, name: string) => {
        const k = keyOf(name);
        return k && !values[k] ? '' : all;
      })
      .replace(/,\s*«([^«»\n]{1,40})»/g, (all, name: string) => {
        const k = keyOf(name);
        return k && !values[k] ? '' : all;
      })
      .replace(FIELD, (all, name: string) => {
        const k = keyOf(name);
        return k ? values[k] : all;
      });
    lines.push(filled);
  }
  return lines.join('\n');
}
