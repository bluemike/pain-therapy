import type { Prisma } from '@prisma/client';
import { ZONE_ACTOR } from '@pain-therapy/shared/access';
import { db } from './db';

/** Actions the patient zone writes; the practice app shows them in "Verlauf" (src/lib/audit.ts there) */
export type ZoneAuditAction =
  | 'accessLink.confirmed'
  | 'accessLink.confirmFailed'
  | 'accessLink.locked'
  | 'accessLink.blocked'
  | 'zone.viewed'
  | 'zone.signedOut'
  | 'exerciseLog.created'
  | 'exerciseLog.corrected'
  | 'exerciseLog.deleted';

type Tx = Pick<Prisma.TransactionClient, 'auditEvent'>;

/**
 * patient-zone-app: Zugriff protokolliert (design D12, D14). User "Patienten-Zone", the patient in patientId and the
 * link in details.linkId. createMany inserts without reading back, which the role may not do.
 */
export async function zoneAudit(
  action: ZoneAuditAction,
  data: {
    patientId: string;
    linkId: string;
    before?: string | null;
    after?: string | null;
    details?: Record<string, Prisma.InputJsonValue | null>;
  },
  tx: Tx = db,
) {
  await tx.auditEvent.createMany({
    data: [
      {
        userId: ZONE_ACTOR.id,
        userName: ZONE_ACTOR.name,
        action,
        patientId: data.patientId,
        before: data.before ?? null,
        after: data.after ?? null,
        details: { linkId: data.linkId, ...data.details },
      },
    ],
  });
}
