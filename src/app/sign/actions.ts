'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';
import { config } from '@/lib/config';
import { signingSchema } from '@/lib/schemas';
import { completeSigning, deliverEmail, getSession, SigningError } from '@/lib/signing';

export type SignState = { error?: string };

async function patientModeFor(sid: string) {
  const session = await auth();
  if (!session?.user?.id || session.patientMode?.sid !== sid) redirect('/');
  return session;
}

/** consent-signing: Abschluss der Unterschrift */
export async function submitSignature(sid: string, payload: unknown): Promise<SignState> {
  const session = await patientModeFor(sid);
  const parsed = signingSchema.safeParse(payload);
  if (!parsed.success) return { error: 'invalid' };
  try {
    const { delivery } = await completeSigning(
      { id: session.user.id, name: session.user.name ?? '', email: '', roles: session.user.roles },
      sid,
      parsed.data,
    );
    if (delivery?.status === 'PENDING') after(() => deliverEmail(delivery.id).catch(console.error));
  } catch (e) {
    if (e instanceof SigningError) return { error: e.code };
    console.error(e);
    return { error: 'generic' };
  }
  redirect(`/sign/${sid}/thanks`);
}

/** consent-signing: Patientenmodus verlassen, only with a fresh Entra ID sign-in */
export async function reauthenticate(sid: string) {
  const session = await patientModeFor(sid);
  const s = await getSession(sid);
  const redirectTo = s ? `/patients/${s.patientId}/signing/${sid}` : '/';
  await signIn('microsoft-entra-id', { redirectTo }, { prompt: 'login', login_hint: session.user.email ?? '' });
}

export async function reauthenticateDev(sid: string, fd: FormData) {
  if (!config.devLogin) redirect('/');
  await patientModeFor(sid);
  const s = await getSession(sid);
  await signIn('dev', {
    name: fd.get('name'),
    email: fd.get('email'),
    role: fd.get('role'),
    tenant: 'member',
    redirectTo: s ? `/patients/${s.patientId}/signing/${sid}` : '/',
  });
}
