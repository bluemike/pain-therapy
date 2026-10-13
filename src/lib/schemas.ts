import { z } from 'zod';
import { parseLocalInput, parseSwissDate } from './format';
import { DEFAULT_REPETITION, REPETITIONS } from './home-program';

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

// ---------- Iteration 2: treatments and consultations ----------

/** Pain in percent on the paper form: 0, 10 … 100 */
export const PAIN_VALUES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;
export const SENSITIVITIES = ['LOW', 'MEDIUM', 'STRONG', 'EXTREME'] as const;
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD', 'IMPOSSIBLE'] as const;
export const ROLLING_SLOTS = 6;

const isPain = (n: number) => (PAIN_VALUES as readonly number[]).includes(n);

/** Date and time from <input type="datetime-local">, Swiss time, required and not in the future. */
const pastDateTime = z
  .string()
  .trim()
  .min(1, { message: 'required' })
  .transform((v, ctx) => {
    const d = parseLocalInput(v);
    if (!d) {
      ctx.addIssue({ code: 'custom', message: 'dateTime' });
      return z.NEVER;
    }
    // The form shows minutes only, so "now" may be up to a minute ahead of the server clock
    if (d.getTime() > Date.now() + 60_000) {
      ctx.addIssue({ code: 'custom', message: 'dateTimeFuture' });
      return z.NEVER;
    }
    return d;
  });

const optionalPain = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === '') return null;
    const n = Number(v);
    if (!isPain(n)) {
      ctx.addIssue({ code: 'custom', message: 'pain' });
      return z.NEVER;
    }
    return n;
  });

const requiredPain = z
  .string()
  .trim()
  .min(1, { message: 'required' })
  .pipe(optionalPain)
  .transform((v) => v as number);

/** treatments: Behandlung eröffnen / ändern */
export const treatmentSchema = z.object({
  startedAt: pastDateTime,
  regionId: z
    .string()
    .trim()
    .min(1, { message: 'required' })
    .transform((v, ctx) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({ code: 'custom', message: 'required' });
        return z.NEVER;
      }
      return n;
    }),
  diagnosis: requiredText(2000),
  painStart: requiredPain,
});
export type TreatmentInput = z.output<typeof treatmentSchema>;
export const TREATMENT_FIELDS = ['startedAt', 'regionId', 'diagnosis', 'painStart'] as const;

const sheetText = (max: number) =>
  z
    .string()
    .nullable()
    .transform((v) => v?.trim() ?? '')
    .pipe(z.string().max(max, { message: 'tooLong' }))
    .transform((v) => (v === '' ? null : v));

const homeRow = z.object({
  code: z.string().min(1).max(10),
  repetition: z.enum(REPETITIONS),
  // home-program: Intensität 10 is never offered
  intensity: z.number().int().min(1).max(9).nullable(),
  steps: z.number().int().min(1).max(3).nullable(),
  note: sheetText(300),
});
export type HomeRow = z.output<typeof homeRow>;

/**
 * The digital Behandlungsbogen, sent by the consultation form as JSON. Empty rows are dropped. `home` is the block
 * "Selbstausführung" (iteration 3): exactly one row per prescribed exercise, "täglich 1x" where the form sent none.
 */
export const sheetSchema = z
  .object({
    points: z
      .array(
        z.object({
          pointId: z.string().min(1).max(20),
          left: z.boolean(),
          right: z.boolean(),
          sensitivity: z.enum(SENSITIVITIES).nullable(),
        }),
      )
      .max(200),
    exercises: z
      .array(
        z.object({
          code: z.string().min(1).max(10),
          prescribed: z.boolean(),
          difficulty: z.enum(DIFFICULTIES).nullable(),
          variants: sheetText(500),
        }),
      )
      .max(100),
    rolling: z
      .array(
        z.object({
          position: z.number().int().min(1).max(ROLLING_SLOTS),
          area: sheetText(200),
          toolCode: z.string().min(1).max(10).nullable(),
        }),
      )
      .max(ROLLING_SLOTS),
    home: z.array(homeRow).max(100).default([]),
  })
  .refine((s) => new Set(s.home.map((h) => h.code)).size === s.home.length, { message: 'sheet' })
  .transform((s) => {
    const exercises = s.exercises.filter((x) => x.prescribed || x.difficulty || x.variants);
    const home = exercises
      .filter((x) => x.prescribed)
      .map(
        (x) =>
          s.home.find((h) => h.code === x.code) ?? {
            code: x.code,
            repetition: DEFAULT_REPETITION,
            intensity: null,
            steps: null,
            note: null,
          },
      );
    return {
      points: s.points.filter((p) => p.left || p.right || p.sensitivity),
      exercises,
      rolling: s.rolling.filter((r) => r.area || r.toolCode),
      home,
    };
  })
  .refine((s) => new Set(s.points.map((p) => p.pointId)).size === s.points.length, { message: 'sheet' })
  .refine((s) => new Set(s.exercises.map((x) => x.code)).size === s.exercises.length, { message: 'sheet' })
  .refine((s) => new Set(s.rolling.map((r) => r.position)).size === s.rolling.length, { message: 'sheet' });
export type Sheet = z.output<typeof sheetSchema>;
export const EMPTY_SHEET: Sheet = { points: [], exercises: [], rolling: [], home: [] };

/** consultations: Konsultation eröffnen / ändern */
export const consultationSchema = z.object({
  at: pastDateTime,
  diagnosis: requiredText(2000),
  painBefore: optionalPain,
  painAfter: optionalPain,
  comparison: text(2000),
  sheet: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v || '{"points":[],"exercises":[],"rolling":[],"home":[]}') as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'sheet' });
        return z.NEVER;
      }
    })
    .pipe(sheetSchema),
});
export type ConsultationInput = z.output<typeof consultationSchema>;

export function pickFields(fd: FormData, fields: readonly string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const k of fields) {
    const v = fd.get(k);
    obj[k] = typeof v === 'string' ? v : '';
  }
  return obj;
}
