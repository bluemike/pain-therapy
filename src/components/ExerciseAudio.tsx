'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

type State = 'idle' | 'loading' | 'playing' | 'missing';

/** Only one exercise speaks at a time */
let current: HTMLAudioElement | null = null;

/**
 * exercise-audio (iteration 7, design D5): plays the spoken sheet (or one part of it) from /api/exercise-media/{code}/{kind}; a second
 * click stops it. Shows "Audio nicht verfügbar" while the MP3 is not uploaded yet.
 */
export function ExerciseAudio({
  code,
  kind = 'audio',
  label,
}: {
  code: string;
  /** The whole sheet (iteration 7) or, since iteration 8, FRM, Standardübung or one variant (`v<n>-audio`) */
  kind?: 'audio' | 'frm-audio' | 'std-audio' | `v${number}-audio`;
  /** Names the part for screen readers, e.g. "1A Variante 2" */
  label?: string;
}) {
  const t = useTranslations('exercise');
  const [state, setState] = useState<State>('idle');
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      ref.current?.pause();
    },
    [],
  );

  function toggle() {
    if (state === 'playing' || state === 'loading') {
      ref.current?.pause();
      if (ref.current) ref.current.currentTime = 0;
      setState('idle');
      return;
    }
    if (!ref.current) {
      const a = new Audio(`/api/exercise-media/${encodeURIComponent(code)}/${kind}`);
      a.preload = 'none';
      a.addEventListener('playing', () => setState('playing'));
      a.addEventListener('pause', () => setState((s) => (s === 'missing' ? s : 'idle')));
      a.addEventListener('ended', () => setState('idle'));
      a.addEventListener('error', () => setState('missing'));
      ref.current = a;
    }
    if (current && current !== ref.current) current.pause();
    current = ref.current;
    setState('loading');
    ref.current.play().catch((e: DOMException) => {
      if (e.name !== 'AbortError') setState(ref.current?.error ? 'missing' : 'idle');
    });
  }

  if (state === 'missing')
    return (
      <span className="exaudio missing" role="status">
        {t('audioMissing')}
      </span>
    );
  const on = state !== 'idle';
  return (
    <button
      type="button"
      className={`btn btn--ghost exaudio${on ? ' on' : ''}`}
      aria-pressed={on}
      aria-label={on ? t('stopAudio', { code: label ?? code }) : t('playAudio', { code: label ?? code })}
      onClick={toggle}
    >
      <span aria-hidden="true">{on ? '■' : '▶'}</span> {on ? t('stop') : t('listen')}
    </button>
  );
}
