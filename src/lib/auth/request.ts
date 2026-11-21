import 'server-only';
import { cookies, headers } from 'next/headers';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { AuthError } from 'next-auth';

/** Helpers of the sign-in server actions (login, invitation, page "Anmeldung") */

/** Client address as seen by the Azure ingress: the last X-Forwarded-For entry, which a client cannot choose */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  return xff?.split(',').at(-1)?.trim() || h.get('x-real-ip') || 'unknown';
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get('user-agent');
}

/** Ticket of the confirmed email code (httpOnly, only for the sign-in paths) */
export const LOGIN_TICKET_COOKIE = 'pt_login_ticket';
export const INVITE_TICKET_COOKIE = 'pt_invite_ticket';

export async function setTicket(name: string, ticket: string, maxAgeS: number) {
  (await cookies()).set(name, ticket, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeS,
  });
}

export async function getTicket(name: string): Promise<string | undefined> {
  return (await cookies()).get(name)?.value;
}

export async function clearTicket(name: string) {
  (await cookies()).delete(name);
}

/** Runs an Auth.js signIn() that redirects on success; returns the error code of a refused sign-in */
export async function signInOrError(run: () => Promise<unknown>, onSuccess?: () => Promise<void>) {
  try {
    await run();
    return { error: 'unknown' as string };
  } catch (e) {
    if (isRedirectError(e)) {
      await onSuccess?.();
      throw e;
    }
    if (e instanceof AuthError) {
      const code = (e as AuthError & { code?: string }).code;
      return { error: code && code !== 'credentials' ? code : 'wrong' };
    }
    throw e;
  }
}

/** Only paths inside the app as target after sign-in */
export const safeCallback = (url?: string | null) =>
  url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\') ? url : '/';
