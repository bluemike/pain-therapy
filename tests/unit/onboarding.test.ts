import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rawDb } from '@/lib/db';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import { formatMobile, maskMobile, normalizeMobile } from '@/lib/phone';
import { suggestLocalPart, validLocalPart } from '@/lib/mailbox-address';
import { mailProfile } from '@/lib/mail-profile';
import { imapQuote, setMailService, type MailService } from '@/lib/infomaniak';
import { setSmsSender } from '@/lib/sms';
import { inviteMember, printInvitation, teamOf } from '@/lib/team';
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
import {
  acceptInvitation,
  invitationById,
  invitationByToken,
  invitationTokenKey,
  userForInvitation,
} from '@/lib/auth/accounts';
import {
  confirmEmailChange,
  confirmMobileChange,
  requestEmailChangeCode,
  requestInvitationEmailCode,
  requestInvitationSmsCode,
  requestMobileChangeCode,
  ticketOf,
  verifyCode,
} from '@/lib/auth/login-codes';
import type { Actor } from '@/lib/session';
import { invitePracticeAdminWith, printPracticeInvitation, revokePracticeInvitation } from '@/lib/platform';
import { practiceSender, replyToOf } from '@/lib/practice-mail';
import { runInPractice } from '@pain-therapy/shared/practice-context';
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

  it('reads the invitation form: a mailbox by e-mail needs a private address, SMS needs a valid number', () => {
    expect(() =>
      parseInviteForm(fd({ name: 'A', channel: 'EMAIL', mailbox: 'NEW', localPart: 'a.b', mobile: '' })),
    ).toThrow(expect.objectContaining({ code: 'privateEmailInvalid' }));
    expect(() =>
      parseInviteForm(fd({ name: 'A', channel: 'BOTH', mailbox: 'NONE', email: 'a@b.ch', mobile: '' })),
    ).toThrow(expect.objectContaining({ code: 'mobileInvalid' }));
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
      notifyEmail: null,
    });
    expect(
      parseInviteForm(
        fd({
          name: 'A',
          channel: 'BOTH',
          mailbox: 'NEW',
          localPart: 'a.b',
          mobile: '079 123 45 67',
          privateEmail: ' A.B@Gmail.com ',
        }),
      ),
    ).toMatchObject({ channel: 'BOTH', notifyEmail: 'a.b@gmail.com', email: null });
  });
});

