import { z } from 'zod';
import { parseSwissDate } from './format';

/**
 * Patient form schema, shared by client and server (design D1).
 * Error messages are keys of the "errors" message namespace.
 */
const text = (max = 200) =>
  z
    .string()
    .trim()
    .max(max, { message: 'tooLong' })
    .transform((v) => (v === '' ? null : v));

const requiredText = (max = 100) => z.string().trim().min(1, { message: 'required' }).max(max, { message: 'tooLong' });

const bool = z.preprocess((v) => v === true || v === 'on' || v === 'true', z.boolean());

const optionalInt = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 120) {
      ctx.addIssue({ code: 'custom', message: 'number' });
      return z.NEVER;
    }
    return n;
  });

const optionalDecimal = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const n = Number(v.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 99) {
      ctx.addIssue({ code: 'custom', message: 'number' });
      return z.NEVER;
    }
    return n;
  });

export const patientSchema = z
  .object({
    firstName: requiredText(),
    lastName: requiredText(),
    gender: z.enum(['', 'm', 'w', 'd']).transform((v) => (v === '' ? null : v)),
    dateOfBirth: z
      .string()
      .trim()
      .min(1, { message: 'required' })
      .transform((v, ctx) => {
        const d = parseSwissDate(v);
        if (!d) {
          ctx.addIssue({ code: 'custom', message: 'date' });
          return z.NEVER;
        }
        if (d.getTime() > Date.now()) {
          ctx.addIssue({ code: 'custom', message: 'dateFuture' });
          return z.NEVER;
        }
        return d;
      }),
    preferredLanguage: z.enum(['de', 'en'], { message: 'required' }),
    occupation: text(),
    gp: text(),
    street: text(),
    zip: text(10),
    city: text(),
    phone: text(40),
    mobile: text(40),
    // Required: signed documents are sent to this address
    email: z
      .string()
      .trim()
      .min(1, { message: 'required' })
      .max(200, { message: 'tooLong' })
      .refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), { message: 'email' })
      .transform((v) => v.toLowerCase()),
    emergencyName: text(),
    emergencyPhone: text(40),
    insurer: text(),
    insuranceNumber: text(40),
    // Anamnesis
    smoker: z.enum(['YES', 'NO']).default('NO'),
    smokingYears: optionalInt,
    packsPerDay: optionalDecimal,
    highBloodPressure: bool,
    highBloodLipids: bool,
    dizziness: bool,
    osteoporosis: bool,
    arthrosis: bool,
    rheumatism: bool,
    orthoOther: bool,
    orthoOtherText: text(500),
    cardiovascular: bool,
    diabetes: bool,
    asthma: bool,
    allergies: bool,
    internalOther: bool,
    internalOtherText: text(500),
    furtherDiagnoses: text(2000),
    medication: text(2000),
    pregnancy: z.enum(['YES', 'NO', 'NOT_APPLICABLE']).default('NOT_APPLICABLE'),
    inTreatment: z.enum(['YES', 'NO']).default('NO'),
    treatingDoctor: text(),
  })
  // `when` makes these run even if other fields are invalid, so all errors show at once
  .refine((v) => !(v.orthoOther && !v.orthoOtherText), { path: ['orthoOtherText'], message: 'other', when: () => true })
  .refine((v) => !(v.internalOther && !v.internalOtherText), {
    path: ['internalOtherText'],
    message: 'other',
    when: () => true,
  });

export type PatientInput = z.output<typeof patientSchema>;

export const PATIENT_FIELDS = [
  'firstName',
  'lastName',
  'gender',
  'dateOfBirth',
  'preferredLanguage',
  'occupation',
  'gp',
  'street',
  'zip',
  'city',
  'phone',
  'mobile',
  'email',
  'emergencyName',
  'emergencyPhone',
  'insurer',
  'insuranceNumber',
] as const;

export const ANAMNESIS_FIELDS = [
  'smoker',
  'smokingYears',
  'packsPerDay',
  'highBloodPressure',
  'highBloodLipids',
  'dizziness',
  'osteoporosis',
  'arthrosis',
  'rheumatism',
  'orthoOther',
  'orthoOtherText',
  'cardiovascular',
  'diabetes',
  'asthma',
  'allergies',
  'internalOther',
  'internalOtherText',
  'furtherDiagnoses',
  'medication',
  'pregnancy',
  'inTreatment',
  'treatingDoctor',
] as const;

export const BOOLEAN_FIELDS = new Set([
  'highBloodPressure',
  'highBloodLipids',
  'dizziness',
  'osteoporosis',
  'arthrosis',
  'rheumatism',
  'orthoOther',
  'cardiovascular',
  'diabetes',
  'asthma',
  'allergies',
  'internalOther',
]);

/** Flattens zod issues to { field: errorKey } (first issue per field). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formDataToObject(fd: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const k of [...PATIENT_FIELDS, ...ANAMNESIS_FIELDS]) {
    const v = fd.get(k);
    obj[k] = typeof v === 'string' ? v : '';
  }
  return obj;
}

export const signingSchema = z.object({
  note: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => (v === '' ? null : v)),
  place: z.string().trim().min(1).max(100),
  readToEnd: z.literal(true),
  liability: z.literal(true),
  dataProcessing: z.literal(true),
  unencryptedEmail: z.boolean(),
  strokes: z
    .array(
      z
        .array(z.tuple([z.number(), z.number(), z.number()]))
        .min(1)
        .max(5000),
    )
    .min(1)
    .max(200),
  width: z.number().positive().max(4000),
  height: z.number().positive().max(4000),
});
export type SigningInput = z.infer<typeof signingSchema>;

export type PatientFormValues = Record<string, string | boolean>;

/** Initial values of the "Neue Patientin / neuer Patient" form. */
export const EMPTY_PATIENT: PatientFormValues = {
  firstName: '',
  lastName: '',
  gender: '',
  dateOfBirth: '',
  preferredLanguage: 'de',
  occupation: '',
  gp: '',
  street: '',
  zip: '',
  city: '',
  phone: '',
  mobile: '',
  email: '',
  emergencyName: '',
  emergencyPhone: '',
  insurer: '',
  insuranceNumber: '',
  smoker: 'NO',
  smokingYears: '',
  packsPerDay: '',
  highBloodPressure: false,
  highBloodLipids: false,
  dizziness: false,
  osteoporosis: false,
  arthrosis: false,
  rheumatism: false,
  orthoOther: false,
  orthoOtherText: '',
  cardiovascular: false,
  diabetes: false,
  asthma: false,
  allergies: false,
  internalOther: false,
  internalOtherText: '',
  furtherDiagnoses: '',
  medication: '',
  pregnancy: 'NOT_APPLICABLE',
  inTreatment: 'NO',
  treatingDoctor: '',
};
