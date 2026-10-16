import type { PrismaClient } from '@prisma/client';
import { currentProgram } from './program';
import { signatureStateOf } from './signing';

/**
 * zone-record: Gültigkeit des Links (iteration 6, design D3). A patient with at least one treatment or one signed
 * document has a record in the patient zone, so the link stays valid without a home program or pending signature.
 * A completed signature counts already while its PDF is being created ("wird erstellt" under "Dokumente"), so the
 * device session does not end between the signature and the PDF. Reads only columns the role patient_zone may read.
 */
export async function hasRecord(db: Pick<PrismaClient, 'treatment' | 'signatureSession'>, patientId: string) {
  const [treatment, signed] = await Promise.all([
    db.treatment.findFirst({ where: { patientId }, select: { id: true } }),
    db.signatureSession.findFirst({ where: { patientId, status: 'SIGNED' }, select: { id: true } }),
  ]);
  return !!treatment || !!signed;
}

/**
 * Purpose of the link (iteration 6, design D3): purposeActive = homeProgramActive || signaturePending || hasRecord.
 * Shared by the practice app (link status, "Link senden") and the patient zone (confirmation, device session).
 */
export async function linkPurposeOf(
  db: Pick<PrismaClient, 'treatment' | 'consultation' | 'signatureSession' | 'consentTextVersion'>,
  patientId: string,
  now = new Date(),
) {
  const [program, signature, record] = await Promise.all([
    currentProgram(db, patientId, now),
    signatureStateOf(db, patientId),
    hasRecord(db, patientId),
  ]);
  return { program, signature, hasRecord: record, purposeActive: !!program?.active || signature.pending || record };
}
