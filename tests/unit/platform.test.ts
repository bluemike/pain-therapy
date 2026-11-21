import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { runInPractice } from '@pain-therapy/shared/practice-context';
import { rawDb } from '@/lib/db';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import { inviteMember, resetMember, setMemberActive, setMemberRoles, teamOf } from '@/lib/team';
import {
  createPractice,
  deletePractice,
  ensurePlatformAdmin,
  practiceDetailsOf,
  practiceDetailsSchema,
  practicesOverview,
  removeDueBlobs,
  setPracticeStatus,
  updatePracticeDetails,
} from '@/lib/platform';
import { buildExport, exportFile, requestExport } from '@/lib/practice-export';
import { photoStore } from '@/lib/storage';
import type { Actor } from '@/lib/session';
import { resetDatabase } from './db-reset';
import { TEST_PRACTICE_ID } from './test-practice';

/** Iteration 12, phase 5: team (design D3, D4), platform, export and deletion of a practice (design D9) */

const sent: OutgoingMail[] = [];
const platform: Actor = { id: 'u-platform', name: 'Plattform', email: 'admin@example.test', roles: [] };

async function member(email: string, roles: ('PRACTICE_ADMIN' | 'THERAPIST')[], practiceId = TEST_PRACTICE_ID) {
  const u = await rawDb.user.create({ data: { email, name: email.split('@')[0]!, activatedAt: new Date() } });
  await rawDb.practiceMembership.create({ data: { userId: u.id, practiceId, roles } });
  return { id: u.id, name: u.name, email, roles: ['ADMIN' as const] } satisfies Actor;
}

beforeAll(resetDatabase);
afterAll(resetDatabase);
beforeEach(() => {
  sent.length = 0;
  setMailer({ send: async (m) => void sent.push(m) });
});

describe('team of a practice (team-management)', () => {
  it('invites with name and roles, refuses members and people of other practices', async () => {
    const admin = await member('chef@example.test', ['PRACTICE_ADMIN', 'THERAPIST']);
    await inviteMember(admin, TEST_PRACTICE_ID, { email: 'Neu@Example.test', name: 'Nora Neu', roles: ['THERAPIST'] });
    expect(sent.at(-1)).toMatchObject({ to: 'neu@example.test', subject: 'Einladung von Pain Therapy Test' });
    const team = await teamOf(TEST_PRACTICE_ID);
    expect(team.invitations).toMatchObject([{ email: 'neu@example.test', name: 'Nora Neu', roles: ['THERAPIST'] }]);
    await expect(
      inviteMember(admin, TEST_PRACTICE_ID, { email: 'chef@example.test', name: 'x', roles: ['THERAPIST'] }),
    ).rejects.toMatchObject({ code: 'member' });
  });

  it('keeps at least one active practice admin and never acts on oneself', async () => {
    const admin = await rawDb.user.findUniqueOrThrow({ where: { email: 'chef@example.test' } });
    const actor: Actor = { id: admin.id, name: admin.name, email: admin.email, roles: ['ADMIN'] };
    await expect(setMemberRoles(actor, TEST_PRACTICE_ID, admin.id, ['THERAPIST'])).rejects.toMatchObject({
      code: 'lastAdmin',
    });
    await expect(setMemberActive(actor, TEST_PRACTICE_ID, admin.id, false)).rejects.toMatchObject({ code: 'self' });
    const other = await member('zweite@example.test', ['THERAPIST']);
    await setMemberRoles(actor, TEST_PRACTICE_ID, other.id, ['PRACTICE_ADMIN']);
    // Now there is a second admin, so the first may give up the role
    await setMemberRoles(actor, TEST_PRACTICE_ID, admin.id, ['THERAPIST']);
    await expect(setMemberActive(actor, TEST_PRACTICE_ID, other.id, false)).rejects.toMatchObject({
      code: 'lastAdmin',
    });
    await setMemberRoles(actor, TEST_PRACTICE_ID, admin.id, ['PRACTICE_ADMIN', 'THERAPIST']);
    await setMemberActive(actor, TEST_PRACTICE_ID, other.id, false);
    const u = await rawDb.user.findUniqueOrThrow({ where: { id: other.id } });
    expect(u.signedOutAt).not.toBeNull();
    await setMemberActive(actor, TEST_PRACTICE_ID, other.id, true);
    await resetMember(actor, TEST_PRACTICE_ID, other.id);
    expect((await rawDb.user.findUniqueOrThrow({ where: { id: other.id } })).activatedAt).toBeNull();
    expect(sent.at(-1)?.to).toBe('zweite@example.test');
    const audit = await rawDb.auditEvent.findMany({
      where: { action: { startsWith: 'team.' } },
      select: { action: true },
    });
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'team.invited',
        'team.rolesChanged',
        'team.deactivated',
        'team.reactivated',
        'team.signInReset',
      ]),
    );
  });
});

