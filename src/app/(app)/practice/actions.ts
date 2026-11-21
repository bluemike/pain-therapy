'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { requirePractice } from '@/lib/practice';
import { fieldErrors } from '@/lib/schemas';
import { LogoError, practiceSchema, updatePractice } from '@/lib/practice-settings';
import { buildExport, requestExport } from '@/lib/practice-export';

export type PracticeFormState = { errors?: Record<string, string>; values?: Record<string, string> };

const FIELDS = [
  'name',
  'street',
  'zip',
  'city',
  'contactEmail',
  'phone',
  'defaultPlace',
  'documentPrefix',
  'privacyNotice',
];

/** practice-settings: Praxis speichern (nur Praxis-Admin) */
export async function savePractice(_prev: PracticeFormState, fd: FormData): Promise<PracticeFormState> {
  const actor = await requireUser('manageConsentTexts');
  const practice = await requirePractice();
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? '')]));
  const parsed = practiceSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const file = fd.get('logo');
  const logo =
    fd.get('removeLogo') === 'on'
      ? ('remove' as const)
      : file instanceof File && file.size > 0
        ? { data: Buffer.from(await file.arrayBuffer()) }
        : null;
  try {
    await updatePractice(actor, practice.id, parsed.data, logo);
  } catch (e) {
    if (e instanceof LogoError) return { errors: { logo: e.code }, values };
    throw e;
  }
  revalidatePath('/', 'layout');
  redirect('/practice?flash=saved');
}

/** practice-export (iteration 12, design D9): «Export erstellen», built in the background */
export async function exportAction() {
  const actor = await requireUser('manageConsentTexts');
  const practice = await requirePractice();
  const row = await requestExport(actor, practice.id);
  after(() => buildExport(row.id).catch(console.error));
  redirect('/practice?flash=exporting#export');
}
