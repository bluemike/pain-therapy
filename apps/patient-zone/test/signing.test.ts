import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { internalToken } from '@pain-therapy/shared/internal-auth';
import { confirmLink, lookupLink, programSession, resolveSession, type ZoneSession } from '@/lib/access';
import { config } from '@/lib/config';
import { openForm, personalDetails, requestFinalize, submitSignature } from '@/lib/signing';
import { admin, ago, consultation, DOB, link, now, patient, resetDatabase } from './fixtures';

/**
 * zone-consent-signing and the zone part of zone-consent-invitation, run with the role patient_zone (iteration 5,
 * tasks 2.1, 3.1, 3.3 and 4.4).
 */

beforeEach(resetDatabase);
afterAll(() => admin.$disconnect());

async function publish(version: number) {
  await admin.consentTextVersion.createMany({
    data: (['de', 'en'] as const).map((language) => ({
      version,
      language,
      title: `Titel ${version} ${language}`,
      body: `## Haftungsausschluss\nText ${version}`,
      publishedBy: 'Test',
    })),
  });
}

const strokes = [
  [
    [10, 10, 0.5],
    [40, 30, 0.5],
    [80, 20, 0.5],
  ],
];
const payload = (x: Record<string, unknown> = {}) => ({
  note: '',
  readToEnd: true,
  liability: true,
  dataProcessing: true,
  unencryptedEmail: false,
  strokes,
  width: 340,
  height: 180,
  ...x,
});

/** A new patient without consultation, invited with a link, signed in on her phone */
async function invited(opts: { withProgram?: boolean } = {}) {
  const p = await patient();
  if (opts.withProgram) await consultation(p.id, ago(2), [['2A', 'DAILY_2']]);
  const l = await link(p.id);
  const r = await confirmLink({ token: l.token, ...DOB, ip: '203.0.113.20' }, now);
  if (!r.ok) throw new Error(`not signed in: ${r.error}`);
  return { patient: p, ...l, sessionId: r.sessionId, zone: (await resolveSession(r.sessionId, now)) as ZoneSession };
}

describe('link valid while a signature is pending (Gültigkeit des Links bei ausstehender Unterschrift)', () => {
  it('opens the zone for a new patient without home program, with only the task to sign', async () => {
    await publish(1);
    const { zone, token } = await invited();
    expect((await lookupLink(token, now))?.state).toBe('valid');
    expect(zone.signaturePending).toBe(true);
    expect(zone.program).toBeNull();
    // Unterschrift vor den Übungen: no home program, entries or images
    expect(programSession(zone)).toBeNull();
  });

  it('without consent text and without home program the link stays invalid as before', async () => {
    const p = await patient();
    const { token } = await link(p.id);
    expect((await lookupLink(token, now))?.state).toBe('expired');
  });

  it('ends the link and the device session after the signature when there is no home program', async () => {
    await publish(1);
    const { zone, token, sessionId } = await invited();
    const form = await openForm(zone, now);
    expect(await submitSignature(zone, form!.sid, payload(), now)).toEqual({ ok: true });
    expect(await resolveSession(sessionId, now)).toBeNull();
    expect((await lookupLink(token, now))?.state).toBe('expired');
  });

  it('shows the exercises again after signing a new text version with a running home program', async () => {
    await publish(1);
    const { zone, sessionId } = await invited({ withProgram: true });
    expect(programSession(zone)).toBeNull();
    const form = await openForm(zone, now);
    await submitSignature(zone, form!.sid, payload(), now);
    const after = await resolveSession(sessionId, now);
    expect(after?.signaturePending).toBe(false);
    expect(programSession(after)?.program.prescriptions.map((x) => x.exerciseCode)).toEqual(['2A']);
  });
});

describe('the form in the patient zone (Inhalt des Formulars)', () => {
  it('reads the personal details for checking and the text in the patient language', async () => {
    await publish(1);
    const { zone } = await invited();
    const d = await personalDetails(zone);
    expect(d).toMatchObject({ firstName: 'Anna', email: 'anna@example.ch' });
    const form = await openForm(zone, now);
    expect(form?.text).toMatchObject({ version: 1, language: 'de', title: 'Titel 1 de' });
  });

  it('opens one session per device and reuses it (Sitzung des Formulars)', async () => {
    await publish(1);
    const { zone, patient: p } = await invited();
    const a = await openForm(zone, now);
    const b = await openForm(zone, now);
    expect(b?.sid).toBe(a?.sid);
    const rows = await admin.signatureSession.findMany({ where: { patientId: p.id } });
    expect(rows).toMatchObject([{ channel: 'PATIENT_ZONE', status: 'OPEN', zoneSessionId: zone.session.id }]);
    expect(await admin.auditEvent.count({ where: { action: 'signing.formOpened', patientId: p.id } })).toBe(1);
  });

  it('refuses a session of an older text and opens the new version (Version während des Lesens geändert)', async () => {
    await publish(1);
    const { zone } = await invited();
    const old = await openForm(zone, now);
    await publish(2);
    expect(await submitSignature(zone, old!.sid, payload(), now)).toEqual({ ok: false, error: 'outdated' });
    const fresh = await openForm(zone, now);
    expect(fresh?.sid).not.toBe(old?.sid);
    expect(fresh?.text.version).toBe(2);
    expect((await admin.signatureSession.findUniqueOrThrow({ where: { id: old!.sid } })).status).toBe('ABORTED');
    expect(await submitSignature(zone, fresh!.sid, payload(), now)).toEqual({ ok: true });
  });
});

