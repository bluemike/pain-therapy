'use client';

import { useTranslations } from 'next-intl';

/** Neutrale Fehlermeldungen: the same page for unknown, expired, replaced, revoked and blocked links */
export function Invalid() {
  const t = useTranslations('invalid');
  return (
    <div data-testid="invalid">
      <h1>{t('title')}</h1>
      <p>{t('text')}</p>
    </div>
  );
}
