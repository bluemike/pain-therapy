/**
 * zone-login (iteration 9): what the date of birth fields do after an input. Day and month move on after 2 digits;
 * the year submits after 4 digits once day and month are filled in.
 */
export type DobField = 'day' | 'month' | 'year';

export const onlyDigits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);

export function dobStep(
  field: DobField,
  value: string,
  filled: { day: string; month: string },
): 'next' | 'submit' | null {
  if (field === 'year') return value.length === 4 && filled.day !== '' && filled.month !== '' ? 'submit' : null;
  return value.length === 2 ? 'next' : null;
}
