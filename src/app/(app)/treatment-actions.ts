'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import {
  consultationSchema,
  fieldErrors,
  pickFields,
  sheetErrors,
  TREATMENT_FIELDS,
  treatmentSchema,
} from '@/lib/schemas';
import {
  createConsultation,
  createTreatment,
  TreatmentError,
  updateConsultation,
  updateTreatment,
} from '@/lib/treatments';
import { PhotoError, photosFromForm, type PhotoUpload } from '@/lib/photos';
import { db } from '@/lib/db';
import { hasInkAfter, inkChangeFrom, InkError, type InkChange } from '@/lib/handwriting';
import { z } from 'zod';

/** Handschrift (iteration 10, design D5): reads <field>Ink for each remark field; null with an error per field */
function readInk<F extends string>(fd: FormData, fields: readonly F[]) {
  const ink = {} as Record<F, InkChange>;
  const errors: Record<string, string> = {};
  for (const f of fields) {
    try {
      ink[f] = inkChangeFrom(fd, f);
    } catch (e) {
      if (!(e instanceof InkError)) throw e;
      errors[f] = e.code;
    }
  }
  return { ink, errors };
}

/** A required remark field may be empty when it holds handwriting (spec handwritten-notes: Speichern als Bild) */
const optionalNote = z.string().trim().max(2000, { message: 'tooLong' });

/** errors: field → key of the "errors" namespace; error: banner (key of "errors") */
export type TreatmentFormState = { errors?: Record<string, string>; error?: string };

const CONSULTATION_FIELDS = ['at', 'diagnosis', 'painBefore', 'painAfter', 'comparison', 'sheet'] as const;

function knownError(e: unknown): TreatmentFormState | null {
  if (e instanceof PhotoError) return { errors: { photos: e.code } };
  if (e instanceof TreatmentError) {
    if (e.code === 'region') return { errors: { regionId: 'region' } };
    if (e.code === 'regionLocked') return { errors: { regionId: 'regionLocked' } };
    if (e.code === 'sideLocked') return { errors: { side: 'sideLocked' } };
    if (e.code === 'side') return { error: 'side' };
    if (e.code === 'startAfterConsultation') return { errors: { startedAt: 'startAfterConsultation' } };
    if (e.code === 'inactive') return { error: 'patientInactive' };
    if (e.code === 'consent') return { error: 'consent' };
    if (e.code === 'catalog') return { error: 'catalog' };
    if (e.code === 'prescriptionLogged') return { error: 'prescriptionLogged' };
    return { error: 'generic' };
  }
  return null;
}

async function readPhotos(fd: FormData): Promise<{ add: PhotoUpload[]; remove: string[] }> {
  return {
    add: await photosFromForm(fd),
    remove: fd.getAll('removePhoto').map(String),
  };
}

/** treatments: Behandlung eröffnen / ändern */
export async function saveTreatment(_prev: TreatmentFormState, fd: FormData): Promise<TreatmentFormState> {
  const actor = await requireUser();
  const patientId = String(fd.get('patientId') ?? '');
  const id = String(fd.get('id') ?? '');
  const { ink, errors: inkErrors } = readInk(fd, ['diagnosis'] as const);
  if (Object.keys(inkErrors).length) return { errors: inkErrors };
  const stored = id ? await db.treatment.findUnique({ where: { id }, select: { diagnosisInk: true } }) : null;
  const schema = hasInkAfter(stored?.diagnosisInk, ink.diagnosis)
    ? treatmentSchema.extend({ diagnosis: optionalNote })
    : treatmentSchema;
  const parsed = schema.safeParse(pickFields(fd, TREATMENT_FIELDS));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const input = { ...parsed.data, diagnosisInk: ink.diagnosis };
  let saved: { id: string; patientId: string };
  try {
    const photos = await readPhotos(fd);
    saved = id
      ? await updateTreatment(actor, id, input, photos)
      : await createTreatment(actor, patientId, input, photos.add);
  } catch (e) {
    const known = knownError(e);
    if (known) return known;
    throw e;
  }
  redirect(`/patients/${saved.patientId}?flash=${id ? 'treatmentSaved' : 'treatmentCreated'}#t-${saved.id}`);
}

/** session-form: Sitzung eröffnen / ändern */
export async function saveConsultation(_prev: TreatmentFormState, fd: FormData): Promise<TreatmentFormState> {
  const actor = await requireUser();
  const patientId = String(fd.get('patientId') ?? '');
  const treatmentId = String(fd.get('treatmentId') ?? '');
  const id = String(fd.get('id') ?? '');
  const { ink, errors: inkErrors } = readInk(fd, ['diagnosis', 'comparison'] as const);
  if (Object.keys(inkErrors).length) return { errors: inkErrors };
  // A new session starts with the treatment's handwriting as proposal ("keep" means: the treatment's image)
  const stored = id
    ? await db.consultation.findUnique({ where: { id }, select: { diagnosisInk: true } })
    : await db.treatment.findUnique({ where: { id: treatmentId }, select: { diagnosisInk: true } });
  const schema = hasInkAfter(stored?.diagnosisInk, ink.diagnosis)
    ? consultationSchema.extend({ diagnosis: optionalNote })
    : consultationSchema;
  const parsed = schema.safeParse(pickFields(fd, CONSULTATION_FIELDS));
  if (!parsed.success) {
    const perExercise = sheetErrors(parsed.error);
    const { sheet, ...errors } = fieldErrors(parsed.error);
    if (Object.keys(perExercise).length) return { errors: { ...errors, ...perExercise } };
    return sheet ? { errors: { ...errors, sheet }, error: 'sheet' } : { errors };
  }
  let saved: { id: string; number: number };
  try {
    const photos = await readPhotos(fd);
    const input = { ...parsed.data, diagnosisInk: ink.diagnosis, comparisonInk: ink.comparison };
    saved = id
      ? await updateConsultation(actor, id, input, photos)
      : await createConsultation(actor, treatmentId, input, photos.add);
  } catch (e) {
    const known = knownError(e);
    if (known) return known;
    throw e;
  }
  // exercise-handout (design D6): with home exercises the Abschluss page offers the exercise sheet; saving alone
  // never creates one
  if (parsed.data.sheet.home.length)
    redirect(`/patients/${patientId}/treatments/${treatmentId}/consultations/${saved.id}/handout?flash=saved`);
  redirect(`/patients/${patientId}?flash=consultationSaved&n=${saved.number}#t-${treatmentId}`);
}
