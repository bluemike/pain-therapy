'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { consultationSchema, fieldErrors, pickFields, TREATMENT_FIELDS, treatmentSchema } from '@/lib/schemas';
import {
  createConsultation,
  createTreatment,
  TreatmentError,
  updateConsultation,
  updateTreatment,
} from '@/lib/treatments';
import { PhotoError, photosFromForm, type PhotoUpload } from '@/lib/photos';

/** errors: field → key of the "errors" namespace; error: banner (key of "errors") */
export type TreatmentFormState = { errors?: Record<string, string>; error?: string };

const CONSULTATION_FIELDS = ['at', 'diagnosis', 'painBefore', 'painAfter', 'comparison', 'sheet'] as const;

function knownError(e: unknown): TreatmentFormState | null {
  if (e instanceof PhotoError) return { errors: { photos: e.code } };
  if (e instanceof TreatmentError) {
    if (e.code === 'region') return { errors: { regionId: 'region' } };
    if (e.code === 'inactive') return { error: 'patientInactive' };
    if (e.code === 'consent') return { error: 'consent' };
    if (e.code === 'catalog') return { error: 'catalog' };
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
  const parsed = treatmentSchema.safeParse(pickFields(fd, TREATMENT_FIELDS));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  let saved: { id: string; patientId: string };
  try {
    const photos = await readPhotos(fd);
    saved = id
      ? await updateTreatment(actor, id, parsed.data, photos)
      : await createTreatment(actor, patientId, parsed.data, photos.add);
  } catch (e) {
    const known = knownError(e);
    if (known) return known;
    throw e;
  }
  redirect(`/patients/${saved.patientId}?flash=${id ? 'treatmentSaved' : 'treatmentCreated'}#t-${saved.id}`);
}

/** consultations: Konsultation eröffnen / ändern */
export async function saveConsultation(_prev: TreatmentFormState, fd: FormData): Promise<TreatmentFormState> {
  const actor = await requireUser();
  const patientId = String(fd.get('patientId') ?? '');
  const treatmentId = String(fd.get('treatmentId') ?? '');
  const id = String(fd.get('id') ?? '');
  const parsed = consultationSchema.safeParse(pickFields(fd, CONSULTATION_FIELDS));
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    return errors.sheet ? { errors, error: 'sheet' } : { errors };
  }
  let number: number;
  try {
    const photos = await readPhotos(fd);
    number = id
      ? (await updateConsultation(actor, id, parsed.data, photos)).number
      : (await createConsultation(actor, treatmentId, parsed.data, photos.add)).number;
  } catch (e) {
    const known = knownError(e);
    if (known) return known;
    throw e;
  }
  redirect(`/patients/${patientId}?flash=consultationSaved&n=${number}#t-${treatmentId}`);
}
