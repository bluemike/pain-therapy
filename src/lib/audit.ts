import type { Prisma, PrismaClient } from '@prisma/client';
import { db } from './db';
import type { Actor } from './session';

export type AuditAction =
  | 'patient.viewed'
  | 'patient.created'
  | 'patient.updated'
  | 'patient.deactivated'
  | 'patient.reactivated'
  | 'signing.started'
  | 'signing.aborted'
  | 'signing.completed'
  | 'document.viewed'
  | 'email.sent'
  | 'email.failed'
  | 'email.resend'
  | 'consentText.published'
  | 'treatment.created'
  | 'treatment.updated'
  | 'consultation.created'
  | 'consultation.updated'
  | 'photo.added'
  | 'photo.removed'
  | 'photo.viewed';

type Tx = Prisma.TransactionClient | PrismaClient;

/** Appends to the audit log (access-control: Zugriffsprotokoll). The table rejects updates and deletes. */
export async function audit(
  actor: Pick<Actor, 'id' | 'name'>,
  action: AuditAction,
  data: {
    patientId?: string | null;
    field?: string;
    before?: string | null;
    after?: string | null;
    details?: Prisma.InputJsonValue;
  } = {},
  tx: Tx = db,
) {
  await tx.auditEvent.create({
    data: {
      userId: actor.id,
      userName: actor.name,
      action,
      patientId: data.patientId ?? null,
      field: data.field,
      before: data.before ?? null,
      after: data.after ?? null,
      details: data.details,
    },
  });
}

export const SYSTEM_ACTOR = { id: 'system', name: 'System' };
