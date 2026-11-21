import { getFormatter, getTranslations } from 'next-intl/server';
import { lookupHandoff } from '@/lib/photo-handoff';
import { HandoffUploader } from '@/components/HandoffUploader';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Foto', referrer: 'no-referrer' };

/**
 * Fotos mit dem Smartphone (iteration 15, design D5): the page behind the QR code. No sign-in; it shows only the
 * practice and the check code, never the patient, and can only upload.
 */
export default async function PhotoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [t, format, link] = await Promise.all([getTranslations('handoff'), getFormatter(), lookupHandoff(token)]);
  return (
    <div className="app">
      <main className="center" id="main">
        <div className="lcard handoff-phone">
          {!link ? (
            <>
              <h1>{t('phoneInvalidTitle')}</h1>
              <p>{t('phoneInvalid')}</p>
            </>
          ) : (
            <>
              <p className="muted">{link.practiceName}</p>
              <h1>{t('phoneTitle')}</h1>
              <p>
                {t('phoneCheck')} <b className="checkcode">{link.checkCode}</b>
              </p>
              {link.open ? (
                <>
                  <p className="muted">
                    {t('phoneUntil', {
                      time: format.dateTime(link.expiresAt, { timeStyle: 'short', timeZone: 'Europe/Zurich' }),
                    })}
                  </p>
                  <HandoffUploader token={token} remaining={link.remaining} />
                </>
              ) : (
                <p className="banner err" role="alert">
                  {link.remaining ? t('phoneExpired') : t('phoneFull')}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
