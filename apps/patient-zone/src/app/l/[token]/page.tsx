import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { confirmable, lookupLink } from '@/lib/access';
import { getZoneSession } from '@/lib/session';
import { ConfirmForm } from '@/components/ConfirmForm';
import { Invalid } from '@/components/Invalid';
import { PrivacyNote } from '@/components/PrivacyNote';
import { SessionProbe } from '@/components/SessionProbe';

/**
 * patient-access: Bestätigung mit dem Geburtsdatum (mockup view 1). Unknown, expired, replaced, revoked and blocked
 * links get the same neutral page; nothing on this page names the patient.
 */
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [found, session, t] = await Promise.all([lookupLink(token), getZoneSession(), getTranslations('confirm')]);
  // Already signed in on this device (with this link or an older one of the same patient)
  if (session && (!found || found.link.patientId === session.patient.id)) redirect('/');
  if (!found || !confirmable(found.state))
    return (
      <>
        <SessionProbe />
        <Invalid />
      </>
    );
  return (
    <>
      {/* The session cookie is SameSite=Strict: when the link comes from an email it is only sent from here */}
      <SessionProbe />
      <h1>{t('title')}</h1>
      <p className="sub">{t('text')}</p>
      <ConfirmForm token={token} locked={found.state === 'locked'} />
      <PrivacyNote />
    </>
  );
}
