'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { AuthSteps } from './AuthSteps';
import { CodeInput } from './CodeInput';
import {
  inviteFinishAction,
  invitePasskeyAction,
  invitePasskeyOptionsAction,
  inviteSendCodeAction,
  inviteTotpConfirmAction,
  inviteTotpStartAction,
  inviteVerifyCodeAction,
  type CodeVia,
} from '@/app/einladung/actions';
import { FactorSetup } from './FactorSetup';
import { RecoveryCodes } from './RecoveryCodes';

type Step = 'send' | 'code' | 'factor' | 'recovery';

/**
 * Einladung annehmen: 1 Code bestätigen, 2 Anmeldung einrichten, 3 Wiederherstellungscodes. Iteration 19 (design
 * D2): one button per channel of the invitation, the code by SMS or by e-mail.
 */
export function InviteFlow({
  token,
  email,
  sms = null,
}: {
  token: string;
  /** Where the e-mail code goes (masked when it is a private address); null without e-mail */
  email: string | null;
  /** Iteration 16: masked mobile number when the invitation came by SMS */
  sms?: string | null;
}) {
  const t = useTranslations('invite');
  const tl = useTranslations('login');
  const [step, setStep] = useState<Step>('send');
  const both = !!sms && !!email;
  const [via, setVia] = useState<CodeVia>(sms ? 'SMS' : 'EMAIL');
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

  const send = (how: CodeVia = via) =>
    start(async () => {
      setError(null);
      setVia(how);
      const r = await inviteSendCodeAction(token, how);
      if (!r.ok) return setError(message(r.error));
      setStep('code');
    });

  const verify = () =>
    start(async () => {
      setError(null);
      const r = await inviteVerifyCodeAction(token, code, via);
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
      <AuthSteps
        label={tl('stepsLabel')}
        current={current}
        steps={labels.map((s) => ({
          key: s,
          label: s !== 'code' ? t(`step_${s}`) : both ? t('step_both') : sms ? t('step_sms') : t('step_code'),
        }))}
      />
      {error ? (
        <div className="banner err" role="alert">
          <p>{error}</p>
        </div>
      ) : null}

      {step === 'send' && both ? (
        <>
          <p>{t('chooseText')}</p>
          <button type="button" className="btn btn--gold" onClick={() => send('SMS')} disabled={pending}>
            {t('sendVia_SMS', { mobile: sms! })}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => send('EMAIL')} disabled={pending}>
            {t('sendVia_EMAIL', { email: email! })}
          </button>
        </>
      ) : step === 'send' ? (
        <>
          <p>{sms ? t('sendSmsText', { mobile: sms }) : t('sendText', { email: email ?? '' })}</p>
          <button type="button" className="btn btn--gold" onClick={() => send()} disabled={pending}>
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
              {via === 'SMS' ? t('smsCode') : tl('code')}
            </label>
            <CodeInput id="invite-code" value={code} onChange={setCode} autoFocus describedBy="invite-code-hint" />
            <p className="muted" id="invite-code-hint" style={{ fontSize: 13, margin: 0 }}>
              {via === 'SMS' ? t('smsCodeHint', { mobile: sms ?? '' }) : tl('codeHint', { email: email ?? '' })}{' '}
              <button type="button" className="linkbtn inline" onClick={() => send()} disabled={pending}>
                {tl('resend')}
              </button>
              {both ? (
                <>
                  {' '}
                  <button
                    type="button"
                    className="linkbtn inline"
                    onClick={() => send(via === 'SMS' ? 'EMAIL' : 'SMS')}
                    disabled={pending}
                  >
                    {via === 'SMS' ? t('switchTo_EMAIL') : t('switchTo_SMS')}
                  </button>
                </>
              ) : null}
            </p>
          </div>
          <button className="btn btn--gold btn--wide" disabled={pending || code.length < 6}>
            {tl('next')}
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