describe('invitation by SMS with a new mailbox', () => {
  const form = (localPart: string): InviteForm => ({
    name: 'Jürg Müller',
    channel: 'SMS',
    mobile: '+41781234512',
    mailbox: { mode: 'NEW', localPart },
    email: null,
    notifyEmail: null,
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
        {
          name: 'Zu Viel',
          channel: 'SMS',
          mobile: '+41791110000',
          mailbox: { mode: 'NONE' },
          email: 'zu@viel.test',
          notifyEmail: null,
        },
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

describe('own address instead of a mailbox (Mike, 22.11.2026)', () => {
  it('withdraws an invitation with an existing mailbox and invites the person again with her own address', async () => {
    const u = await rawDb.user.upsert({
      where: { email: 'platform16@example.test' },
      create: { email: 'platform16@example.test', name: 'Plattform', platformAdmin: true, activatedAt: new Date() },
      update: {},
    });
    const platform: Actor = { id: u.id, name: u.name, email: u.email, roles: [] };
    const sms1: InviteForm = {
      name: 'Christina Franz',
      channel: 'SMS',
      mobile: '+41791112233',
      mailbox: { mode: 'EXISTING', localPart: 'christina.franz' },
      email: null,
      notifyEmail: null,
    };
    const inv = await invitePracticeAdminWith(platform, TEST_PRACTICE_ID, sms1);
    infomaniak.devices.set('christina.franz@pain-therapy.online', 'geraet-1');
    const row = await rawDb.mailboxProvisioning.findUniqueOrThrow({ where: { invitationId: inv.id } });
    await handOverAccess(row.id, 'geraet-1');

    await revokePracticeInvitation(platform, TEST_PRACTICE_ID, inv.id);
    await expect(revokePracticeInvitation(platform, TEST_PRACTICE_ID, inv.id)).rejects.toMatchObject({
      code: 'notFound',
    });
    await sweepMailboxes();
    // Our row and the handed-over password are gone; the mailbox itself stays at Infomaniak
    expect(await rawDb.mailboxProvisioning.findUnique({ where: { id: row.id } })).toBeNull();
    expect(infomaniak.boxes.has('christina.franz')).toBe(true);

    const own = await invitePracticeAdminWith(platform, TEST_PRACTICE_ID, {
      ...sms1,
      mailbox: { mode: 'NONE' },
      email: 'christina.franz@ayanta.ch',
    });
    expect(await invitationById(own.id)).toMatchObject({ ok: true });
    expect(await rawDb.mailboxProvisioning.count({ where: { invitationId: own.id } })).toBe(0);
    expect((await rawDb.invitation.findUniqueOrThrow({ where: { id: own.id } })).email).toBe(
      'christina.franz@ayanta.ch',
    );
  });

  it('sends patient mails from noreply@ with the therapist as Reply-To, else the practice contact', async () => {
    await runInPractice(TEST_PRACTICE_ID, async () => {
      expect(await practiceSender('christina.franz@ayanta.ch')).toMatchObject({
        replyTo: 'christina.franz@ayanta.ch',
      });
      expect((await practiceSender(null)).replyTo).toBe('praxis@example.test');
    });
    expect(replyToOf({ email: ' Christina.Franz@Ayanta.ch ' })).toBe('christina.franz@ayanta.ch');
  });
});

describe('sign-in address under «Mein Profil»', () => {
  it('changes the address with a code sent to the new one, keeps the account and drops invitations to it', async () => {
    const u = await rawDb.user.create({
      data: { email: 'christina.franz@pain-therapy.online', name: 'Christina Franz', activatedAt: new Date() },
    });
    await rawDb.user.create({ data: { email: 'besetzt@example.test', name: 'Besetzt' } });
    const inv = await rawDb.invitation.create({
      data: {
        email: 'christina.franz@ayanta.ch',
        name: 'Christina Franz',
        practiceId: TEST_PRACTICE_ID,
        roles: ['PRACTICE_ADMIN'],
        tokenHash: 'email-change-test',
        invitedBy: 'Plattform',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    expect(await requestEmailChangeCode(u.id, 'kein-mail', '10.0.0.3')).toEqual({ ok: false, error: 'invalidEmail' });
    expect(await requestEmailChangeCode(u.id, 'Besetzt@example.test', '10.0.0.3')).toEqual({
      ok: false,
      error: 'taken',
    });
    expect(await requestEmailChangeCode(u.id, ' Christina.Franz@Ayanta.ch ', '10.0.0.3')).toEqual({ ok: true });
    expect(mails.at(-1)!.to).toBe('christina.franz@ayanta.ch');
    expect((await confirmEmailChange(u.id, '111111', '10.0.0.3')).ok).toBe(false);
    expect((await confirmEmailChange(u.id, codeOf(mails.at(-1)!.text), '10.0.0.3')).ok).toBe(true);
    expect((await rawDb.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe('christina.franz@ayanta.ch');
    expect((await rawDb.invitation.findUniqueOrThrow({ where: { id: inv.id } })).revokedAt).not.toBeNull();
  });
});

describe('invitation by SMS, e-mail or both, and printed (iteration 19)', () => {
  const both = (localPart: string, privateEmail: string | null = 'anna.privat@example.test'): InviteForm => ({
    name: 'Anna Muster',
    channel: 'BOTH',
    mobile: '+41791234567',
    mailbox: { mode: 'NEW', localPart },
    email: null,
    notifyEmail: privateEmail,
  });
  beforeAll(() => rawDb.practice.update({ where: { id: TEST_PRACTICE_ID }, data: { mailboxQuota: 50 } }));
  const longToken = (text: string) => /\/einladung\/([A-Za-z0-9_-]{43})/.exec(text)?.[1] ?? '';

  it('sends the same link by SMS and to the private address; the code comes by SMS or e-mail', async () => {
    const actor = await admin();
    const inv = await inviteMember(actor, TEST_PRACTICE_ID, both('anna.muster'), ['THERAPIST']);
    expect(inv.smsFailed).toBeUndefined();
    expect(infomaniak.boxes.has('anna.muster')).toBe(true);
    expect(sms).toHaveLength(1);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe('anna.privat@example.test');
    expect(longToken(mails[0]!.text)).toBe(tokenOf(sms[0]!.text));
    expect(await invitationById(inv.id)).toMatchObject({
      ok: true,
      email: 'anna.muster@pain-therapy.online',
      channel: 'BOTH',
      notifyEmail: 'anna.privat@example.test',
    });

    // E-mail code to the private address, stored under the sign-in address
    mails.length = 0;
    expect(await requestInvitationEmailCode(inv.id, '10.0.19.1')).toEqual({ ok: true });
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe('anna.privat@example.test');
    const v = await verifyCode('anna.muster@pain-therapy.online', codeOf(mails[0]!.text), '10.0.19.1', 'INVITATION');
    expect(v.ok).toBe(true);
    if (v.ok) expect(await ticketOf(v.ticket, 'INVITATION')).toMatchObject({ invitationId: inv.id });

    // The SMS code works as well
    expect(await requestInvitationSmsCode(inv.id, '10.0.19.1')).toEqual({ ok: true });
  });

  it('keeps the invitation when the SMS of «beides» fails and the mail went out', async () => {
    const actor = await admin();
    setSmsSender({
      send: async () => {
        throw new Error('gateway down');
      },
    });
    const inv = await inviteMember(actor, TEST_PRACTICE_ID, both('ben.teil', 'ben@example.test'), ['THERAPIST']);
    expect(inv.smsFailed).toBe(true);
    expect(mails.map((m) => m.to)).toEqual(['ben@example.test']);
    expect(await invitationById(inv.id)).toMatchObject({ ok: true });
  });

  it('withdraws the invitation when neither channel goes out', async () => {
    const actor = await admin();
    setSmsSender({
      send: async () => {
        throw new Error('gateway down');
      },
    });
    setMailer({
      send: async () => {
        throw new Error('smtp down');
      },
    });
    const before = await rawDb.invitation.count({ where: { revokedAt: null } });
    await expect(
      inviteMember(
        actor,
        TEST_PRACTICE_ID,
        { ...both('x'), mailbox: { mode: 'NONE' }, email: 'keiner@example.test', notifyEmail: null },
        ['THERAPIST'],
      ),
    ).rejects.toMatchObject({ code: 'smsFailed' });
    expect(await rawDb.invitation.count({ where: { revokedAt: null } })).toBe(before);
  });

  it('sends no e-mail code for an invitation by SMS only', async () => {
    const actor = await admin();
    const inv = await inviteMember(actor, TEST_PRACTICE_ID, { ...both('nur.sms'), channel: 'SMS', notifyEmail: null }, [
      'THERAPIST',
    ]);
    mails.length = 0;
    expect(await requestInvitationEmailCode(inv.id, '10.0.19.2')).toEqual({ ok: true });
    expect(mails).toHaveLength(0);
  });

  it('prints with a new short link: the old links stop, the short one works in any case', async () => {
    const actor = await admin();
    const inv = await inviteMember(actor, TEST_PRACTICE_ID, both('clara.druck', 'clara@example.test'), ['THERAPIST']);
    const old = tokenOf(sms.at(-1)!.text);
    expect(await invitationByToken(old)).toMatchObject({ ok: true });

    const sheet = await printInvitation(actor, TEST_PRACTICE_ID, inv.id);
    expect(sheet).toMatchObject({ email: 'clara.druck@pain-therapy.online', mailbox: true, name: 'Anna Muster' });
    const short = sheet.shortUrl.split('/e/')[1]!;
    expect(short).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(JSON.stringify(sheet)).not.toMatch(/\b\d{6}\b/);
    expect(await invitationByToken(old)).toMatchObject({ ok: false, reason: 'notFound' });
    expect(await invitationByToken(short)).toMatchObject({ ok: true, id: inv.id });
    expect(await invitationByToken(short.toLowerCase().replace(/-/g, ''))).toMatchObject({ ok: true, id: inv.id });
    expect(invitationTokenKey('nicht-gueltig')).toBeNull();

    // Another practice cannot print it; printing again replaces the printed link
    await expect(printInvitation(actor, 'other-practice', inv.id)).rejects.toMatchObject({ code: 'notFound' });
    const u = await rawDb.user.upsert({
      where: { email: 'platform16@example.test' },
      create: { email: 'platform16@example.test', name: 'Plattform', platformAdmin: true, activatedAt: new Date() },
      update: {},
    });
    const again = await printPracticeInvitation(
      { id: u.id, name: u.name, email: u.email, roles: [] },
      TEST_PRACTICE_ID,
      inv.id,
    );
    expect(await invitationByToken(short)).toMatchObject({ ok: false });
    expect(await invitationByToken(again.shortUrl.split('/e/')[1]!)).toMatchObject({ ok: true });
    expect(await rawDb.auditEvent.count({ where: { action: 'team.invitationPrinted' } })).toBe(2);
  });
});
