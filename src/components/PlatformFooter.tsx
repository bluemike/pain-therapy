import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { config } from '@/lib/config';

/** Platform and operator under every page (iteration 12: neutral brand, operator Ayanta, Mike 19.11.2026) */
export async function PlatformFooter() {
  const t = await getTranslations('platform');
  return (
    <footer className="platform-foot">
      {t('footer', { operator: config.operator.name })} · <Link href="/impressum">{t('imprint')}</Link>
    </footer>
  );
}
