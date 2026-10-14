import { getTranslations } from 'next-intl/server';
import type { LinkStatus } from '@/lib/patient-access';

const TONE: Record<LinkStatus, string> = {
  none: 'off',
  sent: '',
  shown: '',
  printed: '',
  active: 'ok',
  locked: 'warn',
  blocked: 'err',
  revoked: 'err',
  replaced: 'off',
  expired: 'off',
};

/** patient-access: Status in der Akte (design D3) */
export async function LinkStatusPill({ status }: { status: LinkStatus }) {
  const t = await getTranslations('linkStatus');
  return <span className={`pill ${TONE[status] || 'off'}`}>{t(status)}</span>;
}
