'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/lib/format';
import { processPhoto, type ProcessedPhoto } from '@/lib/photo-client';

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
    },
  };
}

export type PhotoState = ReturnType<typeof usePhotos>;

export function PhotoField({
  state,
  saved = [],
  id,
  error,
}: {
  state: PhotoState;
  saved?: SavedPhoto[];
  id: string;
  error?: string | null;
}) {
  const t = useTranslations('photos');
  const te = useTranslations('errors');
  const full = state.items.length >= MAX_PER_SAVE;
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
                {gone ? '↺' : '×'}
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
        <li>
          <label className={`addph${full ? ' off' : ''}`} htmlFor={id}>
            <span aria-hidden="true">📷</span>
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
    </div>
  );
}
