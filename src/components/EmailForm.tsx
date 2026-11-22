'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { CodeInput } from './auth/CodeInput';
import { emailConfirmAction, emailSendCodeAction } from '@/app/(app)/profile/actions';

/**
 * Anmeldeadresse under «Mein Profil» (iteration 16, Nachtrag): new address, code by email to it, confirm. The account,
 * its passkeys and memberships stay.
 */
export function EmailForm({ current }: { current: string }) {
  const t = useTranslations('profile');
  const tl = useTranslations('login');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [now, setNow] = useState(current);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const error = (e: string) =>
    t.has(`emailError_${e}`)
      ? t(`emailError_${e}` as never)
      : tl.has(`error_${e}`)
        ? tl(`error_${e}` as never)
        : tl('error_wrong');

  const send = () =>
    start(async () => {
      setMsg(null);
      const r = await emailSendCodeAction(email);
      if (!r.ok) return setMsg({ ok: false, text: error(r.error) });
      setSentTo(email.trim().toLowerCase());
    });
  const confirm = () =>
    start(async () => {
      const r = await emailConfirmAction(code);
      if (!r.ok) return setMsg({ ok: false, text: error(r.error) });
      setNow(sentTo ?? now);
      setSentTo(null);
      setCode('');
      setEmail('');
      setMsg({ ok: true, text: t('emailSaved') });
    });

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {msg ? (
        <div className={`banner ${msg.ok ? 'ok' : 'err'}`} role={msg.ok ? 'status' : 'alert'}>
          <p>{msg.text}</p>
        </div>
      ) : null}
      <p>{t('emailCurrent', { email: now })}</p>
      {sentTo ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
          style={{ display: 'grid', gap: 10 }}
        >
          <label className="l" htmlFor="email-code">
            {t('emailCode', { email: sentTo })}
          </label>
          <CodeInput id="email-code" value={code} onChange={setCode} autoFocus />
          <button className="btn btn--gold" disabled={pending || code.length < 6}>
            {t('emailConfirm')}
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
          <label className="l" htmlFor="email-new">
            {t('emailNew')}
          </label>
          <input
            className="inp"
            id="email-new"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={200}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn btn--ghost" disabled={pending || !email.includes('@')}>
            {t('emailSend')}
          </button>
        </form>
      )}
    </div>
  );
}
