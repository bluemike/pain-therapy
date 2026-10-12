import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getSession } from '@/lib/signing';
import { PatientModeBar } from '@/components/PatientModeBar';
import { LockIcon, TickIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function ThanksPage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const session = await auth();
  if (session?.patientMode?.sid !== sid) redirect('/');
  const s = await getSession(sid);
  if (!s) notFound();
  if (s.status !== 'SIGNED') redirect(`/sign/${sid}`);
  const t = await getTranslations({ locale: s.language, namespace: 'signing' });
  const mail = s.consents.find((c) => c.kind === 'UNENCRYPTED_EMAIL')?.granted && s.patient.email;
  return (
    <div className="pm" lang={s.language}>
      <PatientModeBar sid={sid} modeLabel={t('mode')} />
      <div className="thanks">
        <div className="inner">
          <div className="tick">
            <TickIcon />
          </div>
          <h1>{t('thanksTitle', { name: s.patient.firstName })}</h1>
          <p>{t('thanksText')}</p>
          <p style={{ fontSize: 15 }}>{mail ? t('thanksMail', { email: s.patient.email! }) : t('thanksNoMail')}</p>
          <Link className="btn btn--dark" href={`/sign/${sid}/leave`} style={{ marginTop: 12 }} prefetch={false}>
            <LockIcon />
            {t('backToPractice')}
          </Link>
        </div>
      </div>
    </div>
  );
}
