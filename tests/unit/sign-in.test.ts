import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { rawDb } from '@/lib/db';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import { decrypt, encrypt, normalizeRecoveryCode, recoveryCode } from '@/lib/auth/crypto';
import { base32Encode, totpAt, verifyTotp } from '@/lib/auth/totp';
import {
  acceptInvitation,
  accessOf,
  createInvitation,
  factorsOf,
  invitationByToken,
  issueRecoveryCodes,
  resetSignIn,
  userForInvitation,
} from '@/lib/auth/accounts';
import { completeWithSecondFactor, requestCode, verifyCode } from '@/lib/auth/login-codes';
import { confirmTotpSetup, startTotpSetup } from '@/lib/auth/totp-setup';
import { resetDatabase } from './db-reset';
import { TEST_PRACTICE_ID } from './test-practice';

/** therapist-login (iteration 12, design D2 to D4): email code, authenticator, recovery codes, invitation, reset */

const sent: OutgoingMail[] = [];
const IP = '203.0.113.7';

const codeIn = (mail: OutgoingMail | undefined) => /\b(\d{6})\b/.exec(mail?.text ?? '')?.[1] ?? '';
const lastTo = (to: string) => sent.filter((m) => m.to === to).at(-1);

async function activeUser(email: string, roles: ('PRACTICE_ADMIN' | 'THERAPIST')[] = ['THERAPIST']) {
  const u = await rawDb.user.create({ data: { email, name: 'Test Therapeutin', activatedAt: new Date() } });
  await rawDb.practiceMembership.create({ data: { userId: u.id, practiceId: TEST_PRACTICE_ID, roles } });
  return u;
}

/** Signs in up to the ticket of the email code */
async function ticketFor(email: string) {
  await requestCode(email, IP);
  const r = await verifyCode(email, codeIn(lastTo(email)), IP);
  if (!r.ok) throw new Error(r.error);
  return r.ticket;
}

beforeAll(async () => {
  await resetDatabase();
  setMailer({ send: async (m) => void sent.push(m) });
});

afterAll(async () => {
  setMailer(null);
  await resetDatabase();
});

beforeEach(async () => {
  sent.length = 0;
  await rawDb.loginFailure.deleteMany();
});

describe('TOTP (RFC 6238)', () => {
  // Test vector of RFC 6238, appendix B, SHA-1: secret "12345678901234567890", 8 digits; the last 6 here
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it('matches the RFC test vectors', () => {
    expect(totpAt(secret, 59_000)).toBe('287082');
    expect(totpAt(secret, 1111111109_000)).toBe('081804');
    expect(totpAt(secret, 2000000000_000)).toBe('279037');
  });
  it('accepts one step of clock drift, not more', () => {
    const now = 1_800_000_000_000;
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now + 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpAt(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abcdef', now)).toBe(false);
  });
});

describe('secrets', () => {
  it('encrypts TOTP secrets so the database never holds them in clear', () => {
    const box = encrypt('JBSWY3DPEHPK3PXP');
    expect(box).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decrypt(box)).toBe('JBSWY3DPEHPK3PXP');
    const [v, iv, , data] = box.split('.');
    expect(() => decrypt([v, iv, 'AAAAAAAAAAAAAAAAAAAAAA', data].join('.'))).toThrow();
  });
  it('recovery codes are readable from paper and typed in any form', () => {
    const c = recoveryCode();
    expect(c).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(normalizeRecoveryCode(` ${c.toLowerCase().replace('-', ' ')} `)).toBe(c);
  });
});

