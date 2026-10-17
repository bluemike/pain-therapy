import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { firstName, profileOf } from '@/lib/users';
import { ProfileForm } from '@/components/ProfileForm';

export const dynamic = 'force-dynamic';

/** user-profile (iteration 8, design D9): "Mein Profil" with display name and professional title */
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const user = await requireUser();
  const [t, profile, sp] = await Promise.all([getTranslations('profile'), profileOf(user.id), searchParams]);
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
      </div>
      {sp.flash === 'saved' ? (
        <div className="banner ok" role="status">
          <p>{t('savedFlash')}</p>
        </div>
      ) : null}
      <ProfileForm initial={{ displayName: profile.displayName ?? firstName(profile.name), title: profile.title }} />
    </>
  );
}
