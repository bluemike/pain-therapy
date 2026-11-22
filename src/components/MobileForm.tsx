'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CodeInput } from './auth/CodeInput';
import { mobileConfirmAction, mobileSendCodeAction } from '@/app/(app)/profile/actions';

/** Handynummer under «Mein Profil» (iteration 16, design D7): new number, code by SMS to it, confirm */
export function MobileForm({ current }: { current: string | null }) {
  const t = useTranslations('profile');
  const to = useTranslations('onboarding');
  const tl = useTranslations('login');
  const [mobile, setMobile] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const error = (e: string) =>
    to.has(`error_${e}`)
      ? to(`error_${e}` as never)
      : tl.has(`error_${e}`)
        ? tl(`error_${e}` as never)
        : tl('error_wrong');

  const send = () =>
    start(async () => {
      setMsg(null);
      const r = await mobileSendCodeAction(mobile);
      if (!r.ok) return setMsg({ ok: false, text: error(r.error) });
      setSentTo(r.masked ?? mobile);
    });
  const confirm = () =>
    start(async () => {
      const r = await mobileConfirmAction(code);
      if (!r.ok) return setMsg({ ok: false, text: error(r.error) });
      setSentTo(null);
      setCode('');
      setMobile('');
      setMsg({ ok: true, text: t('mobileSaved') });
    });

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {msg ? (
        <div className={`banner ${msg.ok ? 'ok' : 'err'}`} role={msg.ok ? 'status' : 'alert'}>
          <p>{msg.text}</p>
        </div>
      ) : null}
      <p>{current ? t('mobileCurrent', { mobile: current }) : t('mobileNone')}</p>
      {sentTo ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
          style={{ display: 'grid', gap: 10 }}
        >
          <label className="l" htmlFor="mobile-code">
            {t('mobileCode', { mobile: sentTo })}
          </label>
          <CodeInput id="mobile-code" value={code} onChange={setCode} autoFocus />
          <button className="btn btn--gold" disabled={pending || code.length < 6}>
            {t('mobileConfirm')}
          </button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="row-form"
        >
          <label className="l" htmlFor="mobile-new">
            {t('mobileNew')}
          </label>
          <input
            className="inp"
            id="mobile-new"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="079 123 45 67"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
          <button className="btn btn--ghost" disabled={pending || mobile.trim().length < 6}>
            {t('mobileSend')}
          </button>
        </form>
      )}
    </div>
  );
}
