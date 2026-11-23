import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { parseBlocks } from '@pain-therapy/shared/consent-blocks';
import { fieldValuesOf, fillFields } from '@pain-therapy/shared/consent-fields';
import { sessionPractice } from '@/lib/practice';
import { touchSession } from '@/lib/access';
import { getZoneSession } from '@/lib/session';
import { openForm, personalDetails } from '@/lib/signing';
import { ZoneSigningForm } from '@/components/ZoneSigningForm';

/** dd.mm.yyyy of a date stored as UTC midnight (@db.Date) */
const dateOf = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

/**
 * zone-consent-signing: the form on the phone (mockup view 4): personal details with a remark, the text of the
 * current version, the consents and the signature field. Opening it opens or reuses the signature session (design D5).
 */
export default async function SigningFormPage() {
  const s = await getZoneSession();
  if (!s?.signaturePending) redirect('/');
  await touchSession(s);
  const [form, p, t, practice] = await Promise.all([
    openForm(s),
    personalDetails(s),
    getTranslations('signForm'),
    sessionPractice(),
  ]);
  if (!form || !practice) redirect('/unterschrift');
  // consent-template (iteration 17, design D1): the fields with the practice details
  const values = fieldValuesOf(practice);
  const details: [string, string][] = [
    [t('name'), `${p.firstName} ${p.lastName}`],
    [t('dateOfBirth'), dateOf(p.dateOfBirth)],
    [t('address'), [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')],
    [t('phone'), [p.phone, p.mobile].filter(Boolean).join(' · ')],
    [t('email'), p.email ?? ''],
    [t('insurance'), [p.insurer, p.insuranceNumber].filter(Boolean).join(' · ')],
  ];
  return (
    <ZoneSigningForm
      sid={form.sid}
      title={fillFields(form.text.title, values)}
      version={form.text.version}
      blocks={parseBlocks(fillFields(form.text.body, values))}
      details={details}
    />
  );
}
