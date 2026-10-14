'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  accessSheetPrintedAction,
  revokeAccessLinkAction,
  sendAccessLinkAction,
  type AccessLinkState,
} from '@/app/(app)/access-link-actions';

/**
 * patient-access: "Link senden" and "Link sperren" (Link senden aus der Akte, Link sperren; mockup view 4). Without
 * consent to unencrypted email the QR code appears here for the patient to scan, with "Zugangsblatt drucken".
 */
export function AccessLinkPanel({
  patientId,
  canSend,
  canRevoke,
}: {
  patientId: string;
  canSend: boolean;
  canRevoke: boolean;
}) {
  const t = useTranslations('exerciseLog');
  const router = useRouter();
  const [state, action, pending] = useActionState<AccessLinkState, FormData>(sendAccessLinkAction, {});
  const sheetUrl = useRef<string | null>(null);

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
  return (
    <div className="linkpanel">
      {state.ok?.channel === 'EMAIL' ? (
        <div className="banner ok" role="status">
          <p>{t('linkSentFlash', { to: state.ok.to })}</p>
        </div>
      ) : null}
      {state.error ? (
        <div className="banner err" role="alert">
          <p>{t(state.error as 'linkError')}</p>
        </div>
      ) : null}
      <div className="actions">
        {canSend ? (
          <form action={action}>
            <input type="hidden" name="patientId" value={patientId} />
            <button className="btn btn--gold" disabled={pending}>
              {t('sendLink')}
            </button>
          </form>
        ) : null}
        {canRevoke ? (
          <form action={revokeAccessLinkAction}>
            <input type="hidden" name="patientId" value={patientId} />
            <button className="btn btn--danger">{t('revokeLink')}</button>
          </form>
        ) : null}
      </div>
      {screen ? (
        <div className="qrbox" data-testid="access-qr">
          <div className="banner info">
            <p>{t('qrInfo')}</p>
          </div>
          <div className="qr" role="img" aria-label={t('qrLabel')} dangerouslySetInnerHTML={{ __html: screen.qr }} />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (sheetUrl.current) window.open(sheetUrl.current, '_blank');
              const fd = new FormData();
              fd.set('patientId', patientId);
              fd.set('linkId', screen.linkId);
              startTransition(() => accessSheetPrintedAction(fd));
            }}
          >
            {t('printSheet')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
