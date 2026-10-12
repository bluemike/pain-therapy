import NextAuth, { type DefaultSession } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Credentials from 'next-auth/providers/credentials';
import type { Provider } from 'next-auth/providers';
import type { Role } from '@prisma/client';
import { config } from '@/lib/config';
import { checkClaims, isSessionIdle, type EntraClaims } from '@/lib/access';
import { verifyPatientMode } from '@/lib/patient-mode';

declare module 'next-auth' {
  interface Session {
    user: { id: string; roles: Role[] } & DefaultSession['user'];
    patientMode?: { sid: string; since: number };
  }
}

type Token = {
  sub?: string;
  name?: string | null;
  email?: string | null;
  roles?: Role[];
  authTime?: number;
  lastActivity?: number;
  patientMode?: { sid: string; since: number };
};

const providers: Provider[] = [];

if (config.entra.clientId) {
  providers.push(
    MicrosoftEntraID({
      clientId: config.entra.clientId,
      clientSecret: config.entra.clientSecret,
      issuer: `https://login.microsoftonline.com/${config.entra.tenantId}/v2.0`,
      authorization: { params: { scope: 'openid profile email' } },
    }),
  );
}

if (config.devLogin) {
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Development',
      credentials: { name: {}, email: {}, role: {}, tenant: {} },
      authorize(c) {
        const name = String(c?.name || 'Mike Franz');
        const email = String(c?.email || 'mike.franz@ayanta.ch').toLowerCase();
        const role = String(c?.role ?? 'Therapist');
        const tenant = String(c?.tenant ?? 'member');
        const claims: EntraClaims = {
          tid: tenant === 'other' ? '11111111-1111-1111-1111-111111111111' : config.devTenantId,
          acct: tenant === 'guest' ? 1 : 0,
          roles: role === 'none' ? [] : role.split(','),
        };
        return { id: `dev-${email}`, name, email, claims } as never;
      },
    }),
  );
}

function claimsFor(provider: string, profile: unknown, user: unknown): EntraClaims {
  if (provider === 'dev') return (user as { claims: EntraClaims }).claims;
  return (profile ?? {}) as EntraClaims;
}

function tenantFor(provider: string) {
  return provider === 'dev' ? config.devTenantId : config.entra.tenantId;
}

async function signedOutSince(sub: string | undefined, authTime: number | undefined) {
  if (!sub) return true;
  const { db } = await import('@/lib/db');
  const u = await db.user.findUnique({ where: { entraOid: sub }, select: { signedOutAt: true } });
  return !!u?.signedOutAt && u.signedOutAt.getTime() >= (authTime ?? 0);
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers,
  trustHost: true,
  session: { strategy: 'jwt', maxAge: config.idleTimeoutMs / 1000, updateAge: 0 },
  pages: { signIn: '/login', error: '/no-access' },
  callbacks: {
    signIn({ account, profile, user }) {
      if (!account) return false;
      const check = checkClaims(claimsFor(account.provider, profile, user), tenantFor(account.provider));
      if (!check.ok) return `/no-access?reason=${check.reason}`;
      return true;
    },
    async jwt({ token, account, profile, user, trigger, session }) {
      const t = token as Token;
      const now = Date.now();
      if (account) {
        // Fresh sign-in: build a new token. This also ends patient mode (consent-signing: Patientenmodus verlassen).
        const check = checkClaims(claimsFor(account.provider, profile, user), tenantFor(account.provider));
        if (!check.ok) return null;
        const p = (profile ?? {}) as { oid?: string; preferred_username?: string; email?: string; name?: string };
        return {
          sub: account.provider === 'dev' ? user.id : (p.oid ?? token.sub),
          name: user.name ?? p.name ?? null,
          email: (user.email ?? p.email ?? p.preferred_username ?? '').toLowerCase(),
          roles: check.roles,
          authTime: now,
          lastActivity: now,
        } satisfies Token;
      }
      if (isSessionIdle(t.lastActivity, now, config.idleTimeoutMs)) return null;
      // A cookie refreshed by a request that was still running during sign-out must not revive the session
      if (await signedOutSince(t.sub, t.authTime)) return null;
      t.lastActivity = now;
      if (trigger === 'update') {
        const pm = (session as { patientMode?: { sid?: unknown; sig?: unknown } } | undefined)?.patientMode;
        // Only the server can enter patient mode (signed id); nothing but a fresh sign-in can leave it.
        if (pm && verifyPatientMode(pm.sid, pm.sig) && !t.patientMode)
          t.patientMode = { sid: pm.sid as string, since: now };
      }
      return t;
    },
    session({ session, token }) {
      const t = token as Token;
      session.user.id = t.sub ?? '';
      session.user.roles = t.roles ?? [];
      session.user.name = t.name ?? '';
      session.user.email = t.email ?? '';
      if (t.patientMode) session.patientMode = t.patientMode;
      return session;
    },
  },
  events: {
    async signOut(message) {
      const sub = 'token' in message ? message.token?.sub : undefined;
      if (!sub) return;
      const { db } = await import('@/lib/db');
      await db.user.updateMany({ where: { entraOid: sub }, data: { signedOutAt: new Date() } });
    },
    async signIn({ user, account, profile }) {
      if (!account) return;
      const { db } = await import('@/lib/db');
      const check = checkClaims(claimsFor(account.provider, profile, user), tenantFor(account.provider));
      if (!check.ok) return;
      const p = (profile ?? {}) as { oid?: string };
      const oid = account.provider === 'dev' ? user.id! : (p.oid ?? user.id!);
      await db.user.upsert({
        where: { entraOid: oid },
        create: { entraOid: oid, email: user.email ?? '', name: user.name ?? '', roles: check.roles },
        update: { email: user.email ?? '', name: user.name ?? '', roles: check.roles, lastLoginAt: new Date() },
      });
    },
  },
});
