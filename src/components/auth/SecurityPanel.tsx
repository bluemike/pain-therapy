'use client';

import { useState, useTransition } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  addPasskeyAction,
  addPasskeyOptionsAction,
  newRecoveryCodesAction,
  removePasskeyAction,
  removeTotpAction,
  totpConfirmAction,
  totpStartAction,
} from '@/app/(app)/profile/security/actions';
import { FactorSetup } from './FactorSetup';
import { RecoveryCodes } from './RecoveryCodes';

type Factors = {
  totp: boolean;
  recoveryCodesLeft: number;
  passkeys: { id: string; label: string; createdAt: string; lastUsedAt: string | null }[];
};

export function SecurityPanel({ factors }: { factors: Factors }) {
  const t = useTranslations('security');
  const tf = useTranslations('factors');
  const format = useFormatter();
  const router = useRouter();
  const [adding, setAdding] = useState<'passkey' | 'totp' | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const message = (e: string) => (t.has(`error_${e}`) ? t(`error_${e}` as never) : tf('error_wrong'));
  const date = (iso: string) => format.dateTime(new Date(iso), { day: '2-digit', month: '2-digit', year: 'numeric' });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      setError(null);
      setFlash(null);
      const r = await fn();
      if (!r.ok) return setError(message(r.error ?? 'wrong'));
      if (done) setFlash(done);
      router.refresh();
    });

  if (codes)
    return (
      <section className="card" style={{ padding: 20 }}>
        <RecoveryCodes codes={codes} cta={t('done')} onContinue={() => setCodes(null)} />
      </section>
    );

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 640 }}>
      {error ? (
        <div className="banner err" role="alert">
          <p>{error}</p>
        </div>
      ) : flash ? (
        <div className="banner ok" role="status">
          <p>{flash}</p>
        </div>
      ) : null}

      <section className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t('passkeys')}</h2>
        {factors.passkeys.length ? (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {factors.passkeys.map((p) => (
              <li key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  <b>{p.label}</b>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {' · '}
                    {t('added', { date: date(p.createdAt) })}
                    {p.lastUsedAt ? ` · ${t('lastUsed', { date: date(p.lastUsedAt) })}` : ''}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={pending}
                  onClick={() => run(() => removePasskeyAction(p.id), t('removed'))}
                >
                  {t('remove')}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('noPasskeys')}</p>
        )}
        {adding === 'passkey' ? (
          <FactorSetup
            only="passkey"
            actions={{
              passkeyOptions: addPasskeyOptionsAction,
              passkeyRegister: addPasskeyAction,
              totpStart: totpStartAction,
              totpConfirm: totpConfirmAction,
            }}
            onDone={() => {
              setAdding(null);
              setFlash(t('passkeyAdded'));
              router.refresh();
            }}
          />
        ) : (
          <button type="button" className="btn btn--dark" onClick={() => setAdding('passkey')}>
            {t('addPasskey')}
          </button>
        )}
      </section>

      <section className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t('totp')}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {factors.totp ? t('totpOn') : t('totpOff')}
        </p>
        {adding === 'totp' ? (
          <FactorSetup
            only="totp"
            actions={{
              passkeyOptions: addPasskeyOptionsAction,
              passkeyRegister: addPasskeyAction,
              totpStart: totpStartAction,
              totpConfirm: totpConfirmAction,
            }}
            onDone={() => {
              setAdding(null);
              setFlash(t('totpAdded'));
              router.refresh();
            }}
          />
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--ghost" onClick={() => setAdding('totp')}>
              {factors.totp ? t('totpReplace') : t('totpAdd')}
            </button>
            {factors.totp ? (
              <button
                type="button"
                className="btn btn--ghost"
                disabled={pending}
                onClick={() => run(removeTotpAction, t('totpRemoved'))}
              >
                {t('remove')}
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className="card" style={{ padding: 20, display: 'grid', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t('recovery')}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t('recoveryLeft', { count: factors.recoveryCodesLeft })}
        </p>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const r = await newRecoveryCodesAction();
              if (!r.ok) return setError(message(r.error));
              setCodes(r.codes);
            })
          }
        >
          {t('recoveryNew')}
        </button>
      </section>
    </div>
  );
}