describe('email code (Anmeldung mit E-Mail-Code und Authenticator)', () => {
  it('sends no code to an unknown address but answers the same', async () => {
    expect(await requestCode('niemand@example.test', IP)).toEqual({ ok: true });
    expect(sent).toHaveLength(0);
  });

  it('sends a 6-digit code without any health data and accepts it once', async () => {
    await activeUser('code@example.test');
    expect(await requestCode('Code@Example.test ', IP)).toEqual({ ok: true });
    const mail = lastTo('code@example.test');
    expect(mail?.subject).toMatch(/^Ihr Anmeldecode: \d{6}$/);
    expect(mail?.text).toContain('10 Minuten');
    const code = codeIn(mail);
    const r = await verifyCode('code@example.test', code, IP);
    expect(r.ok).toBe(true);
    expect(await verifyCode('code@example.test', code, IP)).toEqual({ ok: false, error: 'wrong' });
    const row = await rawDb.loginCode.findFirstOrThrow({ where: { email: 'code@example.test' } });
    expect(row.codeHash).not.toContain(code);
  });

  it('only the newest code counts', async () => {
    await activeUser('newest@example.test');
    await requestCode('newest@example.test', IP);
    const first = codeIn(lastTo('newest@example.test'));
    await requestCode('newest@example.test', IP);
    const second = codeIn(lastTo('newest@example.test'));
    if (first !== second) expect((await verifyCode('newest@example.test', first, IP)).ok).toBe(false);
    expect((await verifyCode('newest@example.test', second, IP)).ok).toBe(true);
  });

  it('rejects an expired code', async () => {
    await activeUser('expired@example.test');
    await requestCode('expired@example.test', IP);
    await rawDb.loginCode.updateMany({
      where: { email: 'expired@example.test' },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifyCode('expired@example.test', codeIn(lastTo('expired@example.test')), IP)).toEqual({
      ok: false,
      error: 'expired',
    });
  });

  it('locks the address for 15 minutes after 5 wrong codes (Zu viele Fehlversuche)', async () => {
    await activeUser('lock@example.test');
    await requestCode('lock@example.test', IP);
    const right = codeIn(lastTo('lock@example.test'));
    const wrong = right === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++)
      expect((await verifyCode('lock@example.test', wrong, IP)) as unknown).toEqual({ ok: false, error: 'wrong' });
    expect(await verifyCode('lock@example.test', wrong, IP)).toEqual({ ok: false, error: 'locked' });
    expect(await verifyCode('lock@example.test', right, IP)).toEqual({ ok: false, error: 'locked' });
    expect(await requestCode('lock@example.test', IP)).toEqual({ ok: false, error: 'locked' });
    // After 15 minutes the address works again
    await rawDb.loginFailure.updateMany({ data: { createdAt: new Date(Date.now() - 16 * 60_000) } });
    expect((await verifyCode('lock@example.test', right, IP)).ok).toBe(true);
  });
});

describe('second factor', () => {
  it('signs in with email code plus authenticator code, not with the email code alone', async () => {
    const u = await activeUser('totp@example.test');
    const { secret } = await startTotpSetup(u.id);
    expect(await confirmTotpSetup(u.id, totpAt(secret, Date.now()))).toBe(true);
    const stored = await rawDb.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(stored.totpSecretEnc).not.toContain(secret);

    const ticket = await ticketFor('totp@example.test');
    expect(
      await completeWithSecondFactor(ticket, '000000' === totpAt(secret, Date.now()) ? '111111' : '000000', IP),
    ).toEqual({
      ok: false,
      error: 'wrong',
    });
    expect(await completeWithSecondFactor(ticket, totpAt(secret, Date.now()), IP)).toEqual({
      ok: true,
      userId: u.id,
      method: 'totp',
    });
    // The ticket is used up
    expect(await completeWithSecondFactor(ticket, totpAt(secret, Date.now()), IP)).toEqual({
      ok: false,
      error: 'expired',
    });
  });

  it('accepts each recovery code once', async () => {
    const u = await activeUser('recovery@example.test');
    const codes = await issueRecoveryCodes(u.id);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    const ticket = await ticketFor('recovery@example.test');
    expect(await completeWithSecondFactor(ticket, codes[3]!.toLowerCase(), IP)).toMatchObject({
      ok: true,
      method: 'recovery',
    });
    const again = await ticketFor('recovery@example.test');
    expect(await completeWithSecondFactor(again, codes[3]!, IP)).toEqual({ ok: false, error: 'wrong' });
    expect((await factorsOf(u.id)).recoveryCodesLeft).toBe(9);
  });

  it('tells a user of a suspended practice why (Gesperrte Praxis)', async () => {
    const u = await activeUser('suspended@example.test');
    const codes = await issueRecoveryCodes(u.id);
    await rawDb.practice.update({ where: { id: TEST_PRACTICE_ID }, data: { status: 'SUSPENDED' } });
    try {
      expect(await accessOf(u.id)).toEqual({ ok: false, reason: 'suspended' });
      const ticket = await ticketFor('suspended@example.test');
      expect(await completeWithSecondFactor(ticket, codes[0]!, IP)).toEqual({ ok: false, error: 'suspended' });
    } finally {
      await rawDb.practice.update({ where: { id: TEST_PRACTICE_ID }, data: { status: 'ACTIVE' } });
    }
  });
});

