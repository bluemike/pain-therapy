'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  inviteFinishAction,
  invitePasskeyAction,
  invitePasskeyOptionsAction,
  inviteSendCodeAction,
  inviteTotpConfirmAction,
  inviteTotpStartAction,
  inviteVerifyCodeAction,
} from '@/app/einladung/actions';
import { FactorSetup } from './FactorSetup';
import { RecoveryCodes } from './RecoveryCodes';

type Step = 'send' | 'code' | 'factor' | 'recovery';

/** Einladung annehmen: 1 E-Mail bestätigen, 2 Anmeldung einrichten, 3 Wiederherstellungscodes */
export function InviteFlow({ token, email }: { token: string; email: string }) {
  const t = useTranslations('invite');
  const tl = useTranslations('login');
  const [step, setStep] = useState<Step>('send');
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const message = (e: string) =>
    t.has(`error_${e}`)
      ? t(`error_${e}` as never)
      : tl.has(`error_${e}`)
        ? tl(`error_${e}` as never)
        : tl('error_wrong');

  const send = () =>
    start(async () => {
      setError(null);
      const r = await inviteSendCodeAction(token);
      if (!r.ok) return setError(message(r.error));
      setStep('code');
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const r = await inviteVerifyCodeAction(token, code);
      if (!r.ok) return setError(message(r.error));
      setStep('factor');
    });

  const finish = () =>
    start(async () => {
      const r = await inviteFinishAction();
      if (r?.error) setError(message(r.error));
    });

  const labels: Step[] = ['code', 'factor', 'recovery'];
  const current = step === 'send' ? 'code' : step;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <ol className="steps" aria-label={tl('stepsLabel')}>
        {labels.map((s, i) => (
          <li key={s} className={s === current ? 'on' : undefined} aria-current={s === current ? 'step' : undefined}>
            {i + 1} {t(`step_${s}`)}
          </li>
        ))}
      </ol>
      {error ? (
        <div className="banner err" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {step === 'send' ? (
        <>
          <p>{t('sendText', { email })}</p>
          <button type="button" className="btn btn--gold" onClick={send} disabled={pending}>
            {t('send')}
          </button>
        </>
      ) : null}

      {step === 'code' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <div className="f">
            <label className="l" htmlFor="invite-code">
              {tl('code')}
            </label>
            <input
              className="inp code-inp"
              id="invite-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <p className="muted" style={{ fontSize: 13 }}>
              {tl('codeHint', { email })}
            </p>
          </div>
          <button className="btn btn--gold" disabled={pending}>
            {tl('next')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={send} disabled={pending}>
            {tl('resend')}
          </button>
        </form>
      ) : null}

      {step === 'factor' ? (
        <>
          <p>{t('factorText')}</p>
          <FactorSetup
            actions={{
              passkeyOptions: invitePasskeyOptionsAction,
              passkeyRegister: invitePasskeyAction,
              totpStart: inviteTotpStartAction,
              totpConfirm: inviteTotpConfirmAction,
            }}
            onDone={(c) => {
              setCodes(c ?? []);
              setStep('recovery');
            }}
          />
        </>
      ) : null}

      {step === 'recovery' ? <RecoveryCodes codes={codes} onContinue={finish} cta={t('finish')} /> : null}
    </div>
  );
}
