import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { firstName, profileOf } from '@/lib/users';
import { ProfileForm } from '@/components/ProfileForm';
import { MobileForm } from '@/components/MobileForm';
import { EmailForm } from '@/components/EmailForm';
import { authDb } from '@/lib/db';
import { mailboxOf } from '@/lib/mailboxes';
import { formatMobile } from '@/lib/phone';

export const dynamic = 'force-dynamic';

/** user-profile (iteration 8, design D9): "Mein Profil" with display name and professional title */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const user = await requireUser();
  const [t, profile, sp, extra, mailbox] = await Promise.all([
    getTranslations('profile'),
    profileOf(user.id),
    searchParams,
    authDb.user.findUnique({ where: { id: user.id }, select: { mobile: true } }),
    mailboxOf(user.id),
  ]);
  if (!profile) notFound();
  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">
            {profile.name} · {profile.email}
          </div>
        </div>
        <Link className="btn btn--ghost" href="/profile/security">
          {t('security')}
        </Link>
      </div>
      {sp.flash === 'saved' ? (
        <div className="banner ok" role="status">
          <p>{t('savedFlash')}</p>
        </div>
      ) : null}
      <ProfileForm
        initial={{
          displayName: profile.displayName ?? firstName(profile.name),
          title: profile.title,
          noteInputMode: profile.noteInputMode,
          audioLanguage: profile.audioLanguage,
        }}
      />
      <section className="card team-card" aria-labelledby="h_contact">
        <h2 id="h_contact">{t('contact')}</h2>
        <h3>{t('emailTitle')}</h3>
        <EmailForm current={user.email} />
        <p className="muted small">{t('emailHint')}</p>
        <h3>{t('mobileTitle')}</h3>
        <MobileForm current={extra?.mobile ? formatMobile(extra.mobile) : null} />
        <p className="muted small">{t('mobileHint')}</p>
        <h3>{t('mailbox')}</h3>
        {mailbox ? (
          <p>
            {mailbox.address} ·{' '}
            <Link href="/postfach">{t(mailbox.access === 'READY' ? 'mailboxReady' : 'mailboxOpen')}</Link>
          </p>
        ) : (
          <p className="muted">{t('noMailbox')}</p>
        )}
      </section>
    </>
  );
}
