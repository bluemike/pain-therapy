import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { adherence } from '@pain-therapy/shared/adherence';
import { db } from '@/lib/db';
import { confirmLink, resolveSession, type ZoneSession } from '@/lib/access';
import {
  correctEntry,
  createEntry,
  deleteEntry,
  mainImageOf,
  parseEntryForm,
  quickEntry,
  recentEntries,
  today,
} from '@/lib/entries';
import { admin, ago, consultation, DOB, now, resetDatabase, setup } from './fixtures';

/** exercise-log in the patient zone, run with the role patient_zone (iteration 4, tasks 5.1 to 5.4, 8.1, 8.2) */

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/session', () => ({ getZoneSession: async () => session.current }));

beforeEach(resetDatabase);
afterAll(() => admin.$disconnect());

async function signedIn(opts: { language?: 'de' | 'en' } = {}) {
  const s = await setup(opts);
  const r = await confirmLink({ token: s.token, ...DOB, ip: '203.0.113.9' }, ago(0, 3));
  if (!r.ok) throw new Error('not signed in');
  return { ...s, zone: (await resolveSession(r.sessionId, now))! };
}

const form = (x: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({
    code: '2A',
    done: 'yes',
    rating: '7',
    date: '2026-10-14',
    time: '11:30',
    note: '',
    ...x,
  }))
    fd.set(k, v);
  return parseEntryForm(fd);
};
const input = (x: Record<string, string> = {}) => {
  const r = form(x);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe('today (Heimprogramm in der Patienten-Zone)', () => {
  it('shows "heute 1 von 2" and "diese Woche 0 von 5" (Übungen von heute)', async () => {
    const { zone } = await signedIn();
    expect(await createEntry(zone, input({ time: '09:00' }), now)).toBeNull();
    const { items } = await today(zone, now);
    expect(items.map((i) => [i.code, i.progress.period, i.progress.done, i.progress.target])).toEqual([
      ['2A', 'today', 1, 2],
      ['2D', 'week', 0, 5],
      ['1F', 'today', 0, 1],
    ]);
    expect(items[0]).toMatchObject({ name: 'Übung 2A', seconds: 240, hasImage: true });
  });

  it('uses the language of the patient (Englisch)', async () => {
    const { zone } = await signedIn({ language: 'en' });
    expect((await today(zone, now)).items[0].name).toBe('Exercise 2A');
  });

  it('shows only the newest prescription; earlier entries stay with theirs (Neue Verordnung)', async () => {
    const { zone, patient: p, consultation: c } = await signedIn();
    await createEntry(zone, input({ time: '09:00' }), now);
    const newer = await consultation(p.id, ago(0, 2), [['4B', 'DAILY_1']]);
    const z = (await resolveSession(undefined, now)) ?? (await refreshed(zone));
    expect(z.program.consultationId).toBe(newer.id);
    expect((await today(z, now)).items.map((i) => i.code)).toEqual(['4B']);
    expect(await admin.exerciseLogEntry.count({ where: { consultationId: c.id } })).toBe(1);
    expect(await createEntry(z, input({ code: '2A', time: '09:30' }), now)).toBe('error');
  });
});

/** The session of `zone` loaded again, e.g. after a new prescription */
async function refreshed(zone: ZoneSession) {
  const s = await db.patientZoneSession.findUniqueOrThrow({ where: { id: zone.session.id }, select: { idHash: true } });
  const { currentProgram } = await import('@pain-therapy/shared/program');
  return { ...zone, program: (await currentProgram(db, zone.patient.id, now))!, idHash: s.idHash };
}

describe('recording an execution (Ausführung erfassen)', () => {
  it('stores done with rating 7 at the chosen time (Übung gemacht)', async () => {
    const { zone, link: l } = await signedIn();
    expect(await createEntry(zone, input(), now)).toBeNull();
    const e = await admin.exerciseLogEntry.findFirstOrThrow();
    expect(e).toMatchObject({ exerciseCode: '2A', done: true, rating: 7, quick: false, sessionId: zone.session.id });
    expect(e.performedAt.toISOString()).toBe('2026-10-14T09:30:00.000Z');
    // Zugriff protokolliert: patient, link and time
    const ev = await admin.auditEvent.findFirstOrThrow({ where: { action: 'exerciseLog.created' } });
    expect(ev).toMatchObject({
      userId: 'patient-zone',
      patientId: zone.patient.id,
      after: '14.10.2026 11:30 · ✓ · 7/10',
    });
    expect(ev.details).toMatchObject({ linkId: l.id, exerciseCode: '2A' });
  });

  it('stores "nicht gemacht" without rating, even when a rating was chosen before (Übung nicht gemacht)', async () => {
    const { zone } = await signedIn();
    expect(await createEntry(zone, input({ done: 'no', rating: '4', note: 'Keine Zeit' }), now)).toBeNull();
    expect(await admin.exerciseLogEntry.findFirstOrThrow()).toMatchObject({
      done: false,
      rating: null,
      note: 'Keine Zeit',
    });
  });

  it('rejects a rating of 11, also in the database (Bewertung ausserhalb der Skala)', async () => {
    const { zone, consultation: c, patient: p } = await signedIn();
    expect(form({ rating: '11' })).toEqual({ ok: false, error: 'ratingRange' });
    expect(form({ rating: '' })).toEqual({ ok: false, error: 'ratingRequired' });
    expect(form({ note: 'x'.repeat(501) })).toEqual({ ok: false, error: 'noteTooLong' });
    const row = {
      patientId: p.id,
      consultationId: c.id,
      exerciseCode: '2A',
      performedAt: now,
      sessionId: zone.session.id,
    };
    await expect(db.exerciseLogEntry.create({ data: { ...row, done: true, rating: 11 } })).rejects.toThrow(
      /rating_check/,
    );
    await expect(db.exerciseLogEntry.create({ data: { ...row, done: false, rating: 3 } })).rejects.toThrow(
      /rating_done_check/,
    );
    await expect(db.exerciseLogEntry.create({ data: { ...row, done: true, note: 'x'.repeat(501) } })).rejects.toThrow(
      /note_check/,
    );
  });

  it('accepts yesterday 20:30 and rejects the future and times before the consultation', async () => {
    const { zone } = await signedIn();
    expect(await createEntry(zone, input({ date: '2026-10-13', time: '20:30' }), now)).toBeNull();
    expect((await admin.exerciseLogEntry.findFirstOrThrow()).performedAt.toISOString()).toBe(
      '2026-10-13T18:30:00.000Z',
    );
    expect(await createEntry(zone, input({ time: '12:01' }), now)).toBe('future');
    expect(await createEntry(zone, input({ date: '2026-10-03' }), now)).toBe('beforeConsultation');
    expect(await admin.exerciseLogEntry.count()).toBe(1);
  });
});

describe('quick entry (Schnelleintrag)', () => {
  it('fills the open executions of today for daily exercises (Alles erledigt)', async () => {
    const { zone } = await signedIn();
    await createEntry(zone, input({ time: '08:00' }), now);
    expect(await quickEntry(zone, now)).toBe(2);
    const rows = await admin.exerciseLogEntry.findMany({ where: { quick: true }, orderBy: { exerciseCode: 'asc' } });
    expect(rows.map((r) => [r.exerciseCode, r.done, r.rating])).toEqual([
      ['1F', true, null],
      ['2A', true, null],
    ]);
    expect(await quickEntry(zone, now)).toBe(0);
    // The rating can be added within 24 hours
    expect(
      await correctEntry(zone, rows[1].id, input({ rating: '6', time: '11:00' }), new Date(now.getTime() + 3600_000)),
    ).toBeNull();
    expect((await admin.exerciseLogEntry.findUniqueOrThrow({ where: { id: rows[1].id } })).rating).toBe(6);
  });
});

describe('last 14 days and corrections (Letzte 14 Tage und Korrektur)', () => {
  it('corrects an entry of 2 hours ago with before and after in the log (Korrektur innerhalb von 24 Stunden)', async () => {
    const { zone } = await signedIn();
    await createEntry(zone, input({ time: '09:00' }), ago(0, 2));
    const e = await admin.exerciseLogEntry.findFirstOrThrow();
    expect(await correctEntry(zone, e.id, input({ time: '09:00', rating: '5' }), now)).toBeNull();
    expect(await admin.exerciseLogEntry.findUniqueOrThrow({ where: { id: e.id } })).toMatchObject({
      rating: 5,
      correctedAt: now,
    });
    const ev = await admin.auditEvent.findFirstOrThrow({ where: { action: 'exerciseLog.corrected' } });
    expect([ev.before, ev.after]).toEqual(['14.10.2026 09:00 · ✓ · 7/10', '14.10.2026 09:00 · ✓ · 5/10']);
    const recent = await recentEntries(zone, now);
    expect(recent.map((r) => [r.exerciseCode, r.rating, r.editable])).toEqual([['2A', 5, true]]);
  });

  it('offers no change or delete after 24 hours (Nach 24 Stunden)', async () => {
    const { zone } = await signedIn();
    await createEntry(zone, input({ date: '2026-10-13', time: '09:00' }), ago(1, 1));
    const e = await admin.exerciseLogEntry.findFirstOrThrow();
    expect((await recentEntries(zone, now))[0].editable).toBe(false);
    expect(await correctEntry(zone, e.id, input({ date: '2026-10-13', time: '09:00', rating: '2' }), now)).toBe(
      'notEditable',
    );
    expect(await deleteEntry(zone, e.id, now)).toBe('notEditable');
  });

  it('deleting marks the entry; it leaves the list and the adherence but stays (Eintrag löschen)', async () => {
    const { zone, consultation: c } = await signedIn();
    await createEntry(zone, input({ time: '09:00' }), now);
    const e = await admin.exerciseLogEntry.findFirstOrThrow();
    expect(await deleteEntry(zone, e.id, now)).toBeNull();
    expect(await recentEntries(zone, now)).toEqual([]);
    const row = await admin.exerciseLogEntry.findUniqueOrThrow({ where: { id: e.id } });
    expect(row.deletedAt).toEqual(now);
    const a = adherence([{ exerciseCode: '2A', repetition: 'DAILY_2' }], [row], c.at, now);
    expect(a.total.done).toBe(0);
    expect(await admin.auditEvent.count({ where: { action: 'exerciseLog.deleted' } })).toBe(1);
  });

  it('never touches entries of another patient', async () => {
    const { zone } = await signedIn();
    const other = await signedIn();
    await createEntry(other.zone, input({ time: '09:00' }), now);
    const e = await admin.exerciseLogEntry.findFirstOrThrow();
    expect(await correctEntry(zone, e.id, input({ time: '09:00', rating: '1' }), now)).toBe('notEditable');
    expect(await deleteEntry(zone, e.id, now)).toBe('notEditable');
    expect(await recentEntries(zone, now)).toEqual([]);
  });
});

describe('exercise images (Nur das eigene Heimprogramm)', () => {
  it('delivers the image only with a session and only for exercises of the program', async () => {
    const { zone } = await signedIn();
    const dir = process.env.STORAGE_EXERCISE_LOCAL_DIR!;
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, '2A.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    await writeFile(path.join(dir, '4B.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    expect(await mainImageOf(zone, '2A')).toBe('2A.jpg');
    expect(await mainImageOf(zone, '4B')).toBeNull();

    const { GET } = await import('@/app/media/[code]/route');
    const get = (code: string) => GET(new Request(`http://zone/media/${code}`), { params: Promise.resolve({ code }) });
    session.current = null;
    expect((await get('2A')).status).toBe(404); // Bild ohne Sitzung
    session.current = zone;
    const ok = await get('2A');
    expect(ok.status).toBe(200);
    expect(ok.headers.get('content-type')).toBe('image/jpeg');
    expect((await get('4B')).status).toBe(404); // Fremde Übung
    expect((await get('../x')).status).toBe(404);
  });
});