describe('completing the signature (Abschluss in der Patienten-Zone)', () => {
  it('stores signature, consents, remark, place, time and channel', async () => {
    await publish(1);
    const { zone, patient: p } = await invited();
    const form = await openForm(zone, now);
    const r = await submitSignature(
      zone,
      form!.sid,
      payload({ note: 'Neue Mobile-Nummer 079 765 43 21', unencryptedEmail: true }),
      now,
    );
    expect(r).toEqual({ ok: true });
    const s = await admin.signatureSession.findUniqueOrThrow({ where: { id: form!.sid }, include: { consents: true } });
    expect(s).toMatchObject({
      status: 'SIGNED',
      channel: 'PATIENT_ZONE',
      completedAt: now,
      place: 'Online (Patienten-Zone)',
      patientNote: 'Neue Mobile-Nummer 079 765 43 21',
    });
    expect(s.signatureSvg).toMatch(/^<svg /);
    expect(s.consents.map((c) => [c.kind, c.granted]).sort()).toEqual([
      ['DATA_PROCESSING', true],
      ['LIABILITY_WAIVER', true],
      ['UNENCRYPTED_EMAIL', true],
    ]);
    const event = await admin.auditEvent.findFirstOrThrow({ where: { action: 'signing.completed', patientId: p.id } });
    expect(event).toMatchObject({ userName: 'Patienten-Zone', details: { channel: 'PATIENT_ZONE', version: 1 } });
    // The zone creates no document (PDF, Archiv und Zustellung: only the practice app)
    expect(await admin.signedDocument.count()).toBe(0);
  });

  it('stores exactly one signature when submitted twice (Doppelt abgeschickt)', async () => {
    await publish(1);
    const { zone, patient: p } = await invited();
    const form = await openForm(zone, now);
    const results = await Promise.all([
      submitSignature(zone, form!.sid, payload(), now),
      submitSignature(zone, form!.sid, payload(), now),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    expect(await admin.signatureSession.count({ where: { patientId: p.id, status: 'SIGNED' } })).toBe(1);
    expect(await admin.consent.count()).toBe(3);
    expect(await admin.auditEvent.count({ where: { action: 'signing.completed' } })).toBe(1);
  });

  it('refuses a missing consent to data processing and an empty signature', async () => {
    await publish(1);
    const { zone } = await invited();
    const form = await openForm(zone, now);
    expect(await submitSignature(zone, form!.sid, payload({ dataProcessing: false }), now)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await submitSignature(zone, form!.sid, payload({ strokes: [] }), now)).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await submitSignature(zone, form!.sid, payload({ note: 'x'.repeat(501) }), now)).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('writes only for the patient of the device session', async () => {
    await publish(1);
    const a = await invited();
    const b = await invited();
    const formOfB = await openForm(b.zone, now);
    expect(await submitSignature(a.zone, formOfB!.sid, payload(), now)).toEqual({ ok: false, error: 'notFound' });
    expect((await admin.signatureSession.findUniqueOrThrow({ where: { id: formOfB!.sid } })).status).toBe('OPEN');
  });
});

describe('asking the practice app for the PDF (design D7)', () => {
  it('calls the internal route with the HMAC of the session id', async () => {
    const calls: { url?: string; auth?: string }[] = [];
    const server = createServer((req, res) => {
      calls.push({ url: req.url, auth: req.headers.authorization });
      res.end('{}');
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const before = { url: config.practiceInternalUrl, secret: config.internalSecret };
    config.practiceInternalUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    config.internalSecret = 'test-internal-secret';
    try {
      await requestFinalize('sid-1');
    } finally {
      Object.assign(config, { practiceInternalUrl: before.url, internalSecret: before.secret });
      server.close();
    }
    expect(calls).toEqual([
      {
        url: '/api/internal/signatures/sid-1/finalize',
        auth: `Bearer ${internalToken('sid-1', 'test-internal-secret')}`,
      },
    ]);
  });

  it('only logs when the practice app is not reachable', async () => {
    const before = config.practiceInternalUrl;
    config.practiceInternalUrl = 'http://127.0.0.1:9';
    try {
      await expect(requestFinalize('sid-2')).resolves.toBeUndefined();
    } finally {
      config.practiceInternalUrl = before;
    }
  });
});
