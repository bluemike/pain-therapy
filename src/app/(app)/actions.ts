'use server';

import { after } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { unstable_update } from '@/auth';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { fieldErrors, formDataToObject, patientSchema } from '@/lib/schemas';
import { createPatient, findDuplicates, setStatus, updatePatient } from '@/lib/patients';
import { deliverEmail, requestResend, SigningError, startSigning } from '@/lib/signing';
import { publishVersion } from '@/lib/consent-texts';
import { signPatientMode } from '@/lib/patient-mode';
import { formatDate } from '@/lib/format';
import { LOCALE_COOKIE } from '@/i18n/request';

export type PatientFormState = {
  errors?: Record<string, string>;
  duplicate?: { id: string; name: string; dob: string; city: string | null; active: boolean }[];
  values?: Record<string, string>;
};

/** patient-records: Patient anlegen / ändern */
export async function savePatient(_prev: PatientFormState, fd: FormData): Promise<PatientFormState> {
  const actor = await requireUser();
  const id = String(fd.get('id') ?? '');
  const values = formDataToObject(fd);
  const parsed = patientSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!id) {
    if (fd.get('confirmDuplicate') !== '1') {
      const dups = await findDuplicates(parsed.data.lastName, parsed.data.dateOfBirth);
      if (dups.length)
        return {
          values,
          duplicate: dups.map((d) => ({
            id: d.id,
            name: `${d.firstName} ${d.lastName}`,
            dob: formatDate(d.dateOfBirth),
            city: d.city,
            active: d.status === 'ACTIVE',
          })),
        };
    }
    const created = await createPatient(actor, parsed.data);
    redirect(`/patients/${created.id}?flash=created`);
  }
  await updatePatient(actor, id, parsed.data);
  redirect(`/patients/${id}?flash=saved`);
}

export async function deactivatePatient(fd: FormData) {
  const actor = await requireUser();
  const id = String(fd.get('id'));
  await setStatus(
    actor,
    id,
    'INACTIVE',
    String(fd.get('reason') ?? '')
      .trim()
      .slice(0, 300),
  );
  redirect(`/patients/${id}?flash=deactivated`);
}

export async function reactivatePatient(fd: FormData) {
  const actor = await requireUser();
  const id = String(fd.get('id'));
  await setStatus(actor, id, 'ACTIVE');
  redirect(`/patients/${id}?flash=reactivated`);
}

/** consent-signing: An Patient übergeben. Switches this device into patient mode. */
export async function handOver(fd: FormData) {
  const actor = await requireUser();
  const id = String(fd.get('id'));
  let sid: string;
  try {
    sid = (await startSigning(actor, id)).id;
  } catch (e) {
    if (e instanceof SigningError) redirect(`/patients/${id}?error=${e.code}`);
    throw e;
  }
  await unstable_update({ patientMode: { sid, sig: signPatientMode(sid) } } as never);
  redirect(`/sign/${sid}`);
}

export async function resendEmail(fd: FormData) {
  const actor = await requireUser();
  const documentId = String(fd.get('documentId'));
  const patientId = String(fd.get('patientId'));
  const delivery = await requestResend(actor, documentId);
  if (delivery.status === 'PENDING') after(() => deliverEmail(delivery.id).catch(console.error));
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}?tab=documents&flash=resent`);
}

/** localization: Sprache wechseln, remembered per user */
export async function setLocale(fd: FormData) {
  const locale = fd.get('locale') === 'en' ? 'en' : 'de';
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
    httpOnly: false,
  });
  const { auth } = await import('@/auth');
  const session = await auth();
  if (session?.user?.id) await db.user.updateMany({ where: { entraOid: session.user.id }, data: { locale } });
  revalidatePath('/', 'layout');
}

export type PublishState = { errors?: Record<string, string>; published?: number };

export async function publishConsentText(_prev: PublishState, fd: FormData): Promise<PublishState> {
  const actor = await requireUser('manageConsentTexts');
  const input = {
    titleDe: String(fd.get('titleDe') ?? '').trim(),
    bodyDe: String(fd.get('bodyDe') ?? '').trim(),
    titleEn: String(fd.get('titleEn') ?? '').trim(),
    bodyEn: String(fd.get('bodyEn') ?? '').trim(),
  };
  const errors: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) if (!v) errors[k] = 'required';
  if (Object.keys(errors).length) return { errors };
  const version = await publishVersion(actor, input);
  revalidatePath('/', 'layout');
  return { published: version };
}
