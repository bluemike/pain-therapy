import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/** Datenschutzhinweis on the confirmation page (text to be confirmed by the practice, task 10.3) */
export async function PrivacyNote() {
  const t = await getTranslations('common');
  return (
    <aside className="privacy" aria-label={t('privacy')}>
      <b>{t('privacy')}:</b> {t('privacyShort')} <Link href="/privacy">{t('privacyMore')}</Link>
    </aside>
  );
}
