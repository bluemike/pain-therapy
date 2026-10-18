import { after } from 'next/server';
import { verifyInternalToken } from '@pain-therapy/shared/internal-auth';
import { config } from '@/lib/config';
import { db } from '@/lib/db';
import { deliverEmail, finalizeSignature } from '@/lib/signing';

export const dynamic = 'force-dynamic';

/**
 * zone-consent-signing: PDF, Archiv und Zustellung (iteration 5, design D7). Called by the patient zone right after a
 * signature. Outside the Entra sign-in, so it accepts only a valid HMAC of the session id and only SIGNED sessions of
 * the channel patient zone without a document; anything else answers 404 without saying why.
 */
export async function POST(req: Request, { params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  if (!verifyInternalToken(sid, config.internalSecret, req.headers.get('authorization')))
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  const s = await db.signatureSession.findUnique({
    where: { id: sid },
    select: { status: true, channel: true, document: { select: { id: true } } },
  });
  if (!s || s.status !== 'SIGNED' || s.channel !== 'PATIENT_ZONE' || s.document)
    return Response.json({ error: 'notFound' }, { status: 404 });
  const result = await finalizeSignature(sid);
  if (result?.delivery?.status === 'PENDING') after(() => deliverEmail(result.delivery!.id).catch(console.error));
  return Response.json({ ok: true, document: result?.document.documentNumber ?? null });
}
