import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rawDb } from '@/lib/db';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import { formatMobile, maskMobile, normalizeMobile } from '@/lib/phone';
import { suggestLocalPart, validLocalPart } from '@/lib/mailbox-address';
import { mailProfile } from '@/lib/mail-profile';
import { imapQuote, setMailService, type MailService } from '@/lib/infomaniak';
import { setSmsSender } from '@/lib/sms';
import { inviteMember, teamOf } from '@/lib/team';
import { OnboardingError, parseInviteForm, type InviteForm } from '@/lib/onboarding';
import {
  checkAddress,
  handOverAccess,
  mailboxOf,
  requestNewAccess,
  revealAccess,
  sweepMailboxes,
  takeProfile,
} from '@/lib/mailboxes';
import { acceptInvitation, invitationById, userForInvitation } from '@/lib/auth/accounts';
import {
  confirmMobileChange,
  requestInvitationSmsCode,
  requestMobileChangeCode,
  ticketOf,
  verifyCode,
} from '@/lib/auth/login-codes';
import type { Actor } from '@/lib/session';
import { resetDatabase } from './db-reset';
import { TEST_PRACTICE_ID } from './test-practice';

/** Iteration 16: invitation by SMS, mailboxes at pain-therapy.online and the hand-over of their access */

const mails: OutgoingMail[] = [];
const sms: { to: string; text: string }[] = [];

/** In-memory Infomaniak: mailboxes and the device passwords the Manager would create */
class MemoryMail implements MailService {
  boxes = new Set(['admin', 'api', 'noreply', 'christina.franz']);
  devices = new Map<string, string>();
  down = false;
  async list() {
    if (this.down) throw new Error('down');
    return [...this.boxes];
  }
  async create(lp: string) {
    if (this.down) throw new Error('down');
    this.boxes.add(lp);
  }
  async remove(lp: string) {
    this.boxes.delete(lp);
  }
  async checkLogin(address: string, password: string) {
    return this.devices.get(address) === password;
  }
}
let infomaniak: MemoryMail;

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.set(k, v));
  return f;
};

async function admin(): Promise<Actor> {
  const u = await rawDb.user.upsert({
    where: { email: 'chef16@example.test' },
    create: { email: 'chef16@example.test', name: 'Chefin', activatedAt: new Date() },
    update: {},
  });
  await rawDb.practiceMembership.upsert({
    where: { userId_practiceId: { userId: u.id, practiceId: TEST_PRACTICE_ID } },
    create: { userId: u.id, practiceId: TEST_PRACTICE_ID, roles: ['PRACTICE_ADMIN', 'THERAPIST'] },
    update: {},
  });
  return { id: u.id, name: u.name, email: u.email, roles: ['ADMIN'] };
}

const tokenOf = (text: string) => /\/e\/([A-Za-z0-9_-]{43})/.exec(text)?.[1] ?? '';
const codeOf = (text: string) => /(\d{6})/.exec(text)?.[1] ?? '';

beforeAll(resetDatabase);
afterAll(async () => {
  setMailService(null);
  setSmsSender(null);
  await resetDatabase();
});
beforeEach(() => {
  mails.length = 0;
  sms.length = 0;
  setMailer({ send: async (m) => void mails.push(m) });
  setSmsSender({ send: async (to, text) => void sms.push({ to, text }) });
  infomaniak = new MemoryMail();
  setMailService(infomaniak);
});

