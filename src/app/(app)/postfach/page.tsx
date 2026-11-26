import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { mailboxOf, sweepMailboxes } from '@/lib/mailboxes';
import { formatDate, formatDateTime } from '@/lib/format';
import { MailboxReveal } from '@/components/MailboxReveal';
import { requestAccessAction } from './actions';

export const dynamic = 'force-dynamic';

/**
 * mailbox-provisioning (iteration 16, design D4): «Mein E-Mail-Postfach». Right after accepting an invitation with a
 * mailbox the app lands here; later it is reached from «Mein Profil».
 */
export default async function MailboxPage({ searchParams }: { searchParams: Promise<{ neu?: string }> }) {
  const user = await requireUser();
  await sweepMailboxes().catch((e) => console.error('Mailbox sweep failed', e instanceof Error ? e.message : e));
  const [t, mb, sp] = await Promise.all([getTranslations('mailbox'), mailboxOf(user.id), searchParams]);
  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{mb ? mb.address : t('none')}</div>
        </div>
        <Link className="btn btn--ghost" href="/profile">
          {t('toProfile')}
        </Link>
      </div>
      {mb ? (
        <section className="card mailbox-card" aria-labelledby="h_access">
          <h2 id="h_access">{t('access')}</h2>
          {mb.access === 'READY' || mb.access === 'DELIVERED' ? (
            <MailboxReveal fresh={sp.neu === '1'} ready={mb.access === 'READY'}>
              <p>{t('delivered', { at: formatDateTime(mb.deliveredAt ?? new Date()) })}</p>
              <form action={requestAccessAction}>
                <button className="btn btn--gold">{t('request')}</button>
              </form>
              <p className="muted small">{t('requestHint')}</p>
            </MailboxReveal>
          ) : (
            <>
              <p>{t('preparing')}</p>
              {mb.requestedAt ? (
                <p className="muted small">{t('requestedAt', { date: formatDate(mb.requestedAt) })}</p>
              ) : null}
            </>
          )}
        </section>
      ) : (
        <p className="muted">{t('noneHint')}</p>
      )}
      {sp.neu === '1' && mb?.access !== 'READY' && mb?.access !== 'DELIVERED' ? (
        <Link className="btn btn--gold" href="/">
          {t('toApp')}
        </Link>
      ) : null}
    </>
  );
}
