'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { revealAccessAction, type RevealResult } from '@/app/(app)/postfach/actions';

/**
 * Shows the mailbox access once (iteration 16, design D4): password to copy, the Apple profile behind a one-time
 * link and the settings for Outlook. After a reload the password is gone for good.
 */
export function MailboxReveal({ fresh }: { fresh: boolean }) {
  const t = useTranslations('mailbox');
  const [shown, setShown] = useState<Extract<RevealResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const reveal = () =>
    start(async () => {
      setError(null);
      const r = await revealAccessAction();
      if (r.ok) setShown(r);
      else setError(t(r.error === 'reauth' ? 'error_reauth' : 'error_notFound'));
    });

  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!shown)
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {error ? (
          <div className="banner err" role="alert">
            <p>{error}</p>
          </div>
        ) : null}
        <p>{t(fresh ? 'readyFresh' : 'ready')}</p>
        <button type="button" className="btn btn--gold" onClick={reveal} disabled={pending}>
          {t('reveal')}
        </button>
      </div>
    );

  return (
    <div style={{ display: 'grid', gap: 14 }} data-testid="mailbox-access">
      <div className="banner warn" role="status">
        <p>{t('onceOnly')}</p>
      </div>
      <div className="secret">
        <code data-testid="mailbox-password">{shown.password}</code>
        <button type="button" className="btn btn--ghost" onClick={copy}>
          {copied ? t('copied') : t('copy')}
        </button>
      </div>
      <a className="btn btn--gold" href={shown.profilePath} download>
        {t('profile')}
      </a>
      <p className="muted small">{t('profileHint')}</p>
      <h3>{t('outlook')}</h3>
      <dl className="kv">
        <dt>{t('account')}</dt>
        <dd>{shown.address}</dd>
        <dt>{t('type')}</dt>
        <dd>IMAP</dd>
        <dt>{t('incoming')}</dt>
        <dd>
          {shown.host} · {shown.imapPort} · SSL
        </dd>
        <dt>{t('outgoing')}</dt>
        <dd>
          {shown.host} · {shown.smtpPort} · SSL
        </dd>
      </dl>
      {fresh ? (
        <Link className="btn btn--ghost" href="/">
          {t('toApp')}
        </Link>
      ) : null}
    </div>
  );
}