describe('pure helpers', () => {
  it('normalizes, formats and masks mobile numbers (design D7)', () => {
    expect(normalizeMobile('079 123 45 67')).toBe('+41791234567');
    expect(normalizeMobile('0041 79 123 45 67')).toBe('+41791234567');
    expect(normalizeMobile('+41 (0)79')).toBeNull();
    expect(normalizeMobile('044 123 45 67')).toBeNull();
    expect(normalizeMobile('079 123')).toBeNull();
    expect(normalizeMobile('+49 151 23456789')).toBe('+4915123456789');
    expect(normalizeMobile('+1 202 555 0100')).toBeNull();
    expect(formatMobile('+41791234567')).toBe('+41 79 123 45 67');
    expect(maskMobile('+41791234567')).toBe('+41 79 *** ** 67');
  });

  it('suggests and checks addresses (design D3)', () => {
    expect(suggestLocalPart('Jürg Müller')).toBe('juerg.mueller');
    expect(suggestLocalPart("Zoë D'Arc-Lévy")).toBe('zoe.darc-levy');
    expect(suggestLocalPart('  Christina   Franz ')).toBe('christina.franz');
    expect(validLocalPart('juerg.mueller')).toBe(true);
    expect(validLocalPart('admin')).toBe(false);
    expect(validLocalPart('a..b')).toBe(false);
    expect(validLocalPart('.x')).toBe(false);
    expect(validLocalPart('Gross')).toBe(false);
  });

  it('builds an Apple Mail profile with escaped values (design D4)', () => {
    const xml = mailProfile({
      address: 'anna@pain-therapy.online',
      password: 'a<b>&"c',
      name: 'Anna',
      host: 'mail.infomaniak.com',
      imapPort: 993,
      smtpPort: 465,
      label: 'Pain Therapy',
      idPrefix: 'online.pain-therapy',
    });
    expect(xml).toContain('<string>com.apple.mail.managed</string>');
    expect(xml).toContain('<string>a&lt;b&gt;&amp;&quot;c</string>');
    expect(xml).toContain('<integer>993</integer>');
    expect(xml).not.toContain('a<b>');
  });

  it('quotes IMAP strings and refuses line breaks', () => {
    expect(imapQuote('a"b\\c')).toBe('"a\\"b\\\\c"');
    expect(imapQuote('a\r\nb')).toBeNull();
  });

  it('reads the invitation form: a new mailbox needs SMS, SMS needs a valid number', () => {
    expect(() =>
      parseInviteForm(fd({ name: 'A', channel: 'EMAIL', mailbox: 'NEW', localPart: 'a.b', mobile: '' })),
    ).toThrow(OnboardingError);
    expect(() =>
      parseInviteForm(fd({ name: 'A', channel: 'SMS', mailbox: 'NONE', email: 'a@b.ch', mobile: '079 1' })),
    ).toThrow(OnboardingError);
    expect(
      parseInviteForm(fd({ name: 'A', channel: 'SMS', mailbox: 'NEW', localPart: 'A.B', mobile: '079 123 45 67' })),
    ).toEqual({
      name: 'A',
      channel: 'SMS',
      mobile: '+41791234567',
      mailbox: { mode: 'NEW', localPart: 'a.b' },
      email: null,
    });
  });
});

