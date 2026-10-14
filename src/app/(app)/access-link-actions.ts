'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import {
  AccessLinkError,
  accessSheetPrinted,
  deliverAccessLink,
  revokeAccessLink,
  sendAccessLink,
} from '@/lib/patient-access';

/**
 * patient-access: "Link senden", "Zugangsblatt drucken" and "Link sperren" in the tab "Übungstagebuch" (iteration 4,
 * design D4). The QR code and the access sheet go only to the therapist's browser and are never stored.
 */
export type AccessLinkState = {
  ok?:
    | { channel: 'EMAIL'; to: string }
    | { channel: 'SCREEN'; linkId: string; qr: string; accessSheet: string /* base64 PDF */ };
  /** Key of the "exerciseLog" namespace */
  error?: string;
};

const ERRORS: Record<AccessLinkError['code'], string> = {
  notFound: 'linkError',
  inactive: 'linkErrorInactive',
  noProgram: 'linkErrorNoProgram',
  disabled: 'linkErrorDisabled',
};

export async function sendAccessLinkAction(_prev: AccessLinkState, fd: FormData): Promise<AccessLinkState> {
  const actor = await requireUser();
  const patientId = String(fd.get('patientId') ?? '');
  try {
    const sent = await sendAccessLink(actor, patientId);
    revalidatePath(`/patients/${patientId}`);
    if (sent.channel === 'EMAIL') {
      after(() => deliverAccessLink(sent.deliveryId, sent.url).catch(console.error));
      return { ok: { channel: 'EMAIL', to: sent.to } };
    }
    return {
      ok: { channel: 'SCREEN', linkId: sent.linkId, qr: sent.qr, accessSheet: sent.accessSheet.toString('base64') },
    };
  } catch (e) {
    if (e instanceof AccessLinkError) return { error: ERRORS[e.code] };
    throw e;
  }
}

/** Logs that the access sheet was opened for printing (the PDF itself is already in the browser) */
export async function accessSheetPrintedAction(fd: FormData) {
  const actor = await requireUser();
  const patientId = String(fd.get('patientId') ?? '');
  await accessSheetPrinted(actor, patientId, String(fd.get('linkId') ?? ''));
  revalidatePath(`/patients/${patientId}`);
}

export async function revokeAccessLinkAction(fd: FormData) {
  const actor = await requireUser();
  const patientId = String(fd.get('patientId') ?? '');
  await revokeAccessLink(actor, patientId);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}?tab=log&flash=linkRevoked`);
}
