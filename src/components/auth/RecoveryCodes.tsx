'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

/** The 10 recovery codes, shown once (therapist-login: Erste Einrichtung und Wiederherstellung) */
export function RecoveryCodes({ codes, onContinue, cta }: { codes: string[]; onContinue: () => void; cta: string }) {
  const t = useTranslations('factors');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>{t('recoveryTitle')}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {t('recoveryText')}
      </p>
      <ul
        className="recovery-codes"
        data-testid="recovery-codes"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(codes.join('\n'));
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? t('recoveryCopied') : t('recoveryCopy')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
          {t('recoveryPrint')}
        </button>
      </div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        {t('recoverySaved')}
      </label>
      <button type="button" className="btn btn--gold" disabled={!saved} onClick={onContinue}>
        {cta}
      </button>
    </div>
  );
}
