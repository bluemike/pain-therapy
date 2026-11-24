import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { invitationByToken } from '@/lib/auth/accounts';
import { Logo } from '@/components/Logo';
import { InviteFlow } from '@/components/auth/InviteFlow';
import { maskMobile } from '@/lib/phone';
import { maskEmail } from '@/lib/mask-email';

export const dynamic = 'force-dynamic';

/** practice-onboarding, therapist-login (iteration 12, design D4): Einladung annehmen */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('invite');
  const inv = await invitationByToken(token);
  return (
    <div className="app">
      <main className="center" id="main">
        <div className="lcard">
          <Logo />
          {inv.ok ? (
            <>
              <h1>{inv.practiceName ? t('title', { practice: inv.practiceName }) : t('titlePlatform')}</h1>
              <p>
                {t(
                  `${inv.platformAdmin ? 'introPlatform' : inv.roles.includes('PRACTICE_ADMIN') ? 'introAdmin' : 'intro'}${{ SMS: 'Sms', EMAIL: '', BOTH: 'Both' }[inv.channel]}` as 'intro',
                  {
                    inviter: inv.invitedBy,
                  },
                )}
              </p>
              <InviteFlow
                token={token}
                email={
                  inv.channel === 'SMS' ? null : inv.notifyEmail === inv.email ? inv.email : maskEmail(inv.notifyEmail)
                }
                sms={inv.channel !== 'EMAIL' && inv.mobile ? maskMobile(inv.mobile) : null}
              />
            </>
          ) : (
            <>
              <h1>{t('invalidTitle')}</h1>
              <p>{t(`invalid_${inv.reason}`)}</p>
              <Link className="btn btn--ghost" href="/login">
                {t('toLogin')}
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
