'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, Square } from 'lucide-react';
import { useAudioLanguage } from './AudioLanguage';

type State = 'idle' | 'loading' | 'playing' | 'missing';

/** Only one exercise speaks at a time */
let current: HTMLAudioElement | null = null;

/**
 * exercise-audio (iteration 7, design D5): plays the spoken sheet (or one part of it) from /api/exercise-media/{code}/{kind}; a second
 * click stops it. Shows "Audio nicht verfügbar" while the MP3 is not uploaded yet.
 */
type Kind = 'audio' | 'frm-audio' | 'std-audio' | `v${number}-audio`;

export function ExerciseAudio({
  code,
  kind = 'audio',
  then,
  label,
}: {
  code: string;
  /** The whole sheet (iteration 7) or, since iteration 8, FRM, Standardübung or one variant (`v<n>-audio`) */
  kind?: Kind;
  /** Played right after `kind` (iteration 9: FRM, then the prescribed EPD) */
  then?: Kind;
  /** Names the part for screen readers, e.g. "1A Variante 2" */
  label?: string;
}) {
  const t = useTranslations('exercise');
  const lang = useAudioLanguage();
  const [state, setState] = useState<State>('idle');
  // Iteration 15 (design D3): a recording missing in Mundart or English plays in Hochdeutsch, with a note
  const [fallback, setFallback] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      ref.current?.pause();
    },
    [],
  );

  function play(kinds: Kind[], inLang = fallback ? 'de' : lang) {
    const q = inLang === 'de' ? '' : `?lang=${inLang}`;
    const a = new Audio(`/api/exercise-media/${encodeURIComponent(code)}/${kinds[0]}${q}`);
    a.preload = 'none';
    a.addEventListener('playing', () => setState('playing'));
    a.addEventListener('pause', () => setState((s) => (s === 'missing' || a.ended ? s : 'idle')));
    a.addEventListener('ended', () => (kinds.length > 1 ? play(kinds.slice(1), inLang) : setState('idle')));
    a.addEventListener('error', () => {
      if (inLang === 'de') return setState('missing');
      setFallback(true);
      play(kinds, 'de');
    });
    ref.current = a;
    if (current && current !== a) current.pause();
    current = a;
    setState('loading');
    a.play().catch((e: DOMException) => {
      // A missing file also fires "error", which falls back to Hochdeutsch or shows the note
      if (e.name !== 'AbortError' && !a.error) setState('idle');
    });
  }

  function toggle() {
    if (state === 'playing' || state === 'loading') {
      ref.current?.pause();
      if (ref.current) ref.current.currentTime = 0;
      setState('idle');
      return;
    }
    play(then ? [kind, then] : [kind]);
  }

  if (state === 'missing')
    return (
      <span className="exaudio missing" role="status">
        {t('audioMissing')}
      </span>
    );
  const on = state !== 'idle';
  const button = (
    <button
      type="button"
      className={`btn btn--ghost exaudio${on ? ' on' : ''}`}
      aria-pressed={on}
      aria-label={on ? t('stopAudio', { code: label ?? code }) : t('playAudio', { code: label ?? code })}
      onClick={toggle}
    >
      {on ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}{' '}
      {on ? t('stop') : t('listen')}
    </button>
  );
  return fallback ? (
    <span className="exaudio-wrap">
      {button}
      <small className="muted">{t(lang === 'gsw' ? 'audioGswFollows' : 'audioEnFollows')}</small>
    </span>
  ) : (
    button
  );
}
