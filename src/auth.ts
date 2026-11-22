import NextAuth, { CredentialsSignin, type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers';
import { config } from '@/lib/config';
import { isSessionIdle } from '@/lib/access';
import type { AppRole } from '@/lib/auth/accounts';
import { LOGIN_HINT_COOKIE, LOGIN_HINT_MAX_AGE, loginHintFrom } from '@/lib/login-hint';

/**
 * Sign-in without Entra (iteration 12, therapist-login, design D2). Auth.js keeps the session cookie; the providers:
 * - `passkey`: a WebAuthn assertion with user verification, a strong sign-in on its own;
 * - `second-factor`: the ticket of a confirmed email code plus an authenticator or recovery code;
 * - `invitation`: the ticket of an accepted invitation, right after the user set up a second factor;
 * - `dev`: local development and end-to-end tests only.
 * Roles and practice are read from the database on every request.
 */

declare module 'next-auth' {
  interface Session {
    /** authTime: start of this sign-in (ms), used for the greeting once per sign-in */
    user: {
      id: string;
      roles: AppRole[];
      practiceId: string | null;
      platformAdmin: boolean;
      authTime?: number;
    } & DefaultSession['user'];
  }
}

type Token = {
  sub?: string;
  /** Tokens of the Entra sign-in (before iteration 12) carry no version and must sign in again */
  v?: number;
  name?: string | null;
  email?: string | null;
  roles?: AppRole[];
  practiceId?: string | null;
  platformAdmin?: boolean;
  authTime?: number;
  lastActivity?: number;
};

const TOKEN_VERSION = 2;

/** Error code for the sign-in form (CredentialsSignin.code) */
function denied(code: string): never {
  const e = new CredentialsSignin();
  e.code = code;
  throw e;
}

/** Client address as seen by the Azure ingress (last X-Forwarded-For entry, which a client cannot choose) */
function ipOf(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  return xff?.split(',').at(-1)?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

const providers: Provider[] = [
  Credentials({
    id: 'passkey',
    name: 'Passkey',
    credentials: { response: {} },
    async authorize(c) {
      const { verifyPasskey } = await import('@/lib/auth/passkeys');
      const { accessOf } = await import('@/lib/auth/accounts');
      let response;
      try {
        response = JSON.parse(String(c?.response ?? ''));
      } catch {
        denied('passkey');
      }
      const userId = await verifyPasskey(response);
      if (!userId) denied('passkey');
      const access = await accessOf(userId);
      if (!access.ok) denied(access.reason);
      return { id: access.userId, name: access.name, email: access.email };
    },
  }),
  Credentials({
    id: 'second-factor',
    name: 'Email code and authenticator',
    credentials: { ticket: {}, code: {} },
    async authorize(c, request) {
      const { completeWithSecondFactor } = await import('@/lib/auth/login-codes');
      const { accessOf } = await import('@/lib/auth/accounts');
      const r = await completeWithSecondFactor(String(c?.ticket ?? ''), String(c?.code ?? ''), ipOf(request));
      if (!r.ok) denied(r.error);
      const access = await accessOf(r.userId);
      if (!access.ok) denied(access.reason);
      return { id: access.userId, name: access.name, email: access.email };
    },
  }),
  Credentials({
    id: 'invitation',
    name: 'Invitation',
    credentials: { ticket: {} },
    async authorize(c) {
      const { ticketOf, consumeTicket } = await import('@/lib/auth/login-codes');
      const { accessOf } = await import('@/lib/auth/accounts');
      const { authDb } = await import('@/lib/db');
      const ticket = String(c?.ticket ?? '');
      const row = await ticketOf(ticket, 'INVITATION');
      if (!row?.invitationId) denied('expired');
      const inv = await authDb.invitation.findUnique({ where: { id: row.invitationId } });
      // Only after the second factor is set up, which accepts the invitation
      if (!inv?.acceptedAt) denied('expired');
      const user = await authDb.user.findUnique({ where: { email: row.email }, select: { id: true } });
      if (!user) denied('expired');
      // ticketOf(…, 'INVITATION') also accepts the SMS code of an invitation (iteration 16)
      const access = await accessOf(user.id);
      if (!access.ok) denied(access.reason);
      if (!(await consumeTicket(ticket))) denied('expired');
      return { id: access.userId, name: access.name, email: access.email };
    },
  }),
];

if (config.devLogin) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Development',
      credentials: { name: {}, email: {}, role: {}, practice: {} },
      async authorize(c) {
        const { authDb } = await import('@/lib/db');
        const { accessOf } = await import('@/lib/auth/accounts');
        const { presetFor } = await import('@/lib/profile-presets');
        const name = String(c?.name || 'Mike Franz');
        const email = String(c?.email || 'mike.franz@ayanta.ch')
          .trim()
          .toLowerCase();
        const role = String(c?.role ?? 'Therapist,Admin');
        const practice = await authDb.practice.findUnique({ where: { slug: String(c?.practice || 'falera') } });
        if (!practice) denied('noMembership');
        const user = await authDb.user.upsert({
          where: { email },
          create: { email, name, activatedAt: new Date(), platformAdmin: role === 'platform', ...presetFor(email) },
          update: { name, activatedAt: new Date(), platformAdmin: role === 'platform' },
        });
        const roles = role
          .split(',')
          .flatMap((r) =>
            r === 'Admin' ? ['PRACTICE_ADMIN' as const] : r === 'Therapist' ? ['THERAPIST' as const] : [],
          );
        await authDb.practiceMembership.updateMany({ where: { userId: user.id }, data: { active: false } });
        if (roles.length)
          await authDb.practiceMembership.upsert({
            where: { userId_practiceId: { userId: user.id, practiceId: practice.id } },
            create: { userId: user.id, practiceId: practice.id, roles },
            update: { roles, active: true },
          });
        const access = await accessOf(user.id);
        if (!access.ok) denied(access.reason);
        return { id: user.id, name, email };
      },
    }),
  );
}

