'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, Square } from 'lucide-react';
import type { Parts } from '@pain-therapy/shared/home-program';
import type { AudioLanguage } from '@pain-therapy/shared/audio-language';

type State = 'idle' | 'loading' | 'playing' | 'missing';

/** Only one exercise speaks at a time */
let current: HTMLAudioElement | null = null;

/**
 * "Anhören" in the zone (iteration 14): plays the recording of FRM, then of the prescribed EPD, from
 * /media/{code}?teil=…; a second tap stops it. Shows "Audio nicht verfügbar" while a recording is missing.
 */
export function ZoneAudio({
  code,
  program,
  parts = 'FRM_EPD',
  lang = 'de',
}: {
  code: string;
  program?: string;
  /** Verordnete Teile (iteration 15, design D6) */
  parts?: Parts;
  /** Hörsprache (iteration 15, design D3); a missing recording plays in Hochdeutsch with a note */
  lang?: AudioLanguage;
}) {
  const t = useTranslations('home');
  const [state, setState] = useState<State>('idle');
  const [fallback, setFallback] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => ref.current?.pause(), []);

  const src = (part: string, inLang: AudioLanguage) =>
    `/media/${encodeURIComponent(code)}?teil=${part}${program ? `&b=${encodeURIComponent(program)}` : ''}${
      inLang === 'de' ? '' : `&lang=${inLang}`
    }`;

  function play(parts: string[], inLang: AudioLanguage = fallback ? 'de' : lang) {
    const a = new Audio(src(parts[0], inLang));
    a.preload = 'none';
    a.addEventListener('playing', () => setState('playing'));
    a.addEventListener('pause', () => setState((s) => (s === 'missing' || a.ended ? s : 'idle')));
    a.addEventListener('ended', () => (parts.length > 1 ? play(parts.slice(1), inLang) : setState('idle')));
    a.addEventListener('error', () => {
      if (inLang === 'de') return setState('missing');
      setFallback(true);
      play(parts, 'de');
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

  if (state === 'missing')
    return (
      <span className="audio missing" role="status">
        {t('audioMissing')}
      </span>
    );
  const on = state !== 'idle';
  const button = (
    <button
      type="button"
      className={`btn audio${on ? ' on' : ''}`}
      aria-pressed={on}
      aria-label={t(on ? 'stopAudio' : 'playAudio', { code })}
      onClick={() => {
        if (on) {
          ref.current?.pause();
          if (ref.current) ref.current.currentTime = 0;
          setState('idle');
        } else play(parts === 'FRM' ? ['frm-audio'] : parts === 'EPD' ? ['epd-audio'] : ['frm-audio', 'epd-audio']);
      }}
    >
      {on ? <Square size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
      <span aria-hidden="true">{t(on ? 'stop' : 'listen')}</span>
    </button>
  );
  return fallback ? (
    <span className="audiowrap">
      {button}
      <small className="muted">{t(lang === 'gsw' ? 'audioGswFollows' : 'audioEnFollows')}</small>
    </span>
  ) : (
    button
  );
}
