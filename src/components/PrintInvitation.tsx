'use client';

import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useFormatter, useTranslations } from 'next-intl';
import type { InvitationSheet } from '@/lib/invitation-sheet';

/**
 * Iteration 19 (design D3): «Einladung drucken» at an open invitation. Says first that a new link replaces the one of
 * the SMS and the mail, then shows the A4 sheet (QR code, short link, valid until, five steps) and opens the print
 * dialog. The sheet never shows a code.
 */
export function PrintInvitation({
  print,
}: {
  print: () => Promise<{ ok: true; sheet: InvitationSheet } | { ok: false }>;
}) {
  const t = useTranslations('invitePrint');
  const f = useFormatter();
  const [step, setStep] = useState<'idle' | 'confirm' | 'error'>('idle');
  const [sheet, setSheet] = useState<InvitationSheet | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!sheet) return;
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [sheet]);

  const go = () =>
    start(async () => {
      const r = await print();
      if (!r.ok) return setStep('error');
      setStep('idle');
      setSheet(r.sheet);
    });

  return (
    <>
      {step === 'confirm' ? (
        <span className="print-confirm" role="group" aria-label={t('button')}>
          <span className="muted small">{t('warning')}</span>
          <button type="button" className="btn btn--gold" onClick={go} disabled={pending}>
            {t('confirm')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setStep('idle')} disabled={pending}>
            {t('cancel')}
          </button>
        </span>
      ) : (
        <button type="button" className="btn btn--ghost" onClick={() => setStep('confirm')}>
          {t('button')}
        </button>
      )}
      {step === 'error' ? (
        <span className="muted small" role="alert">
          {t('error')}
        </span>
      ) : null}
      {sheet
        ? createPortal(
            <div className="invite-print" role="dialog" aria-modal="true" aria-labelledby="invite-print-title">
              <div className="invite-print__bar">
                <button type="button" className="btn btn--gold" onClick={() => window.print()}>
                  {t('printAgain')}
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => setSheet(null)}>
                  {t('close')}
                </button>
              </div>
              <article className="invite-print__page">
                <header className="invite-print__head">
                  <b>Pain Therapy</b>
                  {sheet.practiceName ? <span>{sheet.practiceName}</span> : null}
                </header>
                <h1 id="invite-print-title">{sheet.name ? t('title', { name: sheet.name }) : t('titleNoName')}</h1>
                <p>{sheet.practiceName ? t('intro', { practice: sheet.practiceName }) : t('introPlatform')}</p>
                <div className="invite-print__qr">
                  <div role="img" aria-label={t('qrLabel')} dangerouslySetInnerHTML={{ __html: sheet.qrSvg }} />
                  <div>
                    <p className="invite-print__label">{t('orType')}</p>
                    <p className="invite-print__link">{sheet.shortLabel}</p>
                    <p>
                      {t('validUntil', {
                        date: f.dateTime(new Date(sheet.expiresAt), {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        }),
                      })}
                    </p>
                    <p>{t('signIn', { email: sheet.email })}</p>
                  </div>
                </div>
                <h2>{t('stepsTitle')}</h2>
                <ol>
                  <li>{t('step1')}</li>
                  <li>{t('step2')}</li>
                  <li>{t('step3')}</li>
                  <li>{sheet.mailbox ? t('step4Mailbox') : t('step4')}</li>
                  <li>{t('step5')}</li>
                </ol>
                <p className="invite-print__foot">{t('foot')}</p>
              </article>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