/** Next sign-in on this device pre-fills the address, see src/lib/login-hint.ts */
async function rememberLoginHint(email: string | null | undefined) {
  const hint = loginHintFrom(email ?? undefined);
  if (!hint) return;
  try {
    const { cookies } = await import('next/headers');
    (await cookies()).set(LOGIN_HINT_COOKIE, hint, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: LOGIN_HINT_MAX_AGE,
    });
  } catch {
    // Outside a request (e.g. tests) there is nothing to remember
  }
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: config.idleTimeoutMs / 1000, updateAge: 0 },
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      const t = token as Token;
      const now = Date.now();
      if (user?.id) {
        // Fresh sign-in: build a new token
        return {
          sub: user.id,
          v: TOKEN_VERSION,
          name: user.name ?? null,
          email: user.email ?? null,
          authTime: now,
          lastActivity: now,
        } satisfies Token;
      }
      if (t.v !== TOKEN_VERSION || !t.sub) return null;
      if (isSessionIdle(t.lastActivity, now, config.idleTimeoutMs)) return null;
      // Roles, practice and its status from the database; a cookie refreshed by a request that was still running
      // during sign-out must not revive the session
      const { accessOf } = await import('@/lib/auth/accounts');
      const access = await accessOf(t.sub, t.authTime);
      if (!access.ok) return null;
      t.name = access.name;
      t.email = access.email;
      t.roles = access.roles;
      t.practiceId = access.practiceId;
      t.platformAdmin = access.platformAdmin;
      t.lastActivity = now;
      return t;
    },
    async session({ session, token }) {
      const t = token as Token;
      session.user.id = t.sub ?? '';
      session.user.name = t.name ?? '';
      session.user.email = t.email ?? '';
      session.user.authTime = t.authTime;
      // Right after sign-in the token has no roles yet: read them now instead of waiting for the next request
      if (t.roles === undefined && t.sub) {
        const { accessOf } = await import('@/lib/auth/accounts');
        const access = await accessOf(t.sub, t.authTime);
        if (access.ok)
          Object.assign(t, { roles: access.roles, practiceId: access.practiceId, platformAdmin: access.platformAdmin });
      }
      session.user.roles = t.roles ?? [];
      session.user.practiceId = t.practiceId ?? null;
      session.user.platformAdmin = t.platformAdmin ?? false;
      return session;
    },
  },
  events: {
    async signOut(message) {
      const sub = 'token' in message ? message.token?.sub : undefined;
      if (!sub) return;
      const { authDb } = await import('@/lib/db');
      await authDb.user.updateMany({ where: { id: sub }, data: { signedOutAt: new Date() } });
    },
    async signIn({ user }) {
      if (!user.id) return;
      const { authDb } = await import('@/lib/db');
      await authDb.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      await rememberLoginHint(user.email);
    },
  },
});
