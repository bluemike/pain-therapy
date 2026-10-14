'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createHandoutAction, type HandoutState } from '@/app/(app)/handout-actions';

/**
 * exercise-handout: Versand oder Ausdruck (design D6, mockup view 2). Email only with consent and address, otherwise
 * print. "Drucken" opens the archived PDF in a new tab; the tab is opened on the tap itself so it is not blocked.
 *
 * patient-access: "Link zur Patienten-Zone mitsenden" (iteration 4, design D4), selected by default and shown only
 * once the patient zone is set up. A printout with link opens the copy with the access sheet, which exists only in
 * this browser; the archived PDF has no link.
 */
export function HandoutPanel({
  consultationId,
  canEmail,
  emailTo,
  emailNote,
  previewHref,
  laterHref,
  zoneEnabled,
}: {
  consultationId: string;
  canEmail: boolean;
  emailTo: string | null;
  /** Consent line, or why email is not possible */
  emailNote: string;
  previewHref: string;
  laterHref: string;
  /** PATIENT_ZONE_URL is set and the patient has an active home program */
  zoneEnabled: boolean;
}) {
  const t = useTranslations('handout');
  const router = useRouter();
  const [channel, setChannel] = useState<'EMAIL' | 'PRINT'>(canEmail ? 'EMAIL' : 'PRINT');
  const [state, action, pending] = useActionState<HandoutState, FormData>(createHandoutAction, {});
  const printWindow = useRef<Window | null>(null);

  useEffect(() => {
    if (state.ok) {
      if (state.ok.channel === 'PRINT' && printWindow.current) {
        if (state.ok.printPdf) {
          const bytes = Uint8Array.from(atob(state.ok.printPdf), (c) => c.charCodeAt(0));
          printWindow.current.location.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        } else printWindow.current.location.href = `/documents/${state.ok.id}`;
      }
      printWindow.current = null;
      router.refresh();
    } else if (state.error) {
      printWindow.current?.close();
      printWindow.current = null;
    }
  }, [state, router]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (channel === 'PRINT') printWindow.current = window.open('about:blank', '_blank');
        startTransition(() => action(fd));
      }}
    >
      <input type="hidden" name="consultationId" value={consultationId} />
      {state.ok ? (
        <div className="banner ok" role="status">
          <p>
            {state.ok.channel === 'EMAIL'
              ? t('sent', { number: state.ok.number, to: state.ok.to ?? '' })
              : t('printed', { number: state.ok.number })}
            {state.ok.withLink ? ` ${state.ok.channel === 'EMAIL' ? t('linkSent') : t('linkPrinted')}` : ''}
          </p>
          {state.ok.channel === 'PRINT' ? (
            <a className="btn btn--ghost" href={`/documents/${state.ok.id}`} target="_blank" rel="noopener">
              {t('openPrint')}
            </a>
          ) : null}
        </div>
      ) : null}
      {state.error ? (
        <div className="banner err" role="alert">
          <p>{t(state.error as 'error')}</p>
        </div>
      ) : null}
      <fieldset className="choice">
        <legend>{t('create')}</legend>
        <label className={`card ${channel === 'EMAIL' ? 'on' : ''} ${canEmail ? '' : 'off'}`}>
          <input
            type="radio"
            name="channel"
            value="EMAIL"
            checked={channel === 'EMAIL'}
            disabled={!canEmail}
            onChange={() => setChannel('EMAIL')}
          />
          <span>
            <b>{t('email')}</b>
            {emailTo ? <span className="d">{t('emailTo', { to: emailTo })}</span> : null}
            <small>{emailNote}</small>
          </span>
        </label>
        <label className={`card ${channel === 'PRINT' ? 'on' : ''}`}>
          <input
            type="radio"
            name="channel"
            value="PRINT"
            checked={channel === 'PRINT'}
            onChange={() => setChannel('PRINT')}
          />
          <span>
            <b>{t('print')}</b>
            <span className="d">{t('printText')}</span>
            <small>{t('printNote')}</small>
          </span>
        </label>
      </fieldset>
      {zoneEnabled ? (
        <label className="check">
          <input type="checkbox" name="withLink" defaultChecked />
          <span>
            <b>{t('withLink')}</b>
            <small>{channel === 'EMAIL' ? t('withLinkEmail') : t('withLinkPrint')}</small>
          </span>
        </label>
      ) : null}
      <p className="hint">{t('onDemand')}</p>
      <div className="formbar">
        <a className="btn btn--ghost" href={previewHref} target="_blank" rel="noopener">
          {t('preview')}
        </a>
        <div className="actions">
          {pending ? (
            <span className="muted">
              <progress aria-label={t('working')} /> {t('working')}
            </span>
          ) : null}
          <Link className="btn btn--ghost" href={laterHref}>
            {t('later')}
          </Link>
          <button type="submit" className="btn btn--gold" disabled={pending}>
            {channel === 'EMAIL' ? t('send') : t('print')}
          </button>
        </div>
      </div>
    </form>
  );
}
