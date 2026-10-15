'use client';

import { startTransition, useActionState, useEffect, useId, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { accessSheetPrintedAction, inviteToSignAction, type AccessLinkState } from '@/app/(app)/access-link-actions';

/**
 * zone-consent-invitation: "Zur Unterschrift einladen" (iteration 5, design D3, mockup view 1). A dialog with
 * "Per E-Mail", "QR-Code anzeigen" and, once the QR code is shown, "Zugangsblatt drucken". The iPad stays signed in.
 */
export function SignatureInvite({
  patientId,
  name,
  email,
  openOnLoad = false,
  variant = 'gold',
}: {
  patientId: string;
  name: string;
  email: string | null;
  openOnLoad?: boolean;
  variant?: 'gold' | 'ghost';
}) {
  const t = useTranslations('signatureInvite');
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<AccessLinkState, FormData>(inviteToSignAction, {});
  const sheetUrl = useRef<string | null>(null);

  useEffect(() => {
    if (openOnLoad) ref.current?.showModal();
  }, [openOnLoad]);

  useEffect(() => {
    if (state.ok) router.refresh();
    if (state.ok?.channel === 'SCREEN') {
      const bytes = Uint8Array.from(atob(state.ok.accessSheet), (c) => c.charCodeAt(0));
      sheetUrl.current = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    }
    return () => {
      if (sheetUrl.current) URL.revokeObjectURL(sheetUrl.current);
      sheetUrl.current = null;
    };
  }, [state, router]);

  const screen = state.ok?.channel === 'SCREEN' ? state.ok : null;
  const hId = useId();
  return (
    <>
      <button type="button" className={`btn btn--${variant}`} onClick={() => ref.current?.showModal()}>
        {t('invite')}
      </button>
      <dialog ref={ref} className="modal invite" aria-labelledby={hId} data-testid="invite-dialog">
        <h2 id={hId}>{t('invite')}</h2>
        <div className="body">
          <p>{t('intro', { name })}</p>
          {state.ok?.channel === 'EMAIL' ? (
            <div className="banner ok" role="status">
              <p>{t('sentFlash', { to: state.ok.to })}</p>
            </div>
          ) : null}
          {state.error ? (
            <div className="banner err" role="alert">
              <p>{t(state.error as 'errGeneric')}</p>
            </div>
          ) : null}
          {!state.ok ? (
            <div className="invite-options">
              <form action={action}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="channel" value="EMAIL" />
                <button className="btn btn--gold btn--block" disabled={pending || !email}>
                  {email ? t('byEmail', { email }) : t('noEmail')}
                </button>
              </form>
              <form action={action}>
                <input type="hidden" name="patientId" value={patientId} />
                <input type="hidden" name="channel" value="SCREEN" />
                <button className="btn btn--ghost btn--block" disabled={pending}>
                  {t('showQr')}
                </button>
              </form>
            </div>
          ) : null}
          {screen ? (
            <div className="qrbox" data-testid="invite-qr">
              <p className="muted">{t('qrInfo')}</p>
              <div
                className="qr"
                role="img"
                aria-label={t('qrLabel')}
                dangerouslySetInnerHTML={{ __html: screen.qr }}
              />
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  if (sheetUrl.current) window.open(sheetUrl.current, '_blank');
                  const fd = new FormData();
                  fd.set('patientId', patientId);
                  fd.set('linkId', screen.linkId);
                  fd.set('purpose', 'SIGNATURE');
                  startTransition(() => accessSheetPrintedAction(fd));
                }}
              >
                {t('printSheet')}
              </button>
            </div>
          ) : null}
          <p className="muted small">{t('privacy')}</p>
        </div>
        <footer>
          <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()}>
            {t('close')}
          </button>
        </footer>
      </dialog>
    </>
  );
}
