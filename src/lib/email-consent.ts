import { db } from './db';

/**
 * Consent to unencrypted email from the valid signature, i.e. the most recent signed document (the same document
 * that decides "Unterschrift gültig"). Decides email for the exercise sheet (iteration 3) and for the link to the
 * patient zone (iteration 4, design D4).
 */
export async function emailConsentOf(patientId: string) {
  const doc = await db.signedDocument.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    include: { session: { include: { consents: true } } },
  });
  return {
    granted: doc?.session.consents.find((c) => c.kind === 'UNENCRYPTED_EMAIL')?.granted ?? false,
    signedAt: doc ? (doc.session.completedAt ?? doc.createdAt) : null,
  };
}
