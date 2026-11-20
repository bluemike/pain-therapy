'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AuthSteps } from '@/components/auth/AuthSteps';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import {
  passkeyOptionsAction,
  passkeySignInAction,
  requestCodeAction,
  secondFactorAction,
  verifyCodeAction,
} from './actions';

type Step = 'email' | 'code' | 'second';

/**
 * Sign-in (therapist-login): passkey, or email address → code from the email → code of the authenticator app (or a
 * recovery code).
 */
export function LoginForm({ hint, callbackUrl }: { hint?: string; callbackUrl: string }) {
  const t = useTranslations('login');
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState(hint ?? '');
  const [code, setCode] = useState('');
  const [second, setSecond] = useState('');
  const [hasTotp, setHasTotp] = useState(true);
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const message = (e: string) => (t.has(`error_${e}`) ? t(`error_${e}` as never) : t('error_wrong'));

  const passkey = () =>
    start(async () => {
      setError(null);
      if (!browserSupportsWebAuthn()) return setError(t('error_noWebAuthn'));
      try {
        const optionsJSON = await passkeyOptionsAction();
        const response = await startAuthentication({ optionsJSON });
        const r = await passkeySignInAction(response, callbackUrl);
        if (r?.error) setError(message(r.error));
      } catch (e) {
        // NotAllowedError: cancelled or timed out on the device
        if (e instanceof Error && e.name === 'NotAllowedError') return setError(t('error_passkeyCancelled'));
        throw e;
      }
    });

  const sendCode = (again = false) =>
    start(async () => {
      setError(null);
      const r = await requestCodeAction(email);
      if (!r.ok) return setError(message(r.error));
      setInfo(again ? t('codeResent') : t('codeSent'));
      setCode('');
      setStep('code');
    });

  const confirmCode = () =>
    start(async () => {
      setError(null);
      const r = await verifyCodeAction(email, code);
      if (!r.ok) return setError(message(r.error));
      setInfo(null);
      setHasTotp(!!r.totp);
      setUseRecovery(!r.totp);
      setStep('second');
    });

  const finish = () =>
    start(async () => {
      setError(null);
      const r = await secondFactorAction(second, callbackUrl);
      if (r?.error) {
        if (r.error === 'expired') setStep('email');
        setError(message(r.error));
      }
    });

  const steps = (
    <AuthSteps
      label={t('stepsLabel')}
      current={step}
      steps={(['email', 'code', 'second'] as Step[]).map((s) => ({ key: s, label: t(`step_${s}`) }))}
    />
  );

  return (
    <div className="login-flow">
      <button
        type="button"
        className="btn btn--dark"
        style={{ width: '100%', minHeight: 50 }}
        onClick={passkey}
        disabled={pending}
      >
        {t('passkey')}
      </button>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>
        {t('passkeyHint')}
      </p>
      <div className="or" role="separator">
        {t('orEmail')}
      </div>
      {steps}
      {error ? (
        <div className="banner err" role="alert">
          <p>{error}</p>
        </div>
      ) : info ? (
        <div className="banner info" role="status">
          <p>{info}</p>
        </div>
      ) : null}

      {step === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
        >
          <div className="f">
            <label className="l" htmlFor="login-email">
              {t('email')}
            </label>
            <input
              className="inp"
              id="login-email"
              type="email"
              autoComplete="username webauthn"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button className="btn btn--gold" style={{ width: '100%' }} disabled={pending || !email}>
            {t('sendCode')}
          </button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirmCode();
          }}
        >
          <div className="f">
            <label className="l" htmlFor="login-code">
              {t('code')}
            </label>
            <input
              className="inp code-inp"
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]{6,7}"
              maxLength={7}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="muted" style={{ fontSize: 13 }}>
              {t('codeHint', { email })}
            </p>
          </div>
          <button className="btn btn--gold" style={{ width: '100%' }} disabled={pending}>
            {t('next')}
          </button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--ghost" onClick={() => sendCode(true)} disabled={pending}>
              {t('resend')}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setStep('email');
                setInfo(null);
                setError(null);
              }}
            >
              {t('otherEmail')}
            </button>
          </div>
        </form>
      ) : null}

      {step === 'second' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            finish();
          }}
        >
          <div className="f">
            <label className="l" htmlFor="login-second">
              {useRecovery ? t('recovery') : t('totp')}
            </label>
            <input
              className="inp code-inp"
              id="login-second"
              inputMode={useRecovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              required
              autoFocus
              value={second}
              onChange={(e) => setSecond(e.target.value)}
            />
            <p className="muted" style={{ fontSize: 13 }}>
              {useRecovery ? (hasTotp ? t('recoveryHint') : t('noTotpHint')) : t('totpHint')}
            </p>
          </div>
          <button className="btn btn--gold" style={{ width: '100%' }} disabled={pending}>
            {t('submit')}
          </button>
          {hasTotp ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setSecond('');
              }}
            >
              {useRecovery ? t('useTotp') : t('useRecovery')}
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
