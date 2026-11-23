'use server';

import { after } from 'next/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { fieldErrors, formDataToObject, patientSchema } from '@/lib/schemas';
import { PlanLimitError } from '@/lib/plans';
import { createPatient, findDuplicates, setStatus, updatePatient } from '@/lib/patients';
import { deliverEmail, requestResend } from '@/lib/signing';
import { markTemplateSeen, publishVersion, unknownFieldsOf } from '@/lib/consent-texts';
import { formatDate } from '@/lib/format';
import { LOCALE_COOKIE } from '@/i18n/request';
import { inkChangeFrom, InkError, type InkChange } from '@/lib/handwriting';

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
  let ink: InkChange;
  try {
    ink = inkChangeFrom(fd, 'furtherDiagnoses');
  } catch (e) {
    if (!(e instanceof InkError)) throw e;
    return { errors: { furtherDiagnoses: e.code }, values };
  }
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
    let created;
    try {
      created = await createPatient(actor, parsed.data, ink);
    } catch (e) {
      if (e instanceof PlanLimitError) redirect('/patients/new');
      throw e;
    }
    redirect(`/patients/${created.id}?flash=created`);
  }
  await updatePatient(actor, id, parsed.data, ink);
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

export async function resendEmail(fd: FormData) {
  const actor = await requireUser();
  const documentId = String(fd.get('documentId'));
  const patientId = String(fd.get('patientId'));
  const { delivery, access } = await requestResend(actor, documentId);
  if (delivery.status === 'PENDING')
    after(() => deliverEmail(delivery.id, { access: access ?? undefined }).catch(console.error));
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
  if (session?.user?.id) await db.user.updateMany({ where: { id: session.user.id }, data: { locale } });
  revalidatePath('/', 'layout');
}

export type PublishState = {
  errors?: Record<string, string>;
  /** Unknown fields per input (iteration 17, design D1) */
  unknown?: Record<string, string[]>;
  published?: number;
};

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
  const unknown = unknownFieldsOf(input);
  if (Object.keys(unknown).length)
    return { errors: Object.fromEntries(Object.keys(unknown).map((k) => [k, 'unknownField'])), unknown };
  const version = await publishVersion(actor, input, { fromTemplate: fd.get('fromTemplate') === '1' });
  revalidatePath('/', 'layout');
  return { published: version };
}

/** consent-template (iteration 17, design D3): «Nicht übernehmen» hides the notice about the new template */
export async function dismissTemplate() {
  await requireUser('manageConsentTexts');
  await markTemplateSeen();
  redirect('/admin/consent-texts');
}
