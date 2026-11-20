import { getTranslations } from 'next-intl/server';
import { requireSignedIn } from '@/lib/session';
import { factorsOf } from '@/lib/auth/accounts';
import { SecurityPanel } from '@/components/auth/SecurityPanel';

export const dynamic = 'force-dynamic';

/** therapist-login (iteration 12): Passkeys, Authenticator-App und Wiederherstellungscodes der eigenen Anmeldung */
export default async function SecurityPage() {
  const user = await requireSignedIn();
  const [t, factors] = await Promise.all([getTranslations('security'), factorsOf(user.id)]);
  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{t('sub')}</div>
        </div>
      </div>
      <SecurityPanel
        factors={{
          totp: factors.totp,
          recoveryCodesLeft: factors.recoveryCodesLeft,
          passkeys: factors.passkeys.map((p) => ({
            id: p.id,
            label: p.label,
            createdAt: p.createdAt.toISOString(),
            lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
          })),
        }}
      />
    </>
  );
}
