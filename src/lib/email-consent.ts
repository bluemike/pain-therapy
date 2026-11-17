import { db } from './db';

/**
 * Consent to unencrypted email from the valid signature, i.e. the latest completed (SIGNED) signature session, the
 * same one that decides "Unterschrift gültig" (iteration 5, design D2). It counts at once, also while the practice app
 * is still creating the PDF of a signature from the patient zone. Decides email for the exercise sheet (iteration 3)
 * and for the link to the patient zone (iteration 4, design D4).
 */
export async function emailConsentOf(patientId: string) {
  const session = await db.signatureSession.findFirst({
    where: { patientId, status: 'SIGNED' },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true, consents: true },
  });
  return {
    granted: session?.consents.find((c) => c.kind === 'UNENCRYPTED_EMAIL')?.granted ?? false,
    signedAt: session?.completedAt ?? null,
  };
}