describe('roles and sessions', () => {
  it('reads the roles from the membership and ends older sessions after sign-out', async () => {
    const u = await activeUser('roles@example.test', ['PRACTICE_ADMIN', 'THERAPIST']);
    const before = Date.now() - 1000;
    expect(await accessOf(u.id, before)).toMatchObject({
      ok: true,
      practiceId: TEST_PRACTICE_ID,
      roles: ['ADMIN', 'THERAPIST'],
      platformAdmin: false,
    });
    await rawDb.user.update({ where: { id: u.id }, data: { signedOutAt: new Date() } });
    expect(await accessOf(u.id, before)).toEqual({ ok: false, reason: 'signedOut' });
  });

  it('lets the platform admin in without a practice (Eigenes Admin-Konto)', async () => {
    const u = await rawDb.user.create({
      data: { email: 'admin@example.test', name: 'Admin', activatedAt: new Date(), platformAdmin: true },
    });
    expect(await accessOf(u.id)).toMatchObject({ ok: true, practiceId: null, roles: [], platformAdmin: true });
  });
});

describe('invitation (Einladung annehmen)', () => {
  it('activates the account only after a second factor and shows 10 recovery codes', async () => {
    const { url } = await createInvitation({
      email: 'Neu@Example.test',
      practiceId: TEST_PRACTICE_ID,
      roles: ['THERAPIST'],
      invitedBy: 'Anna Beispiel',
    });
    const mail = lastTo('neu@example.test');
    expect(mail?.text).toContain(url);
    expect(mail?.text).toContain('Anna Beispiel');
    const token = url.split('/').at(-1)!;
    const inv = await invitationByToken(token);
    if (!inv.ok) throw new Error(inv.reason);

    // A login code is not sent to an invited address without account
    expect(await requestCode('neu@example.test', IP)).toEqual({ ok: true });
    expect(sent.filter((m) => m.subject.startsWith('Ihr Anmeldecode'))).toHaveLength(0);

    await requestCode('neu@example.test', IP, 'INVITATION', inv.id);
    const r = await verifyCode('neu@example.test', codeIn(lastTo('neu@example.test')), IP, 'INVITATION');
    expect(r.ok).toBe(true);
    const userId = await userForInvitation(inv.id);
    expect(await accessOf(userId)).toEqual({ ok: false, reason: 'inactive' });

    const { secret } = await startTotpSetup(userId);
    expect(await confirmTotpSetup(userId, totpAt(secret, Date.now()))).toBe(true);
    const codes = await acceptInvitation(inv.id, userId);
    expect(codes).toHaveLength(10);
    expect(await accessOf(userId)).toMatchObject({ ok: true, practiceId: TEST_PRACTICE_ID, roles: ['THERAPIST'] });
    expect(await invitationByToken(token)).toEqual({ ok: false, reason: 'used' });
    await expect(acceptInvitation(inv.id, userId)).rejects.toThrow();
  });

  it('a newer invitation replaces the older one; expired ones do not open', async () => {
    const first = await createInvitation({
      email: 'twice@example.test',
      practiceId: TEST_PRACTICE_ID,
      roles: ['THERAPIST'],
      invitedBy: 'Anna',
    });
    const second = await createInvitation({
      email: 'twice@example.test',
      practiceId: TEST_PRACTICE_ID,
      roles: ['PRACTICE_ADMIN'],
      invitedBy: 'Anna',
    });
    expect(await invitationByToken(first.url.split('/').at(-1)!)).toEqual({ ok: false, reason: 'notFound' });
    expect(await invitationByToken(second.url.split('/').at(-1)!)).toMatchObject({
      ok: true,
      roles: ['PRACTICE_ADMIN'],
    });
    await rawDb.invitation.update({ where: { id: second.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await invitationByToken(second.url.split('/').at(-1)!)).toEqual({ ok: false, reason: 'expired' });
    expect(await invitationByToken('not-a-token')).toEqual({ ok: false, reason: 'notFound' });
  });

  it('reset removes passkeys, authenticator and recovery codes and invites again (Gerät verloren)', async () => {
    const u = await activeUser('reset@example.test', ['THERAPIST']);
    await issueRecoveryCodes(u.id);
    const { secret } = await startTotpSetup(u.id);
    await confirmTotpSetup(u.id, totpAt(secret, Date.now()));
    await rawDb.passkey.create({
      data: { userId: u.id, credentialId: 'cred-reset', publicKey: Buffer.from([1, 2, 3]), label: 'iPad' },
    });
    const { url } = await resetSignIn(u.id, 'Anna Beispiel');
    expect(await factorsOf(u.id)).toEqual({ totp: false, passkeys: [], recoveryCodesLeft: 0 });
    expect(await accessOf(u.id)).toEqual({ ok: false, reason: 'inactive' });
    expect(lastTo('reset@example.test')?.text).toContain(url);
    expect(await invitationByToken(url.split('/').at(-1)!)).toMatchObject({ ok: true, roles: ['THERAPIST'] });
  });
});
