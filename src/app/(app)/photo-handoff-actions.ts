'use server';

import { requireUser } from '@/lib/session';
import { qrPng } from '@/lib/access-sheet-pdf';
import { endHandoff, HandoffError, startHandoff } from '@/lib/photo-handoff';

export type HandoffStart =
  | { ok: true; id: string; url: string; checkCode: string; expiresAt: string; qr: string }
  | { ok: false; error: 'notFound' | 'inactive' | 'generic' };

/** Fotos mit dem Smartphone (iteration 15, design D5): «Mit Smartphone aufnehmen» in the photo field */
export async function startHandoffAction(patientId: string, treatmentId: string | null): Promise<HandoffStart> {
  const actor = await requireUser();
  try {
    const h = await startHandoff(actor, patientId, treatmentId);
    return {
      ok: true,
      id: h.id,
      url: h.url,
      checkCode: h.checkCode,
      expiresAt: h.expiresAt.toISOString(),
      qr: await qrPng(h.url),
    };
  } catch (e) {
    if (e instanceof HandoffError && (e.code === 'notFound' || e.code === 'inactive'))
      return { ok: false, error: e.code };
    return { ok: false, error: 'generic' };
  }
}

/** «Beenden»: the link accepts no more photos */
export async function endHandoffAction(id: string): Promise<void> {
  const actor = await requireUser();
  await endHandoff(actor, id);
}