describe('platform (platform-admin)', () => {
  let practiceId = '';

  it('invites the platform account once while none exists (task 5.0)', async () => {
    expect(await ensurePlatformAdmin('admin@example.test')).toEqual({ invited: true });
    expect(await ensurePlatformAdmin('admin@example.test')).toEqual({ invited: false });
    expect(sent.filter((m) => m.to === 'admin@example.test')).toHaveLength(1);
    // Iteration 13: own wording, not «bei der Plattform mit Pain Therapy zu arbeiten»
    const mail = sent.find((m) => m.to === 'admin@example.test')!;
    expect(mail.subject).toBe('Einladung als Plattform-Admin von Pain Therapy Online');
    expect(mail.text).toContain('als Plattform-Admin von Pain Therapy Online eingeladen');
    expect(mail.text).not.toMatch(/bei der Plattform|Pain Therapy\b(?! Online)/);
  });

  it('creates a practice with its disclaimer and invites its admin; a slug is given once', async () => {
    const p = await createPractice(platform, {
      name: 'Physio Muster',
      slug: 'physio-muster',
      street: 'Bahnhofstrasse 10',
      zip: '7000',
      city: 'Chur',
      contactEmail: 'praxis@muster.test',
      documentPrefix: 'PM',
      adminName: 'Anna Muster',
      adminEmail: 'anna@muster.test',
    });
    practiceId = p.id;
    expect(p).toMatchObject({ addressLine: 'Physio Muster | Bahnhofstrasse 10 | 7000 Chur', defaultPlace: 'Chur' });
    expect(await rawDb.consentTextVersion.count({ where: { practiceId: p.id, version: 1 } })).toBe(2);
    const inv = await rawDb.invitation.findFirstOrThrow({ where: { practiceId: p.id } });
    expect(inv).toMatchObject({
      email: 'anna@muster.test',
      name: 'Anna Muster',
      roles: ['PRACTICE_ADMIN', 'THERAPIST'],
    });
    expect(sent.at(-1)?.text).toContain('bei Physio Muster');
    await expect(
      createPractice(platform, {
        name: 'X',
        slug: 'physio-muster',
        street: '',
        zip: '',
        city: 'Chur',
        contactEmail: 'x@x.test',
        documentPrefix: 'XX',
        adminName: 'X',
        adminEmail: 'x@x.test',
      }),
    ).rejects.toMatchObject({ code: 'slugTaken' });
    const overview = await practicesOverview();
    expect(overview.find((x) => x.id === p.id)).toMatchObject({ members: 0, openInvitations: ['anna@muster.test'] });
  });

  it('lets the platform correct the details of a practice and invite its admin in the same step (iteration 13)', async () => {
    const values = {
      ...(await practiceDetailsOf(practiceId))!,
      city: 'Falera',
      defaultPlace: 'Falera',
      phone: '081 000 00 00',
      adminName: '',
      adminEmail: '',
    };
    // Admin name and e-mail only together
    expect(practiceDetailsSchema.safeParse({ ...values, adminName: 'Nur Name' }).success).toBe(false);
    const before = sent.length;
    expect(await updatePracticeDetails(platform, practiceId, practiceDetailsSchema.parse(values))).toEqual({
      invited: false,
    });
    expect(sent.length).toBe(before);
    expect(await rawDb.practice.findUniqueOrThrow({ where: { id: practiceId } })).toMatchObject({
      city: 'Falera',
      defaultPlace: 'Falera',
      phone: '081 000 00 00',
      addressLine: 'Physio Muster | Bahnhofstrasse 10 | 7000 Falera',
    });
    const r = await updatePracticeDetails(
      platform,
      practiceId,
      practiceDetailsSchema.parse({ ...values, adminName: 'Bea Muster', adminEmail: 'Bea@Muster.test' }),
    );
    expect(r).toEqual({ invited: true });
    // From the practice, practice name in bold, the link in the HTML part
    expect(sent.at(-1)).toMatchObject({
      to: 'bea@muster.test',
      subject: 'Einladung von Physio Muster',
      fromName: 'Physio Muster',
      replyTo: 'praxis@muster.test',
      bold: ['Physio Muster'],
    });
    expect(sent.at(-1)!.text).toMatch(/^Guten Tag Bea Muster\n/);
    const log = await runInPractice(practiceId, () =>
      rawDb.auditEvent.findMany({ where: { practiceId, action: 'practice.updated' } }),
    );
    expect(log).toHaveLength(1);
    // The platform account or a member of another practice cannot be invited
    await rawDb.user.create({ data: { email: 'plattform@example.test', name: 'P', platformAdmin: true } });
    await expect(
      updatePracticeDetails(
        platform,
        practiceId,
        practiceDetailsSchema.parse({ ...values, adminName: 'X', adminEmail: 'plattform@example.test' }),
      ),
    ).rejects.toMatchObject({ code: 'otherPractice' });
    await member('fremd@example.test', ['PRACTICE_ADMIN']);
    await expect(
      updatePracticeDetails(
        platform,
        practiceId,
        practiceDetailsSchema.parse({ ...values, city: 'Ilanz', adminName: 'X', adminEmail: 'fremd@example.test' }),
      ),
    ).rejects.toMatchObject({ code: 'otherPractice' });
    expect((await rawDb.practice.findUniqueOrThrow({ where: { id: practiceId } })).city).toBe('Falera');
  });

  it('suspends a practice: its zone links resolve to no practice', async () => {
    const patient = await rawDb.patient.create({
      data: {
        practiceId,
        firstName: 'Paula',
        lastName: 'Muster',
        dateOfBirth: new Date('1980-01-01'),
        createdBy: 't',
        updatedBy: 't',
      },
    });
    await rawDb.patientAccessLink.create({
      data: {
        practiceId,
        patientId: patient.id,
        tokenHash: 'h-muster',
        createdBy: 't',
        expiresAt: new Date(Date.now() + 1e9),
      },
    });
    const of = async () =>
      (await rawDb.$queryRaw<{ p: string | null }[]>`SELECT zone_practice_of_link('h-muster') AS p`)[0]!.p;
    expect(await of()).toBe(practiceId);
    await setPracticeStatus(platform, practiceId, 'SUSPENDED');
    expect(await of()).toBeNull();
  });

  it('exports all data as ZIP without hashes, for that practice only', async () => {
    const row = await requestExport(platform, practiceId);
    const done = await buildExport(row.id);
    expect(done).toMatchObject({ status: 'DONE' });
    const file = await exportFile(row.id, practiceId);
    expect(file?.name).toMatch(/^physio-muster-export-\d{4}-\d{2}-\d{2}\.zip$/);
    const zip = unzipSync(new Uint8Array(file!.data));
    const patients = JSON.parse(strFromU8(zip['data/Patient.json']!)) as { lastName: string }[];
    expect(patients.map((p) => p.lastName)).toEqual(['Muster']);
    expect(strFromU8(zip['data/PatientAccessLink.json']!)).not.toContain('h-muster');
    expect(Object.keys(zip)).toEqual(
      expect.arrayContaining(['practice.json', 'data/ConsentTextVersion.json', 'LIESMICH.txt']),
    );
    // Another practice's admin gets nothing
    expect(await exportFile(row.id, TEST_PRACTICE_ID)).toBeNull();
  });

  it('deletes a suspended practice after its export and confirmation; the other practice keeps everything', async () => {
    const own = await rawDb.patient.create({
      data: {
        practiceId: TEST_PRACTICE_ID,
        firstName: 'Bleibt',
        lastName: 'Hier',
        dateOfBirth: new Date('1970-01-01'),
        createdBy: 't',
        updatedBy: 't',
      },
    });
    await expect(deletePractice(platform, practiceId, 'falsch')).rejects.toMatchObject({ code: 'confirm' });
    await deletePractice(platform, practiceId, 'physio-muster');
    for (const t of ['Patient', 'PatientAccessLink', 'ConsentTextVersion', 'Invitation'] as const) {
      const rows = await rawDb.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*) AS n FROM "${t}" WHERE "practiceId" = $1`,
        practiceId,
      );
      expect(Number(rows[0]!.n), t).toBe(0);
    }
    const tomb = await rawDb.practice.findUniqueOrThrow({ where: { id: practiceId } });
    expect(tomb.deletedAt).not.toBeNull();
    const log = await runInPractice(practiceId, () => rawDb.auditEvent.findMany({ where: { practiceId } }));
    expect(log.map((e) => e.action)).toEqual(['practice.deleted']);
    // The protection of the other practice is back on
    expect(await rawDb.patient.findUnique({ where: { id: own.id } })).not.toBeNull();
    await expect(rawDb.patient.delete({ where: { id: own.id } })).rejects.toThrow(/cannot be deleted/);
    await expect(deletePractice(platform, practiceId, 'physio-muster')).rejects.toMatchObject({ code: 'deleted' });
  });

  it('needs an export before deleting, and removes listed files once due', async () => {
    const p = await createPractice(platform, {
      name: 'Ohne Export',
      slug: 'ohne-export',
      street: '',
      zip: '',
      city: 'Chur',
      contactEmail: 'o@o.test',
      documentPrefix: 'OE',
      adminName: 'O',
      adminEmail: 'o@o.test',
    });
    await expect(deletePractice(platform, p.id, 'ohne-export')).rejects.toMatchObject({ code: 'notSuspended' });
    await setPracticeStatus(platform, p.id, 'SUSPENDED');
    await expect(deletePractice(platform, p.id, 'ohne-export')).rejects.toMatchObject({ code: 'noExport' });

    await photoStore().put(`${p.id}/x/1.jpg`, Buffer.from('jpg'), 'image/jpeg');
    await rawDb.pendingBlobDeletion.create({
      data: {
        practiceId: p.id,
        container: 'photos',
        path: `${p.id}/x/1.jpg`,
        deleteAfter: new Date(Date.now() - 1000),
      },
    });
    expect(await removeDueBlobs()).toEqual({ due: 1, removed: 1 });
    await expect(photoStore().get(`${p.id}/x/1.jpg`)).rejects.toThrow();
  });
});
