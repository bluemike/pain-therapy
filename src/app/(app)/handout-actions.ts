'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { createHandout, deliverHandout, HandoutError, requestHandoutResend } from '@/lib/handouts';

/** ok: the new handout; error: key of the "handout" namespace */
export type HandoutState = {
  ok?: { id: string; number: string; channel: 'EMAIL' | 'PRINT'; to: string | null };
  error?: string;
};

const ERRORS: Record<HandoutError['code'], string> = {
  notFound: 'error',
  noPrescription: 'errorNoPrescription',
  noConsent: 'errorNoConsent',
  noAddress: 'errorNoAddress',
};

/** exercise-handout: "Übungsblatt senden" or "Drucken" on the Abschluss page */
export async function createHandoutAction(_prev: HandoutState, fd: FormData): Promise<HandoutState> {
  const actor = await requireUser();
  const consultationId = String(fd.get('consultationId') ?? '');
  const channel = fd.get('channel') === 'EMAIL' ? 'EMAIL' : 'PRINT';
  try {
    const { handout, delivery } = await createHandout(actor, consultationId, channel);
    if (delivery.status === 'PENDING') after(() => deliverHandout(delivery.id).catch(console.error));
    revalidatePath(`/patients/${handout.patientId}`);
    return { ok: { id: handout.id, number: handout.documentNumber, channel, to: delivery.recipient } };
  } catch (e) {
    if (e instanceof HandoutError) return { error: ERRORS[e.code] };
    throw e;
  }
}

/** Documents tab: send an exercise sheet again after a failed delivery */
export async function resendHandout(fd: FormData) {
  const actor = await requireUser();
  const handoutId = String(fd.get('handoutId'));
  const patientId = String(fd.get('patientId'));
  const delivery = await requestHandoutResend(actor, handoutId);
  if (delivery.status === 'PENDING') after(() => deliverHandout(delivery.id).catch(console.error));
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}?tab=documents&flash=resent`);
}
