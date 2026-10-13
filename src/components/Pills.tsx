import { getTranslations } from 'next-intl/server';
import type { ConsentStatus } from '@/lib/patients';

export async function ConsentPill({ status }: { status: ConsentStatus }) {
  const t = await getTranslations('consentStatus');
  const cls = status === 'signed' ? 'ok' : status === 'resign' ? 'warn' : 'err';
  return <span className={`pill ${cls}`}>{t(status)}</span>;
}

export async function StatusPill({ active }: { active: boolean }) {
  const t = await getTranslations('common');
  return <span className={`pill ${active ? 'ok' : 'off'}`}>{active ? t('active') : t('inactive')}</span>;
}
