import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { getSession } from '@/lib/signing';
import { parseBlocks } from '@/lib/consent-texts';
import { formatDate, formatDateTime } from '@/lib/format';
import { config } from '@/lib/config';
import { db } from '@/lib/db';
import { SigningForm } from '@/components/SigningForm';
import { PatientModeBar } from '@/components/PatientModeBar';

export const dynamic = 'force-dynamic';

/** consent-signing: Patientenmodus, in the patient's language */
export default async function SignPage({ params }: { params: Promise<{ sid: string }> }) {
  const { sid } = await params;
  const session = await auth();
  if (session?.patientMode?.sid !== sid) redirect('/');
  const s = await getSession(sid);
  if (!s) notFound();
  if (s.status === 'SIGNED') redirect(`/sign/${sid}/thanks`);
  if (s.status !== 'OPEN') redirect(`/sign/${sid}/leave`);
  const lang = s.language;
  const t = await getTranslations({ locale: lang, namespace: 'signing' });
  const p = s.patient;
  const user = await db.user.findUnique({ where: { entraOid: session.user.id }, select: { place: true } });
  const details: [string, string][] = [
    [t('name'), `${p.firstName} ${p.lastName}`],
    [t('dateOfBirth'), formatDate(p.dateOfBirth)],
    [t('address'), [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
    [t('phone'), [p.phone, p.mobile].filter(Boolean).join(' · ')],
    [t('email'), p.email ?? ''],
    [t('insurance'), [p.insurer, p.insuranceNumber].filter(Boolean).join(' · ')],
  ];
  const keys = [
    'title',
    'intro',
    'stepDetails',
    'noteLabel',
    'notePlaceholder',
    'stepRead',
    'readHint',
    'readDone',
    'stepConsents',
    'consentLiability',
    'consentData',
    'consentEmail',
    'required',
    'optional',
    'consentRequiredError',
    'stepSignature',
    'place',
    'date',
    'signatureHint',
    'signatureLocked',
    'clear',
    'sign',
    'signing',
    'signatureError',
    'readError',
    'submitError',
  ] as const;
  const strings = Object.fromEntries(keys.map((k) => [k, t(k, { name: p.firstName })])) as Record<
    (typeof keys)[number],
    string
  >;
  return (
    <div className="pm" lang={lang}>
      <PatientModeBar sid={sid} modeLabel={t('mode')} exitLabel={t('exit')} />
      <SigningForm
        sid={sid}
        strings={{ ...strings, textEnd: t('textEnd', { version: s.textVersion.version }) }}
        details={details}
        blocks={parseBlocks(s.textVersion.body)}
        textTitle={s.textVersion.title}
        defaultPlace={user?.place ?? config.defaultPlace}
        today={formatDateTime(new Date()).slice(0, 10)}
      />
    </div>
  );
}
