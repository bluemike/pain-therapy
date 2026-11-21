'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Stroke } from '@pain-therapy/shared/signature';
import {
  INK_LINE_HEIGHT,
  INK_MAX_LINES,
  INK_MAX_POINTS,
  INK_MAX_STROKES,
  INK_MIN_LINES,
  INK_WIDTH,
  inkDataUrl,
  inkPath,
  insertRecognized,
  type Ink,
  type InputMode,
} from '@pain-therapy/shared/ink';
import { recognizeHandwriting, saveInputMode } from '@/app/(app)/handwriting-actions';
import type { RecognizableField } from '@/lib/handwriting-fields';
import { Seg } from './Seg';

/**
 * note-input (iteration 10, design D1, D2, D7): a remark field with the switch «Tastatur | Handschrift → Text |
 * Handschrift als Bild». The text keeps its form name; the hidden field <name>Ink carries the handwriting: "keep" (the
 * stored image stays), "" (no image) or the raw strokes as JSON, from which the server builds the image.
 */
export function NoteInput(props: {
  field: RecognizableField;
  name: string;
  value: string;
  onChange: (v: string) => void;
  /** Stored image of the field (or the treatment's, as proposal for a new session) */
  ink: Ink | null;
  /** Default of the user (design D3); a field holding an image always opens as image */
  defaultMode: InputMode;
  label: string;
  /** id, className and aria attributes of the text control, as the form builds them */
  textProps: Record<string, unknown>;
}) {
  const t = useTranslations('notes');
  const [mode, setMode] = useState<InputMode>(props.ink ? 'HANDWRITING_IMAGE' : props.defaultMode);
  const [stored, setStored] = useState<Ink | null>(props.ink);
  const [rewriting, setRewriting] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [lines, setLines] = useState(INK_MIN_LINES);
  const [busy, setBusy] = useState(false);
  const [recognized, setRecognized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const cursor = useRef<number | null>(null);
  const confirmRef = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const replacesText = mode === 'HANDWRITING_IMAGE' && strokes.length > 0 && props.value.trim() !== '';

  // Umschalten mit Inhalt (design D7): ask before the handwriting replaces saved text. Native listener on the form so
  // it runs before React's submit handler, which it stops until the user confirms.
  useEffect(() => {
    const form = rootRef.current?.closest('form');
    if (!form) return;
    const onSubmit = (e: SubmitEvent) => {
      if (!replacesText || confirmed.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      confirmRef.current?.showModal();
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [replacesText]);

  const choose = (m: InputMode | null) => {
    if (!m || m === mode) return;
    setMode(m);
    setError(null);
    saveInputMode(m).catch(() => {});
  };

  const recognizeStrokes = async (source: Stroke[], h: number, fromImage: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('field', props.field);
      fd.set('image', await strokesPng(source, h), 'handschrift.png');
      const res = await recognizeHandwriting(fd);
      if ('error' in res) {
        setError(t(`error_${res.error}`));
        return;
      }
      props.onChange(insertRecognized(props.value, res.text, cursor.current));
      setRecognized(true);
      if (!fromImage) setStrokes([]);
      setMode('HANDWRITING_TEXT');
      requestAnimationFrame(() => textRef.current?.focus());
    } catch {
      setError(t('error_unavailable'));
    } finally {
      setBusy(false);
    }
  };

  const showStored = mode === 'HANDWRITING_IMAGE' && stored && !rewriting && strokes.length === 0;
  const showPad = mode !== 'KEYBOARD' && !showStored;
  const showText = mode !== 'HANDWRITING_IMAGE';

  // What the server gets for the image (see the component comment)
  let inkValue = stored ? 'keep' : '';
  if (mode === 'HANDWRITING_IMAGE' && strokes.length)
    inkValue = JSON.stringify({ h: lines * INK_LINE_HEIGHT, strokes });
  // As image, the text is sent only while nothing was written (switching alone keeps the text)
  const textValue = mode === 'HANDWRITING_IMAGE' && strokes.length ? '' : props.value;

  const modes: [InputMode, string][] = [
    ['KEYBOARD', t('mode_KEYBOARD')],
    ['HANDWRITING_TEXT', t('mode_HANDWRITING_TEXT')],
    ['HANDWRITING_IMAGE', t('mode_HANDWRITING_IMAGE')],
  ];

  return (
    <div className="noteinput" ref={rootRef} data-mode={mode}>
      <div className="noteinput-modes">
        <Seg<InputMode>
          label={t('modeLabel', { field: props.label })}
          options={modes}
          value={mode}
          onChange={choose}
          required
        />
      </div>
      <input type="hidden" name={`${props.name}Ink`} value={inkValue} />
      {showText ? (
        <>
          <textarea
            {...props.textProps}
            ref={textRef}
            name={props.name}
            value={props.value}
            className={`${String(props.textProps.className ?? 'inp')} ${recognized ? 'recog' : ''}`}
            placeholder={
              mode === 'HANDWRITING_TEXT'
                ? t('recognizedPlaceholder')
                : (props.textProps.placeholder as string | undefined)
            }
            onChange={(e) => props.onChange(e.target.value)}
            onSelect={(e) => (cursor.current = e.currentTarget.selectionStart)}
            onBlur={(e) => (cursor.current = e.currentTarget.selectionStart)}
          />
          {recognized ? (
            <span className="tag warn" role="status">
              {t('recognizedCheck')}
            </span>
          ) : null}
        </>
      ) : (
        <input type="hidden" name={props.name} value={textValue} />
      )}
      {stored && mode !== 'HANDWRITING_IMAGE' ? (
        <figure className="ink ink--muted">
          {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data, no optimisation */}
          <img src={inkDataUrl(stored)} alt={t('alt')} />
          <figcaption>{t(props.value.trim() ? 'storedReplacedByText' : 'storedKept')}</figcaption>
        </figure>
      ) : null}
      {showStored && stored ? (
        <>
          <figure className="ink">
            {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data, no optimisation */}
            <img src={inkDataUrl(stored)} alt={t('alt')} data-testid={`ink-${props.name}`} />
          </figure>
          <div className="noteinput-tools">
            <button
              type="button"
              className="btn btn--sm"
              disabled={busy}
              onClick={() => recognizeStrokes(stored.strokes, stored.h, true)}
            >
              {busy ? t('recognizing') : t('convert')}
            </button>
            <button type="button" className="btn btn--sm" onClick={() => setRewriting(true)}>
              {t('rewrite')}
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setStored(null)}>
              {t('remove')}
            </button>
          </div>
        </>
      ) : null}
      {showPad ? (
        <>
          <HandwritingPad
            strokes={strokes}
            lines={lines}
            onChange={(s) => {
              setStrokes(s);
              setError(null);
            }}
            label={t('padLabel', { field: props.label })}
            hint={t('padHint')}
            testId={`pad-${props.name}`}
          />
          <div className="noteinput-tools">
            {mode === 'HANDWRITING_TEXT' ? (
              <button
                type="button"
                className="btn btn--sm btn--gold"
                disabled={busy || !strokes.length}
                onClick={() => recognizeStrokes(strokes, lines * INK_LINE_HEIGHT, false)}
              >
                {busy ? t('recognizing') : t('recognize')}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn--sm"
              disabled={!strokes.length}
              onClick={() => setStrokes(strokes.slice(0, -1))}
            >
              {t('undo')}
            </button>
            <button type="button" className="btn btn--sm" disabled={!strokes.length} onClick={() => setStrokes([])}>
              {t('clear')}
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={lines >= INK_MAX_LINES}
              onClick={() => setLines((n) => Math.min(INK_MAX_LINES, n + 1))}
            >
              {t('addLine')}
            </button>
            {rewriting ? (
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => {
                  setRewriting(false);
                  setStrokes([]);
                }}
              >
                {t('cancelRewrite')}
              </button>
            ) : null}
          </div>
          {mode === 'HANDWRITING_IMAGE' && props.value.trim() ? (
            <p className="noteinput-old">
              {t(strokes.length ? 'textReplaced' : 'textKept')} <s>{props.value}</s>
            </p>
          ) : null}
        </>
      ) : null}
      {error ? (
        <span className="msg" role="alert">
          {error}
        </span>
      ) : null}
      <dialog ref={confirmRef} className="modal" aria-labelledby={`${uid}-h`}>
        <h2 id={`${uid}-h`}>{t('confirmTitle')}</h2>
        <div className="body">
          <p>{t('confirmText', { field: props.label })}</p>
        </div>
        <footer>
          <button type="button" className="btn btn--ghost" onClick={() => confirmRef.current?.close()}>
            {t('confirmCancel')}
          </button>
          <button
            type="button"
            className="btn btn--gold"
            onClick={() => {
              confirmRef.current?.close();
              confirmed.current = true;
              rootRef.current?.closest('form')?.requestSubmit();
              confirmed.current = false;
            }}
          >
            {t('confirmReplace')}
          </button>
        </footer>
      </dialog>
    </div>
  );
}

/** Largest scale of the logical writing space on screen (design D2) */
const MAX_SCALE = 0.7;

/** Renders strokes black on white as PNG for the recognition (design D4): 1.5 × the logical size, at most 4 MB. */
async function strokesPng(strokes: Stroke[], h: number): Promise<Blob> {
  const scale = 1.5;
  const c = document.createElement('canvas');
  c.width = INK_WIDTH * scale;
  c.height = h * scale;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.setTransform(scale * 2.4, 0, 0, scale * 2.4, 0, 0);
  g.fillStyle = '#000000';
  for (const s of strokes) {
    const d = inkPath(s);
    if (d) g.fill(new Path2D(d));
  }
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

/**
 * Schreibfläche (design D2): ruled lines, the stroke rendering of the signature, pen pressure. touch-action: none only
 * on the canvas. Once a pen stroke was drawn, touches are ignored (the hand resting on the screen).
 */
function HandwritingPad(props: {
  strokes: Stroke[];
  lines: number;
  onChange: (s: Stroke[]) => void;
  label: string;
  hint: string;
  testId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const penSeen = useRef(false);
  const scale = useRef(1);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const k = scale.current;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    const css = getComputedStyle(c);
    g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0);
    g.strokeStyle = css.getPropertyValue('--rule').trim() || '#dfe6f2';
    g.lineWidth = 1 / k;
    for (let i = 1; i <= props.lines; i++) {
      g.beginPath();
      g.moveTo(16, i * INK_LINE_HEIGHT - 10);
      g.lineTo(INK_WIDTH - 16, i * INK_LINE_HEIGHT - 10);
      g.stroke();
    }
    g.setTransform(dpr * k * 2.4, 0, 0, dpr * k * 2.4, 0, 0);
    g.fillStyle = css.color;
    const all = current.current ? [...props.strokes, current.current] : props.strokes;
    for (const s of all) {
      const d = inkPath(s);
      if (d) g.fill(new Path2D(d));
    }
  }, [props.strokes, props.lines]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      // Lines stay at most about 45 px high on wide screens: the pad then is narrower than the field
      const host = c.closest('.noteinput') ?? c.parentElement;
      const w = Math.min(host?.clientWidth || c.clientWidth, INK_WIDTH * MAX_SCALE);
      scale.current = w / INK_WIDTH;
      c.style.width = `${w}px`;
      const h = props.lines * INK_LINE_HEIGHT * scale.current;
      c.style.height = `${h}px`;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      draw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    const host = c.closest('.noteinput') ?? c.parentElement;
    if (host) ro.observe(host);
    return () => ro.disconnect();
  }, [draw, props.lines]);

  const point = (e: { clientX: number; clientY: number; pointerType: string; pressure: number }): Stroke[number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    const k = scale.current;
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return [
      Math.round(((e.clientX - r.left) / k) * 10) / 10,
      Math.round(((e.clientY - r.top) / k) * 10) / 10,
      Math.round(pressure * 100) / 100,
    ];
  };
  const pointCount = () => props.strokes.reduce((n, s) => n + s.length, 0) + (current.current?.length ?? 0);

  return (
    <div className="inkpad">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={props.label}
        data-testid={props.testId}
        onPointerDown={(e) => {
          if (e.pointerType === 'pen') penSeen.current = true;
          if (penSeen.current && e.pointerType === 'touch') return;
          if (props.strokes.length >= INK_MAX_STROKES || pointCount() >= INK_MAX_POINTS) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = [point(e)];
          draw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          if (penSeen.current && e.pointerType === 'touch') return;
          const events =
            typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
          for (const ev of events.length ? events : [e.nativeEvent]) {
            if (pointCount() >= INK_MAX_POINTS) break;
            current.current.push(point(ev));
          }
          draw();
        }}
        onPointerUp={() => {
          if (!current.current) return;
          const done = current.current;
          current.current = null;
          props.onChange([...props.strokes, done]);
        }}
        onPointerCancel={() => {
          current.current = null;
          draw();
        }}
      />
      {props.strokes.length === 0 ? (
        <span className="ph" aria-hidden="true">
          {props.hint}
        </span>
      ) : null}
    </div>
  );
}
