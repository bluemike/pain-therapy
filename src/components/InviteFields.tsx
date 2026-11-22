'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { suggestLocalPart } from '@/lib/mailbox-address';

type Channel = 'SMS' | 'EMAIL';
type Mode = 'NONE' | 'NEW' | 'EXISTING';

/**
 * Invitation fields (iteration 16, design D1, D3): name, by SMS or e-mail, and the mailbox (none, new at
 * pain-therapy.online with a suggestion from the name, or an existing one for the platform admin). Used inside the
 * forms of the team page and the platform page; the server checks everything again (src/lib/onboarding.ts).
 */
export function InviteFields({
  idPrefix,
  domain,
  allowExisting = false,
  mailboxesEnabled = true,
  quotaLeft = null,
}: {
  idPrefix: string;
  domain: string;
  allowExisting?: boolean;
  mailboxesEnabled?: boolean;
  /** Mailboxes the practice may still create; null for no limit (platform admin) */
  quotaLeft?: number | null;
}) {
  const t = useTranslations('onboarding');
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<Channel>('SMS');
  const [mode, setMode] = useState<Mode>('NONE');
  const [localPart, setLocalPart] = useState('');
  const [touched, setTouched] = useState(false);
  const canNew = mailboxesEnabled && (quotaLeft === null || quotaLeft > 0);
  const id = (s: string) => `${idPrefix}_${s}`;
  const lp = touched ? localPart : suggestLocalPart(name);

  const choose = (m: Mode) => {
    setMode(m);
    // A new mailbox is read by nobody yet: its invitation goes by SMS
    if (m === 'NEW') setChannel('SMS');
  };

  return (
    <>
      <div className="f">
        <label className="l" htmlFor={id('name')}>
          {t('name')}
        </label>
        <input
          className="inp"
          id={id('name')}
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <fieldset className="full">
        <legend className="l">{t('channel')}</legend>
        <label className="ck">
          <input
            type="radio"
            name="channel"
            value="SMS"
            checked={channel === 'SMS'}
            onChange={() => setChannel('SMS')}
          />{' '}
          {t('channel_SMS')}
        </label>
        <label className="ck">
          <input
            type="radio"
            name="channel"
            value="EMAIL"
            checked={channel === 'EMAIL'}
            disabled={mode === 'NEW'}
            onChange={() => setChannel('EMAIL')}
          />{' '}
          {t('channel_EMAIL')}
        </label>
      </fieldset>
      <div className="f">
        <label className="l" htmlFor={id('mobile')}>
          {t('mobile')}
        </label>
        <input
          className="inp"
          id={id('mobile')}
          name="mobile"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          maxLength={40}
          required={channel === 'SMS'}
          placeholder="079 123 45 67"
          aria-describedby={id('mobile_hint')}
        />
        <p className="hint" id={id('mobile_hint')}>
          {t('mobileHint')}
        </p>
      </div>
      <fieldset className="full">
        <legend className="l">{t('mailbox')}</legend>
        <label className="ck">
          <input type="radio" name="mailbox" value="NONE" checked={mode === 'NONE'} onChange={() => choose('NONE')} />{' '}
          {t('mailbox_NONE')}
        </label>
        <label className="ck">
          <input
            type="radio"
            name="mailbox"
            value="NEW"
            checked={mode === 'NEW'}
            disabled={!canNew}
            onChange={() => choose('NEW')}
          />{' '}
          {t('mailbox_NEW', { domain })}
        </label>
        {allowExisting ? (
          <label className="ck">
            <input
              type="radio"
              name="mailbox"
              value="EXISTING"
              checked={mode === 'EXISTING'}
              disabled={!mailboxesEnabled}
              onChange={() => choose('EXISTING')}
            />{' '}
            {t('mailbox_EXISTING')}
          </label>
        ) : null}
        {!mailboxesEnabled ? (
          <p className="hint">{t('mailboxOff')}</p>
        ) : quotaLeft !== null ? (
          <p className="hint">{quotaLeft > 0 ? t('quotaLeft', { count: quotaLeft }) : t('quotaReached')}</p>
        ) : null}
      </fieldset>
      {mode === 'NONE' ? (
        <div className="f full">
          <label className="l" htmlFor={id('email')}>
            {t('email')}
          </label>
          <input
            className="inp"
            id={id('email')}
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="off"
          />
        </div>
      ) : (
        <div className="f full">
          <label className="l" htmlFor={id('localPart')}>
            {t(mode === 'NEW' ? 'address' : 'existingAddress')}
          </label>
          <span className="addr-inp">
            <input
              className="inp"
              id={id('localPart')}
              name="localPart"
              required
              maxLength={64}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={lp}
              onChange={(e) => {
                setTouched(true);
                setLocalPart(e.target.value.toLowerCase());
              }}
            />
            <span className="muted">@{domain}</span>
          </span>
          <p className="hint">{t(mode === 'NEW' ? 'addressHint' : 'existingHint')}</p>
        </div>
      )}
    </>
  );
}
