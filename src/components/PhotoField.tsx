'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/lib/format';
import { processPhoto, type ProcessedPhoto } from '@/lib/photo-client';
import { Camera, RotateCcw, Smartphone, X } from 'lucide-react';
import { endHandoffAction, startHandoffAction } from '@/app/(app)/photo-handoff-actions';

/** Fotos mit dem Smartphone (iteration 15, design D5): the open link and the photos it brought */
type Handoff = { id: string; url: string; checkCode: string; expiresAt: string; qr: string; open: boolean };
type PhonePhoto = { id: string; takenAt: string };
const POLL_MS = 3000;

/** A photo already saved with the treatment or consultation */
export type SavedPhoto = { id: string; takenAt: string };

const MAX_PER_SAVE = 10;

/** clinical-photos: Fotos aufnehmen. New photos are kept in the browser until the form is saved. */
export function usePhotos() {
  const [items, setItems] = useState<ProcessedPhoto[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<'read' | 'count' | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [handoffError, setHandoffError] = useState(false);
  const [phone, setPhone] = useState<PhonePhoto[]>([]);
  const [dropped, setDropped] = useState<string[]>([]);

  // The form asks for new photos from the phone every 3 seconds while a link is open, and once more after it ended
  useEffect(() => {
    if (!handoff) return;
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/photo-handoffs/${handoff.id}`, { cache: 'no-store' });
        if (!res.ok || stop) return;
        const s = (await res.json()) as { open: boolean; photos: PhonePhoto[] };
        setPhone(s.photos);
        if (!s.open) setHandoff((h) => (h && h.open ? { ...h, open: false } : h));
      } catch {
        // offline for a moment: the next poll tries again
      }
    };
    void poll();
    if (!handoff.open) return;
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [handoff?.id, handoff?.open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function startHandoff(patientId: string, treatmentId: string | null) {
    setHandoffError(false);
    const r = await startHandoffAction(patientId, treatmentId);
    if (!r.ok) return setHandoffError(true);
    setHandoff({ id: r.id, url: r.url, checkCode: r.checkCode, expiresAt: r.expiresAt, qr: r.qr, open: true });
  }

  async function endHandoff() {
    if (!handoff) return;
    await endHandoffAction(handoff.id);
    setHandoff({ ...handoff, open: false });
  }

  async function add(files: File[]) {
    setFailed(null);
    const room = Math.max(0, MAX_PER_SAVE - items.length);
    const todo = files.slice(0, room);
    if (files.length > room) setFailed('count');
    setProgress({ done: 0, total: todo.length });
    for (let i = 0; i < todo.length; i++) {
      try {
        const p = await processPhoto(todo[i]);
        urls.current.push(p.previewUrl);
        setItems((prev) => [...prev, p]);
      } catch {
        setFailed('read');
      }
      setProgress({ done: i + 1, total: todo.length });
    }
    setProgress(null);
  }

  return {
    items,
    removed,
    progress,
    failed,
    add,
    handoff,
    handoffError,
    phone: phone.filter((p) => !dropped.includes(p.id)),
    startHandoff,
    endHandoff,
    dropPhone: (id: string) => setDropped((prev) => [...prev, id]),
    discard: (key: string) => setItems((prev) => prev.filter((p) => p.key !== key)),
    toggleRemove: (id: string) =>
      setRemoved((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    /** Adds new photos (photo, photoThumb, photoTakenAt in the same order) and removals to the form data */
    appendTo(fd: FormData) {
      for (const p of items) {
        fd.append('photo', p.photo, `${p.key}.jpg`);
        fd.append('photoThumb', p.thumb, `${p.key}.thumb.jpg`);
        fd.append('photoTakenAt', p.takenAt);
      }
      for (const id of removed) fd.append('removePhoto', id);
      for (const p of phone) if (!dropped.includes(p.id)) fd.append('handoffPhoto', p.id);
    },
  };
}

export type PhotoState = ReturnType<typeof usePhotos>;

export function PhotoField({
  state,
  saved = [],
  id,
  error,
  patientId,
  treatmentId = null,
}: {
  state: PhotoState;
  saved?: SavedPhoto[];
  id: string;
  error?: string | null;
  /** With a patient the field offers «Mit Smartphone aufnehmen» (iteration 15, design D5) */
  patientId?: string;
  treatmentId?: string | null;
}) {
  const t = useTranslations('photos');
  const th = useTranslations('handoff');
  const te = useTranslations('errors');
  const full = state.items.length >= MAX_PER_SAVE;
  const h = state.handoff;
  return (
    <div className="photofield">
      <ul className="photos" aria-label={t('take')}>
        {saved.map((p) => {
          const at = formatDateTime(new Date(p.takenAt));
          const gone = state.removed.includes(p.id);
          return (
            <li key={p.id} className={`ph${gone ? ' gone' : ''}`}>
              <a href={`/api/photos/${p.id}`} target="_blank" rel="noopener" aria-label={t('open', { at })}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private, uncached photo; no image optimisation */}
                <img src={`/api/photos/${p.id}/thumb`} alt={t('alt', { at })} />
              </a>
              <button
                type="button"
                className="x"
                aria-pressed={gone}
                aria-label={gone ? `${t('undoRemove')}: ${at}` : t('remove', { at })}
                onClick={() => state.toggleRemove(p.id)}
              >
                {gone ? <RotateCcw size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
              </button>
              <small className="num">{gone ? t('willRemove') : at}</small>
            </li>
          );
        })}
        {state.items.map((p) => {
          const at = formatDateTime(new Date(p.takenAt));
          return (
            <li key={p.key} className="ph new">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview (blob URL) */}
              <img src={p.previewUrl} alt={t('alt', { at })} />
              <button
                type="button"
                className="x"
                aria-label={t('discard', { at })}
                onClick={() => state.discard(p.key)}
              >
                ×
              </button>
              <small className="num">
                {at} · {t('new')}
              </small>
            </li>
          );
        })}
        {state.phone.map((p) => {
          const at = formatDateTime(new Date(p.takenAt));
          return (
            <li key={p.id} className="ph new" data-testid="phone-photo">
              {h ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, uncached photo; no image optimisation
                <img src={`/api/photo-handoffs/${h.id}/${p.id}?v=thumb`} alt={t('alt', { at })} />
              ) : null}
              <button
                type="button"
                className="x"
                aria-label={t('discard', { at })}
                onClick={() => state.dropPhone(p.id)}
              >
                ×
              </button>
              <small className="num">
                {at} · {th('fromPhone')}
              </small>
            </li>
          );
        })}
        <li>
          <label className={`addph${full ? ' off' : ''}`} htmlFor={id}>
            <Camera size={22} aria-hidden="true" />
            <span>{t('take')}</span>
            <input
              id={id}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              disabled={full || !!state.progress}
              aria-describedby={`${id}_hint`}
              onChange={(e) => {
                const files = [...(e.currentTarget.files ?? [])];
                e.currentTarget.value = '';
                if (files.length) void state.add(files);
              }}
            />
          </label>
        </li>
      </ul>
      {state.progress ? (
        <div className="phprog" role="status">
          <progress value={state.progress.done} max={state.progress.total} aria-label={t('take')} />
          <span>{t('processing', state.progress)}</span>
        </div>
      ) : null}
      {state.failed || error ? (
        <span className="msg" role="alert">
          {error ?? (state.failed === 'count' ? te('photoCount') : t('failed'))}
        </span>
      ) : null}
      <span className="hint" id={`${id}_hint`}>
        {t('hint')}
      </span>
      {patientId ? <HandoffPanel state={state} patientId={patientId} treatmentId={treatmentId} /> : null}
    </div>
  );
}

/** «Mit Smartphone aufnehmen»: QR code, check code and remaining time of the link; «Beenden» */
function HandoffPanel({
  state,
  patientId,
  treatmentId,
}: {
  state: PhotoState;
  patientId: string;
  treatmentId: string | null;
}) {
  const t = useTranslations('handoff');
  const h = state.handoff;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!h?.open) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [h?.open]);
  const left = h ? Math.max(0, new Date(h.expiresAt).getTime() - now) : 0;
  const open = !!h?.open && left > 0;
  const mmss = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
  if (!open)
    return (
      <div className="handoff">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => void state.startHandoff(patientId, treatmentId)}
        >
          <Smartphone size={18} aria-hidden="true" /> {t(h ? 'again' : 'start')}
        </button>
        {h ? <span className="hint">{t('ended')}</span> : null}
        {state.handoffError ? (
          <span className="msg" role="alert">
            {t('startFailed')}
          </span>
        ) : null}
      </div>
    );
  return (
    <div className="handoff open" role="region" aria-label={t('panel')} data-testid="handoff" data-url={h!.url}>
      {/* eslint-disable-next-line @next/next/no-img-element -- QR code as data URL */}
      <img className="qr" src={h!.qr} alt={t('qrAlt')} width={180} height={180} />
      <div className="info">
        <p>{t('scan')}</p>
        <p>
          {t('check')}{' '}
          <b className="checkcode" data-testid="check-code">
            {h!.checkCode}
          </b>
        </p>
        <p className="muted" aria-live="off">
          {t('validFor', { time: mmss })}
        </p>
        <p className="muted" role="status" aria-live="polite">
          {t('received', { n: state.phone.length })}
        </p>
        <button type="button" className="btn btn--ghost" onClick={() => void state.endHandoff()}>
          {t('end')}
        </button>
      </div>
    </div>
  );
}