describe('invitation by SMS with a new mailbox', () => {
  const form = (localPart: string): InviteForm => ({
    name: 'Jürg Müller',
    channel: 'SMS',
    mobile: '+41781234512',
    mailbox: { mode: 'NEW', localPart },
    email: null,
  });

  it('creates the mailbox, sends the link by SMS, confirms the SMS code and hands the access over once', async () => {
    const actor = await admin();
    const inv = await inviteMember(actor, TEST_PRACTICE_ID, form('juerg.mueller'), ['THERAPIST']);
    expect(infomaniak.boxes.has('juerg.mueller')).toBe(true);
    expect(mails).toHaveLength(0);
    expect(sms).toHaveLength(1);
    expect(sms[0]!.to).toBe('+41781234512');
    expect(sms[0]!.text).toContain('Jürg, Sie sind eingeladen');
    expect(sms[0]!.text.length).toBeLessThanOrEqual(160);
    const token = tokenOf(sms[0]!.text);
    expect(token).toHaveLength(43);

    const view = await invitationById(inv.id);
    expect(view).toMatchObject({ ok: true, email: 'juerg.mueller@pain-therapy.online', channel: 'SMS', mailbox: true });
    const team = await teamOf(TEST_PRACTICE_ID);
    expect(team.invitations[0]!.mailbox).toMatchObject({ status: 'CREATED', access: 'OPEN' });

    // Code by SMS, wrong code first
    expect(await requestInvitationSmsCode(inv.id, '10.0.0.1')).toEqual({ ok: true });
    const code = codeOf(sms.at(-1)!.text);
    expect(await verifyCode('juerg.mueller@pain-therapy.online', '000000', '10.0.0.1', 'INVITATION_SMS')).toMatchObject(
      { ok: false },
    );
    const v = await verifyCode('juerg.mueller@pain-therapy.online', code, '10.0.0.1', 'INVITATION_SMS');
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(await ticketOf(v.ticket, 'INVITATION')).not.toBeNull();
    const userId = await userForInvitation(inv.id);
    await acceptInvitation(inv.id, userId);
    const user = await rawDb.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.mobile).toBe('+41781234512');
    expect(await mailboxOf(userId)).toMatchObject({ access: 'OPEN' });

    // The platform admin hands over a device password; a wrong one is refused
    const row = await rawDb.mailboxProvisioning.findUniqueOrThrow({
      where: { address: 'juerg.mueller@pain-therapy.online' },
    });
    infomaniak.devices.set(row.address, 'Device-Password-1234');
    await expect(handOverAccess(row.id, 'falsch-falsch')).rejects.toMatchObject({ code: 'mailboxRejected' });
    sms.length = 0;
    await handOverAccess(row.id, 'Device-Password-1234');
    expect(sms[0]?.text).toContain('/postfach');
    const ready = await rawDb.mailboxProvisioning.findUniqueOrThrow({ where: { id: row.id } });
    expect(ready.access).toBe('READY');
    expect(ready.handoverEnc).not.toContain('Device-Password');

    // Shown once, with a one-time profile link only for this user
    const shown = await revealAccess(userId, 'Jürg Müller');
    expect(shown.password).toBe('Device-Password-1234');
    await expect(revealAccess(userId, 'Jürg Müller')).rejects.toMatchObject({ code: 'notFound' });
    const after = await rawDb.mailboxProvisioning.findUniqueOrThrow({ where: { id: row.id } });
    expect(after).toMatchObject({ access: 'DELIVERED', handoverEnc: null });
    const token2 = shown.profilePath.split('/').at(-1)!;
    expect(await takeProfile(token2, 'someone-else')).toBeNull();
    const profile = await takeProfile(token2, userId);
    expect(profile?.xml).toContain('Device-Password-1234');
    expect(await takeProfile(token2, userId)).toBeNull();

    // A new access can be asked for later
    await requestNewAccess(userId);
    expect(await mailboxOf(userId)).toMatchObject({ access: 'OPEN' });
    expect(await rawDb.smsMessage.count({ where: { toMasked: { contains: '***' } } })).toBeGreaterThan(0);
  });

  it('refuses a taken address with a suggestion and keeps to the quota of the practice', async () => {
    const actor = await admin();
    expect(await checkAddress('juerg.mueller')).toEqual({ free: false, suggestion: 'juerg.mueller2' });
    await expect(inviteMember(actor, TEST_PRACTICE_ID, form('juerg.mueller'), ['THERAPIST'])).rejects.toMatchObject({
      code: 'mailboxTaken',
    });
    await rawDb.practice.update({ where: { id: TEST_PRACTICE_ID }, data: { mailboxQuota: 1 } });
    await expect(inviteMember(actor, TEST_PRACTICE_ID, form('anna.neu'), ['THERAPIST'])).rejects.toMatchObject({
      code: 'mailboxQuota',
    });
    await rawDb.practice.update({ where: { id: TEST_PRACTICE_ID }, data: { mailboxQuota: 5 } });
  });

  it('keeps the invitation when Infomaniak fails and deletes the mailbox of an invitation never accepted', async () => {
    const actor = await admin();
    const inv = await inviteMember(actor, TEST_PRACTICE_ID, form('lea.offen'), ['THERAPIST']);
    expect(infomaniak.boxes.has('lea.offen')).toBe(true);
    await rawDb.invitation.update({ where: { id: inv.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await sweepMailboxes();
    expect(infomaniak.boxes.has('lea.offen')).toBe(false);
    expect(
      await rawDb.mailboxProvisioning.findUnique({ where: { address: 'lea.offen@pain-therapy.online' } }),
    ).toMatchObject({ status: 'DELETED' });

    // Listing works, creating fails
    const create = infomaniak.create;
    infomaniak.create = async () => {
      throw new Error('down');
    };
    const inv3 = await inviteMember(actor, TEST_PRACTICE_ID, form('max.fehler'), ['THERAPIST']);
    expect(await invitationById(inv3.id)).toMatchObject({ ok: true });
    expect(
      await rawDb.mailboxProvisioning.findUnique({ where: { address: 'max.fehler@pain-therapy.online' } }),
    ).toMatchObject({ status: 'FAILED' });
    infomaniak.create = create;
  });

  it('stops at the SMS limits and creates nothing then', async () => {
    const actor = await admin();
    const before = await rawDb.invitation.count();
    await rawDb.smsMessage.createMany({
      data: Array.from({ length: 50 }, () => ({ toMasked: 'x', purpose: 'CODE' as const, status: 'SENT' as const })),
    });
    await expect(
      inviteMember(
        actor,
        TEST_PRACTICE_ID,
        { name: 'Zu Viel', channel: 'SMS', mobile: '+41791110000', mailbox: { mode: 'NONE' }, email: 'zu@viel.test' },
        ['THERAPIST'],
      ),
    ).rejects.toMatchObject({ code: 'smsDayLimit' });
    expect(await rawDb.invitation.count()).toBe(before);
    await rawDb.smsMessage.deleteMany({ where: { toMasked: 'x' } });
  });
});

describe('mobile number under «Mein Profil»', () => {
  it('changes the number only with the code sent to the new number', async () => {
    const actor = await admin();
    expect(await requestMobileChangeCode(actor.id, '+41761234590', '10.0.0.2')).toEqual({ ok: true });
    expect(sms.at(-1)!.to).toBe('+41761234590');
    expect((await confirmMobileChange(actor.id, '111111', '10.0.0.2')).ok).toBe(false);
    expect((await confirmMobileChange(actor.id, codeOf(sms.at(-1)!.text), '10.0.0.2')).ok).toBe(true);
    expect((await rawDb.user.findUniqueOrThrow({ where: { id: actor.id } })).mobile).toBe('+41761234590');
  });
});
