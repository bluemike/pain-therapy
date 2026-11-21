'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, Square } from 'lucide-react';
import type { Parts } from '@pain-therapy/shared/home-program';

type State = 'idle' | 'loading' | 'playing' | 'missing';

/** Only one exercise speaks at a time */
let current: HTMLAudioElement | null = null;

/**
 * "Anhören" in the zone (iteration 14): plays the recording of FRM, then of the prescribed EPD, from
 * /media/{code}?teil=…; a second tap stops it. Shows "Audio nicht verfügbar" while a recording is missing.
 */
export function ZoneAudio({ code, program, parts = 'FRM_EPD' }: { code: string; program?: string; parts?: Parts }) {
  const t = useTranslations('home');
  const [state, setState] = useState<State>('idle');
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => ref.current?.pause(), []);

  const src = (part: string) =>
    `/media/${encodeURIComponent(code)}?teil=${part}${program ? `&b=${encodeURIComponent(program)}` : ''}`;

  function play(parts: string[]) {
    const a = new Audio(src(parts[0]));
    a.preload = 'none';
    a.addEventListener('playing', () => setState('playing'));
    a.addEventListener('pause', () => setState((s) => (s === 'missing' || a.ended ? s : 'idle')));
    a.addEventListener('ended', () => (parts.length > 1 ? play(parts.slice(1)) : setState('idle')));
    a.addEventListener('error', () => setState('missing'));
    ref.current = a;
    if (current && current !== a) current.pause();
    current = a;
    setState('loading');
    a.play().catch((e: DOMException) => {
      if (e.name !== 'AbortError') setState(a.error ? 'missing' : 'idle');
    });
  }

  if (state === 'missing')
    return (
      <span className="audio missing" role="status">
        {t('audioMissing')}
      </span>
    );
  const on = state !== 'idle';
  return (
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
}
