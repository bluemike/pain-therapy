import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { patientSchema } from '@/lib/schemas';
import {
  createPatient,
  dashboardData,
  historyOf,
  listPatients,
  setStatus,
  updatePatient,
  viewPatient,
} from '@/lib/patients';
import { INITIAL_TEXTS, publishVersion } from '@/lib/consent-texts';
import { completeSigning, deliverEmail, requestResend, startSigning } from '@/lib/signing';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import { sha256 } from '@/lib/storage';
import { EMPTY_PATIENT } from '@/lib/schemas';
import type { Actor } from '@/lib/session';

const actor: Actor = { id: 'u-1', name: 'Mike Franz', email: 'mike.franz@ayanta.ch', roles: ['THERAPIST', 'ADMIN'] };
const form = (over: Record<string, string>) =>
  patientSchema.parse({
    ...Object.fromEntries(Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? '' : v])),
    email: 'patient@example.ch',
    ...over,
  });
const signature = {
  strokes: [
    [
      [10, 50, 0.5],
      [40, 30, 0.5],
      [80, 60, 0.5],
      [120, 40, 0.5],
    ],
  ] as [number, number, number][][],
  width: 600,
  height: 220,
};
const signInput = (email: boolean) => ({
  note: null,
  place: 'Falera',
  readToEnd: true as const,
  liability: true as const,
  dataProcessing: true as const,
  unencryptedEmail: email,
  ...signature,
});

afterEach(() => setMailer(null));

describe('dashboard', () => {
  it('shows zeros on an empty system (dashboard: Leeres System)', async () => {
    const d = await dashboardData();
    expect(d.activeCount).toBe(0);
    expect(d.pending).toEqual([]);
  });
});

describe('patients and audit log', () => {
  beforeAll(async () => {
    await publishVersion(actor, {
      titleDe: INITIAL_TEXTS.de.title,
      bodyDe: INITIAL_TEXTS.de.body,
      titleEn: INITIAL_TEXTS.en.title,
      bodyEn: INITIAL_TEXTS.en.body,
    });
  });

  it('logs viewing and changing a record and keeps old and new address (task 2.5, 5.4)', async () => {
    const p = await createPatient(
      actor,
      form({ firstName: 'Anna', lastName: 'Müller', dateOfBirth: '05.03.1980', street: 'Dorfstrasse 8' }),
    );
    await viewPatient(actor, p.id);
    await updatePatient(
      actor,
      p.id,
      form({
        firstName: 'Anna',
        lastName: 'Müller',
        dateOfBirth: '05.03.1980',
        street: 'Dorfstrasse 12',
        osteoporosis: 'on',
      }),
    );
    const events = await db.auditEvent.findMany({ where: { patientId: p.id }, orderBy: { at: 'asc' } });
    expect(events.map((e) => e.action)).toEqual([
      'patient.created',
      'patient.viewed',
      'patient.updated',
      'patient.updated',
    ]);
    const street = events.find((e) => e.field === 'street')!;
    expect([street.before, street.after, street.userName]).toEqual(['Dorfstrasse 8', 'Dorfstrasse 12', 'Mike Franz']);
    expect((await historyOf(p.id)).some((e) => e.action === 'patient.viewed')).toBe(false);
  });

  it('cannot change or delete audit entries, documents or patients', async () => {
    const e = await db.auditEvent.findFirstOrThrow();
    await expect(db.auditEvent.update({ where: { id: e.id }, data: { action: 'x' } })).rejects.toThrow(/append-only/);
    await expect(db.auditEvent.delete({ where: { id: e.id } })).rejects.toThrow(/append-only/);
    const p = await db.patient.findFirstOrThrow();
    await expect(db.patient.delete({ where: { id: p.id } })).rejects.toThrow(/cannot be deleted/);
  });

  it('searches by name, date of birth and insurance number, and filters by status', async () => {
    const p = await createPatient(
      actor,
      form({ firstName: 'Thomas', lastName: 'Meier', dateOfBirth: '12.11.1967', insuranceNumber: '756.9876.5432.10' }),
    );
    expect((await listPatients({ q: 'meier' })).map((x) => x.id)).toEqual([p.id]);
    expect((await listPatients({ q: '12.11.1967' })).map((x) => x.id)).toEqual([p.id]);
    expect((await listPatients({ q: '9876' })).map((x) => x.id)).toEqual([p.id]);
    await setStatus(actor, p.id, 'INACTIVE', 'Behandlung abgeschlossen');
    expect(await listPatients({ q: 'meier' })).toEqual([]);
    expect((await listPatients({ q: 'meier', filter: 'inactive' }))[0].deactivationReason).toBe(
      'Behandlung abgeschlossen',
    );
    await setStatus(actor, p.id, 'ACTIVE');
    expect((await listPatients({ q: 'meier' })).length).toBe(1);
  });

  it('lists a patient without signature as pending on the dashboard (task 4.2)', async () => {
    const d = await dashboardData();
    expect(d.activeCount).toBe(2);
    expect(d.pending.map((p) => p.lastName).sort()).toEqual(['Meier', 'Müller']);
  });
});

