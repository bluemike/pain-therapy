'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { requirePlatformAdmin } from '@/lib/session';
import { fieldErrors } from '@/lib/schemas';
import {
  createPractice,
  deletePractice,
  invitePlatformAdmin,
  newPracticeSchema,
  practiceDetailsSchema,
  PlatformError,
  setPracticeStatus,
  updatePracticeDetails,
} from '@/lib/platform';
import { buildExport, requestExport } from '@/lib/practice-export';
import { z } from 'zod';

/** platform-admin (iteration 12, design D3, D9): actions of the page «Praxen» */

const person = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(200),
});

async function run(
  fn: (actor: Awaited<ReturnType<typeof requirePlatformAdmin>>) => Promise<unknown>,
  flash: string | (() => string),
) {
  const actor = await requirePlatformAdmin();
  try {
    await fn(actor);
  } catch (e) {
    if (e instanceof PlatformError) redirect(`/platform?error=${e.code}`);
    throw e;
  }
  redirect(`/platform?flash=${typeof flash === 'string' ? flash : flash()}`);
}

export type NewPracticeState = { errors?: Record<string, string>; values?: Record<string, string> };

const FIELDS = ['name', 'slug', 'street', 'zip', 'city', 'contactEmail', 'documentPrefix', 'adminName', 'adminEmail'];

export async function createPracticeAction(_prev: NewPracticeState, fd: FormData): Promise<NewPracticeState> {
  await requirePlatformAdmin();
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(fd.get(k) ?? '')]));
  const parsed = newPracticeSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  await run((actor) => createPractice(actor, parsed.data), 'created');
  return {};
}

export async function statusAction(fd: FormData) {
  const status = fd.get('status') === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
  await run(
    (actor) => setPracticeStatus(actor, String(fd.get('id')), status),
    status === 'SUSPENDED' ? 'suspended' : 'reactivated',
  );
}

const DETAIL_FIELDS = [
  'name',
  'street',
  'zip',
  'city',
  'defaultPlace',
  'contactEmail',
  'phone',
  'documentPrefix',
  'adminName',
  'adminEmail',
];

/** Iteration 13: details of an existing practice, optionally with the invitation of its practice admin */
export async function practiceDetailsAction(_prev: NewPracticeState, fd: FormData): Promise<NewPracticeState> {
  await requirePlatformAdmin();
  const values = Object.fromEntries(DETAIL_FIELDS.map((k) => [k, String(fd.get(k) ?? '')]));
  const parsed = practiceDetailsSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  let invited = false;
  await run(
    async (actor) => {
      invited = (await updatePracticeDetails(actor, String(fd.get('id')), parsed.data)).invited;
    },
    () => (invited ? 'savedInvited' : 'saved'),
  );
  return {};
}

export async function invitePlatformAdminAction(fd: FormData) {
  const parsed = person.safeParse({ name: fd.get('name'), email: fd.get('email') });
  if (!parsed.success) redirect('/platform?error=invalid');
  await run((actor) => invitePlatformAdmin(actor, parsed.data), 'invited');
}

export async function exportAction(fd: FormData) {
  await run(async (actor) => {
    const row = await requestExport(actor, String(fd.get('id')));
    after(() => buildExport(row.id).catch(console.error));
  }, 'exporting');
}

export async function deleteAction(fd: FormData) {
  if (fd.get('understood') !== 'on') redirect('/platform?error=confirm');
  await run((actor) => deletePractice(actor, String(fd.get('id')), String(fd.get('confirm') ?? '')), 'deleted');
}
