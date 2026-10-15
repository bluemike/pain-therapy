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
  // Iteration 5 (design D7): the PDF of a signature was created and archived (iPad and patient zone)
  | 'document.archived'
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
  | 'photo.viewed'
  | 'handout.created'
  | 'handout.printed'
  // patient-access (iteration 4, design D3): link issued, replaced by a new one, sent by email, shown as QR code,
  // access sheet printed, revoked by the practice
  | 'accessLink.issued'
  | 'accessLink.replaced'
  | 'accessLink.sent'
  | 'accessLink.shown'
  | 'accessLink.printed'
  | 'accessLink.revoked'
  // zone-consent-invitation (iteration 5, design D3, D9): invitation to sign, remark of the patient marked as done
  | 'accessLink.invited'
  | 'signing.noteResolved'
  // Written by the patient zone (user "Patienten-Zone", design D12): confirmation with the date of birth, locks,
  // device session and the exercise log
  | 'accessLink.confirmed'
  | 'accessLink.confirmFailed'
  | 'accessLink.locked'
  | 'accessLink.blocked'
  | 'zone.viewed'
  | 'zone.signedOut'
  | 'signing.formOpened'
  | 'exerciseLog.created'
  | 'exerciseLog.corrected'
  | 'exerciseLog.deleted'
  // adherence-overview: the practice opened the tab "Übungstagebuch"
  | 'exerciseLog.viewed';

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
