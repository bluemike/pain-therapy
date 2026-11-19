import 'server-only';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { authDb } from '../db';
import { config } from '../config';

/**
 * Passkeys (therapist-login, design D2): WebAuthn with user verification (Face ID, Touch ID, device PIN), discoverable
 * so the sign-in needs no address. Challenges are single use and valid 5 minutes.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const rp = () => {
  const url = new URL(config.auth.appUrl);
  return { rpID: url.hostname, origin: url.origin };
};

/** Challenge from the client data of a response, to find the stored one */
function challengeOf(clientDataJSON: string): string {
  try {
    return String(JSON.parse(Buffer.from(clientDataJSON, 'base64url').toString('utf8')).challenge ?? '');
  } catch {
    return '';
  }
}

async function takeChallenge(challenge: string, userId: string | null): Promise<boolean> {
  if (!challenge) return false;
  const r = await authDb.webAuthnChallenge.deleteMany({
    where: { challenge, userId, expiresAt: { gt: new Date() } },
  });
  // Housekeeping: expired challenges of abandoned attempts
  await authDb.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return r.count === 1;
}

export async function registrationOptions(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const u = await authDb.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, passkeys: { select: { credentialId: true, transports: true } } },
  });
  const options = await generateRegistrationOptions({
    rpName: config.auth.rpName,
    rpID: rp().rpID,
    userName: u.email,
    userDisplayName: u.name || u.email,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: u.passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  await authDb.webAuthnChallenge.create({
    data: { challenge: options.challenge, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  return options;
}

/** Stores the new passkey; false if the response does not verify */
export async function registerPasskey(
  userId: string,
  response: RegistrationResponseJSON,
  label: string,
): Promise<boolean> {
  const expectedChallenge = challengeOf(response.response?.clientDataJSON ?? '');
  if (!(await takeChallenge(expectedChallenge, userId))) return false;
  const { rpID, origin } = rp();
  let result;
  try {
    result = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return false;
  }
  if (!result.verified || !result.registrationInfo) return false;
  const { credential } = result.registrationInfo;
  await authDb.passkey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      label: label.slice(0, 60) || 'Passkey',
    },
  });
  return true;
}

export async function authenticationOptions(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({ rpID: rp().rpID, userVerification: 'required' });
  await authDb.webAuthnChallenge.create({
    data: { challenge: options.challenge, userId: null, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  return options;
}

/** The user of a verified passkey sign-in, or null */
export async function verifyPasskey(response: AuthenticationResponseJSON): Promise<string | null> {
  const expectedChallenge = challengeOf(response.response?.clientDataJSON ?? '');
  if (!(await takeChallenge(expectedChallenge, null))) return null;
  const pk = await authDb.passkey.findUnique({ where: { credentialId: response.id } });
  if (!pk) return null;
  const { rpID, origin } = rp();
  let result;
  try {
    result = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: pk.credentialId,
        publicKey: new Uint8Array(pk.publicKey),
        counter: Number(pk.counter),
        transports: pk.transports as AuthenticatorTransportFuture[],
      },
    });
  } catch {
    return null;
  }
  if (!result.verified) return null;
  await authDb.passkey.update({
    where: { id: pk.id },
    data: { counter: BigInt(result.authenticationInfo.newCounter), lastUsedAt: new Date() },
  });
  return pk.userId;
}

/** Short name of the device from the user agent, e.g. "iPad · Safari" */
export function deviceLabel(userAgent: string | null): string {
  const ua = userAgent ?? '';
  const device = /iPad/.test(ua)
    ? 'iPad'
    : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Gerät';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : '';
  return browser ? `${device} · ${browser}` : device;
}