describe('signing, PDF archive and email', () => {
  it('archives the PDF with matching checksum and emails it with consent (task 6.6, 7.2, 7.3)', async () => {
    const sent: OutgoingMail[] = [];
    setMailer({ send: async (m) => void sent.push(m) });
    const p = await createPatient(
      actor,
      form({
        firstName: 'Sarah',
        lastName: 'Thompson',
        dateOfBirth: '22.07.1991',
        preferredLanguage: 'en',
        email: 'sarah@example.com',
      }),
    );
    const s = await startSigning(actor, p.id);
    expect(s.language).toBe('en');
    const { document, delivery } = await completeSigning(actor, s.id, { ...signInput(true), note: 'New mobile' });
    const file = await readFile(path.join(process.env.STORAGE_LOCAL_DIR!, document.blobPath));
    expect(sha256(file)).toBe(document.sha256);
    expect(file.subarray(0, 5).toString()).toBe('%PDF-');
    await deliverEmail(delivery.id, { retryDelayMs: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('sarah@example.com');
    expect(sent[0].subject).toBe(`Your signed liability waiver (${document.documentNumber})`);
    const consents = await db.consent.findMany({ where: { sessionId: s.id } });
    expect(consents.map((c) => [c.kind, c.granted]).sort()).toEqual([
      ['DATA_PROCESSING', true],
      ['LIABILITY_WAIVER', true],
      ['UNENCRYPTED_EMAIL', true],
    ]);
    expect((await db.emailDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe('SENT');
    await expect(completeSigning(actor, s.id, signInput(true))).rejects.toThrow('notOpen');
    await expect(db.signedDocument.update({ where: { id: document.id }, data: { sha256: 'x' } })).rejects.toThrow(
      /append-only/,
    );
  });

  it('sends nothing without email consent', async () => {
    const sent: OutgoingMail[] = [];
    setMailer({ send: async (m) => void sent.push(m) });
    const p = await createPatient(
      actor,
      form({ firstName: 'Marco', lastName: 'Caduff', dateOfBirth: '08.06.1972', email: 'm@example.ch' }),
    );
    const s = await startSigning(actor, p.id);
    const { delivery } = await completeSigning(actor, s.id, signInput(false));
    expect(delivery.status).toBe('SKIPPED_NO_CONSENT');
    await deliverEmail(delivery.id, { retryDelayMs: 1 });
    expect(sent).toHaveLength(0);
  });

  it('marks a failed delivery after 3 attempts and can resend', async () => {
    let calls = 0;
    setMailer({
      send: async () => {
        calls++;
        throw new Error('Graph 503');
      },
    });
    const p = await createPatient(
      actor,
      form({ firstName: 'Laura', lastName: 'Bianchi', dateOfBirth: '14.09.1988', email: 'laura@example.ch' }),
    );
    const s = await startSigning(actor, p.id);
    const { document, delivery } = await completeSigning(actor, s.id, signInput(true));
    const failed = await deliverEmail(delivery.id, { retryDelayMs: 1 });
    expect(calls).toBe(3);
    expect(failed?.status).toBe('FAILED');
    expect(failed?.attempts).toBe(3);
    setMailer({ send: async () => {} });
    const again = await requestResend(actor, document.id);
    expect((await deliverEmail(again.id, { retryDelayMs: 1 }))?.status).toBe('SENT');
  });

  it('a new text version marks earlier signatures for re-signing (task 6.2)', async () => {
    const before = await dashboardData();
    expect(before.pending.some((p) => p.lastName === 'Thompson')).toBe(false);
    await publishVersion(actor, { titleDe: 'T', bodyDe: '## A\nText', titleEn: 'T', bodyEn: '## A\nText' });
    const after = await dashboardData();
    expect(after.pending.find((p) => p.lastName === 'Thompson')?.consent).toBe('resign');
  });
});
