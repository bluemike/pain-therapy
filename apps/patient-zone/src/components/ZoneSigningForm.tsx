'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { getStroke } from 'perfect-freehand';
import type { Block } from '@pain-therapy/shared/consent-blocks';
import { strokeOptions, type Stroke } from '@pain-therapy/shared/signature';
import { signAction, type SignState } from '@/app/unterschrift/actions';

type Consents = { liability: boolean; dataProcessing: boolean; unencryptedEmail: boolean };

/**
 * zone-consent-signing: Inhalt des Formulars, Lesen und Einwilligen, Unterschrift auf dem Telefon (iteration 5, design
 * D5, mockup view 4). One long page, mobile first; the end of the text in view unlocks consents and signature. No
 * inline styles: the content security policy of the zone allows only its CSS files.
 */
export function ZoneSigningForm(props: {
  sid: string;
  title: string;
  version: number;
  blocks: Block[];
  details: [string, string][];
}) {
  const t = useTranslations('signForm');
  const [read, setRead] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [consents, setConsents] = useState<Consents>({
    liability: false,
    dataProcessing: false,
    unencryptedEmail: false,
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [serverError, setServerError] = useState<SignState['error'] | null>(null);
  const [pending, startTransition] = useTransition();
  const textRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLParagraphElement>(null);
  const padRef = useRef<HTMLCanvasElement>(null);

  // Reading progress over the whole page and the end of the text in view (Intersection Observer, design D5)
  useEffect(() => {
    const end = endRef.current;
    const text = textRef.current;
    if (!end || !text) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setRead(true));
    io.observe(end);
    const onScroll = () => {
      const r = text.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.5;
      const seen = window.innerHeight * 0.5 - r.top;
      setProgress((p) => Math.max(p, total <= 0 ? 0 : Math.min(100, Math.round((seen / total) * 100))));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  useEffect(() => {
    if (read) {
      setProgress(100);
      setErrors((e) => ({ ...e, read: false }));
    }
  }, [read]);

  function toggle(k: keyof Consents) {
    setConsents((c) => ({ ...c, [k]: !c[k] }));
    setErrors((e) => ({ ...e, [k]: false }));
  }

  function submit() {
    const e: Record<string, boolean> = {
      read: !read,
      liability: !consents.liability,
      dataProcessing: !consents.dataProcessing,
      signature: strokes.length === 0,
    };
    setErrors(e);
    setServerError(null);
    if (Object.values(e).some(Boolean)) return;
    const rect = padRef.current?.getBoundingClientRect();
    startTransition(async () => {
      const res = await signAction(props.sid, {
        note,
        readToEnd: true,
        liability: true,
        dataProcessing: true,
        unencryptedEmail: consents.unencryptedEmail,
        strokes,
        width: Math.round(rect?.width ?? 340),
        height: Math.round(rect?.height ?? 180),
      });
      if (res?.error) setServerError(res.error);
    });
  }

  const consentRow = (k: keyof Consents, label: string, required: boolean) => (
    <label className={`consent ${errors[k] ? 'bad' : ''}`} key={k}>
      <input
        type="checkbox"
        checked={consents[k]}
        disabled={!read}
        onChange={() => toggle(k)}
        data-testid={`consent-${k}`}
        aria-invalid={errors[k] || undefined}
        aria-describedby={errors[k] ? `err-${k}` : undefined}
      />
      <span>
        {label} <span className="tag">{required ? t('required') : t('optional')}</span>
        {errors[k] ? (
          <span className="errtxt" id={`err-${k}`} role="alert">
            {k === 'dataProcessing' ? t('dataRequired') : t('consentRequired')}
          </span>
        ) : null}
      </span>
    </label>
  );

  return (
    <div className="signform">
      <h1>{t('title')}</h1>
      <p className="sub">{t('intro')}</p>

      <section className="card" aria-labelledby="h_details">
        <h2 id="h_details">{t('stepDetails')}</h2>
        <dl className="kv">
          {props.details.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v || '–'}</dd>
            </div>
          ))}
        </dl>
        <label>
          {t('noteLabel')}
          <textarea
            name="note"
            maxLength={500}
            value={note}
            placeholder={t('notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <p className="lbl">{t('noteHint')}</p>
      </section>

      <section className="card" aria-labelledby="h_text" ref={textRef}>
        <h2 id="h_text">{props.title}</h2>
        <p className="lbl">{t('readFirst', { version: props.version })}</p>
        <div className="readbar">
          <progress max={100} value={progress} aria-label={t('progress')} />
        </div>
        <div className="prose consent-text" data-testid="reader">
          {props.blocks.map((b, i) =>
            b.type === 'h' ? (
              <h3 key={i}>{b.text}</h3>
            ) : b.type === 'p' ? (
              <p key={i}>{b.text}</p>
            ) : (
              <ul key={i}>
                {b.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            ),
          )}
          <p className="textend" ref={endRef}>
            {t('textEnd')}
          </p>
        </div>
      </section>

      <section className="card" aria-labelledby="h_consents">
        <h2 id="h_consents">{t('stepConsents')}</h2>
        <p className={read ? 'readok' : 'muted'} aria-live="polite">
          {read ? `✓ ${t('readDone')}` : t('readHint')}
        </p>
        {consentRow('liability', t('consentLiability'), true)}
        {consentRow('dataProcessing', t('consentData'), true)}
        {consentRow('unencryptedEmail', t('consentEmail'), false)}
      </section>

      <section className="card" aria-labelledby="h_sig">
        <h2 id="h_sig">{t('stepSignature')}</h2>
        <SignaturePad
          canvasRef={padRef}
          enabled={read}
          strokes={strokes}
          onChange={(st) => {
            setStrokes(st);
            setErrors((e) => ({ ...e, signature: false }));
          }}
          hint={read ? t('signatureHint') : t('signatureLocked')}
          invalid={!!errors.signature}
          label={t('signatureLabel')}
        />
        {errors.signature ? (
          <p className="errtxt" role="alert">
            {t('signatureError')}
          </p>
        ) : null}
        {errors.read ? (
          <p className="errtxt" role="alert">
            {t('readError')}
          </p>
        ) : null}
        {serverError ? (
          <div className="banner err" role="alert">
            {serverError === 'outdated' ? t('outdated') : serverError === 'session' ? t('sessionEnded') : t('error')}
            {serverError === 'outdated' ? (
              <button type="button" className="linkbtn" onClick={() => window.location.reload()}>
                {t('readNew')}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="sigactions">
          <button type="button" className="btn" onClick={() => setStrokes([])} disabled={pending || !strokes.length}>
            {t('clear')}
          </button>
          <button type="button" className="btn btn--gold" onClick={submit} disabled={pending}>
            {pending ? t('signing') : t('sign')}
          </button>
        </div>
      </section>
      <p className="lbl">{t('footer')}</p>
    </div>
  );
}

/**
 * Unterschrift auf dem Telefon: full width, perfect-freehand like the iPad. touch-action: none only on the canvas
 * (CSS), so drawing does not scroll and scrolling next to it does not draw.
 */
function SignaturePad(props: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  enabled: boolean;
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
  hint: string;
  invalid: boolean;
  label: string;
}) {
  const { canvasRef } = props;
  const current = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>(props.strokes);
  strokesRef.current = current.current ? strokesRef.current : props.strokes;

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = getComputedStyle(c).color;
    const all = current.current ? [...strokesRef.current, current.current] : strokesRef.current;
    for (const st of all) {
      const outline = getStroke(st, strokeOptions(st));
      if (!outline.length) continue;
      g.beginPath();
      g.moveTo(outline[0][0], outline[0][1]);
      for (let i = 1; i < outline.length; i++) {
        const [x0, y0] = outline[i];
        const [x1, y1] = outline[(i + 1) % outline.length];
        g.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      }
      g.closePath();
      g.fill();
    }
  }, [canvasRef]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = c.getBoundingClientRect();
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      draw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [draw, canvasRef]);
  useEffect(() => draw(), [props.strokes, draw]);

  const point = (e: { clientX: number; clientY: number; pointerType: string; pressure: number }): Stroke[number] => {
    const r = canvasRef.current!.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return [
      Math.round((e.clientX - r.left) * 10) / 10,
      Math.round((e.clientY - r.top) * 10) / 10,
      Math.round(pressure * 100) / 100,
    ];
  };

  return (
    <div className={`sigbox ${props.enabled ? '' : 'locked'} ${props.invalid ? 'bad' : ''}`}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={props.label}
        data-testid="signature"
        onPointerDown={(e) => {
          if (!props.enabled) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = [point(e)];
          draw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          const events =
            typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
          if (events.length) for (const ev of events) current.current.push(point(ev));
          else current.current.push(point(e));
          draw();
        }}
        onPointerUp={() => {
          if (!current.current) return;
          const done = current.current;
          current.current = null;
          strokesRef.current = [...strokesRef.current, done];
          props.onChange(strokesRef.current);
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
