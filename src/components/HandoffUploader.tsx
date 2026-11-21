'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Check } from 'lucide-react';
import { processPhoto } from '@/lib/photo-client';

type Sent = { key: string; url: string };

/**
 * Fotos mit dem Smartphone (iteration 15, design D5): takes photos with the phone camera, resizes them in the browser
 * like the photo field (location removed) and sends them one by one. Shows only what this phone sent.
 */
export function HandoffUploader({ token, remaining: initial }: { token: string; remaining: number }) {
  const t = useTranslations('handoff');
  const [remaining, setRemaining] = useState(initial);
  const [sent, setSent] = useState<Sent[]>([]);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(files: File[]) {
    setError(null);
    const todo = files.slice(0, remaining);
    setBusy({ done: 0, total: todo.length });
    let left = remaining;
    for (let i = 0; i < todo.length; i++) {
      try {
        const p = await processPhoto(todo[i]);
        const fd = new FormData();
        fd.append('photo', p.photo, 'photo.jpg');
        fd.append('thumb', p.thumb, 'thumb.jpg');
        fd.append('takenAt', p.takenAt);
        const res = await fetch(`/foto/${encodeURIComponent(token)}/upload`, { method: 'POST', body: fd });
        const body = (await res.json().catch(() => ({}))) as { remaining?: number; error?: string };
        if (!res.ok) {
          URL.revokeObjectURL(p.previewUrl);
          setError(body.error ?? 'generic');
          if (body.error === 'expired' || body.error === 'full' || body.error === 'notFound') left = 0;
          break;
        }
        left = body.remaining ?? left - 1;
        setSent((prev) => [...prev, { key: p.key, url: p.previewUrl }]);
      } catch {
        setError('read');
      }
      setBusy({ done: i + 1, total: todo.length });
    }
    setRemaining(left);
    setBusy(null);
  }

  return (
    <div className="handoff-up">
      {sent.length ? (
        <ul className="photos" aria-label={t('phoneSent')}>
          {sent.map((p) => (
            <li key={p.key} className="ph">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
              <img src={p.url} alt={t('phoneSentOne')} />
              <small className="num">
                <Check size={14} aria-hidden="true" /> {t('phoneSentOne')}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
      {remaining > 0 ? (
        <label className={`btn btn--gold btn--block${busy ? ' off' : ''}`} htmlFor="handoff-input">
          <Camera size={20} aria-hidden="true" /> {t('phoneTake')}
          <input
            id="handoff-input"
            className="sr-only"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            disabled={!!busy}
            onChange={(e) => {
              const files = [...(e.currentTarget.files ?? [])];
              e.currentTarget.value = '';
              if (files.length) void send(files);
            }}
          />
        </label>
      ) : null}
      <p className="muted" role="status" aria-live="polite">
        {busy
          ? t('phoneSending', busy)
          : sent.length
            ? t('phoneDone', { n: sent.length, remaining })
            : t('phoneRemaining', { remaining })}
      </p>
      {error ? (
        <p className="msg" role="alert">
          {t(
            `phoneError_${['expired', 'full', 'notFound', 'rateLimited', 'photoType', 'photoSize', 'read'].includes(error) ? error : 'generic'}`,
          )}
        </p>
      ) : null}
    </div>
  );
}
