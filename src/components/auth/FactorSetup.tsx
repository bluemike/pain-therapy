'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/browser';

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type FactorActions = {
  passkeyOptions: () => Promise<R<{ options: PublicKeyCredentialCreationOptionsJSON }>>;
  passkeyRegister: (response: RegistrationResponseJSON) => Promise<R<{ codes?: string[] }>>;
  totpStart: () => Promise<R<{ secret: string; qrSvg: string }>>;
  totpConfirm: (code: string) => Promise<R<{ codes?: string[] }>>;
};

/**
 * Setting up a second factor (therapist-login, design D2): a passkey on this device (recommended), or the
 * authenticator app with QR code and a first code to confirm it.
 */
export function FactorSetup({
  actions,
  onDone,
  only,
}: {
  actions: FactorActions;
  onDone: (codes?: string[]) => void;
  /** Show only one of the two ways (page "Anmeldung") */
  only?: 'passkey' | 'totp';
}) {
  const t = useTranslations('factors');
  const [totp, setTotp] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const message = (e: string) => (t.has(`error_${e}`) ? t(`error_${e}` as never) : t('error_wrong'));

  const passkey = () =>
    start(async () => {
      setError(null);
      if (!browserSupportsWebAuthn()) return setError(t('error_noWebAuthn'));
      const o = await actions.passkeyOptions();
      if (!o.ok) return setError(message(o.error));
      let response: RegistrationResponseJSON;
      try {
        response = await startRegistration({ optionsJSON: o.options });
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        return setError(name === 'InvalidStateError' ? t('error_passkeyExists') : t('error_passkeyCancelled'));
      }
      const r = await actions.passkeyRegister(response);
      if (!r.ok) return setError(message(r.error));
      onDone(r.codes);
    });

  const startTotp = () =>
    start(async () => {
      setError(null);
      const r = await actions.totpStart();
      if (!r.ok) return setError(message(r.error));
      setTotp({ secret: r.secret, qrSvg: r.qrSvg });
    });

  const confirmTotp = () =>
    start(async () => {
      setError(null);
      const r = await actions.totpConfirm(code);
      if (!r.ok) return setError(message(r.error));
      onDone(r.codes);
    });

  return (
    <div className="factor-setup" style={{ display: 'grid', gap: 12 }}>
      {error ? (
        <div className="banner err" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {!totp ? (
        <>
          {only !== 'totp' ? (
            <button
              type="button"
              className="btn btn--dark"
              style={{ minHeight: 50 }}
              onClick={passkey}
              disabled={pending}
            >
              {t('passkey')}
            </button>
          ) : null}
          {only !== 'passkey' ? (
            <button type="button" className="btn btn--ghost" onClick={startTotp} disabled={pending}>
              {only === 'totp' ? t('totpOnly') : t('totpInstead')}
            </button>
          ) : null}
          {only !== 'totp' ? (
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              {t('passkeyHint')}
            </p>
          ) : null}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmTotp();
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <p>{t('totpScan')}</p>
          <div
            className="totp-qr"
            role="img"
            aria-label={t('totpQr')}
            style={{ width: 200, height: 200, background: '#fff', padding: 8, borderRadius: 8 }}
            dangerouslySetInnerHTML={{ __html: totp.qrSvg }}
          />
          <p className="muted" style={{ fontSize: 13 }}>
            {t('totpManual')} <code data-testid="totp-secret">{totp.secret.replace(/(.{4})/g, '$1 ').trim()}</code>
          </p>
          <div className="f">
            <label className="l" htmlFor="totp-confirm">
              {t('totpCode')}
            </label>
            <input
              className="inp code-inp"
              id="totp-confirm"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button className="btn btn--gold" disabled={pending}>
            {t('totpConfirm')}
          </button>
        </form>
      )}
    </div>
  );
}
