'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { getStroke } from 'perfect-freehand';
import { submitSignature } from '@/app/sign/actions';
import { strokeOptions, type Stroke } from '@/lib/signature';
import type { Block } from '@/lib/consent-texts';

type Strings = Record<
  | 'title'
  | 'intro'
  | 'stepDetails'
  | 'noteLabel'
  | 'notePlaceholder'
  | 'stepRead'
  | 'readHint'
  | 'readDone'
  | 'textEnd'
  | 'stepConsents'
  | 'consentLiability'
  | 'consentData'
  | 'consentEmail'
  | 'required'
  | 'optional'
  | 'consentRequiredError'
  | 'stepSignature'
  | 'place'
  | 'date'
  | 'signatureHint'
  | 'signatureLocked'
  | 'clear'
  | 'sign'
  | 'signing'
  | 'signatureError'
  | 'readError'
  | 'submitError',
  string
>;

type Consents = { liability: boolean; dataProcessing: boolean; unencryptedEmail: boolean };

/** consent-signing: Formular, Scroll-bis-zum-Ende-Sperre, Einwilligungen und Unterschriftsfeld (perfect-freehand) */
export function SigningForm(props: {
  sid: string;
  strings: Strings;
  details: [string, string][];
  blocks: Block[];
  textTitle: string;
  defaultPlace: string;
  today: string;
}) {
  const { strings: s } = props;
  const [read, setRead] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState('');
  const [place, setPlace] = useState(props.defaultPlace);
  const [consents, setConsents] = useState<Consents>({
    liability: false,
    dataProcessing: false,
    unencryptedEmail: false,
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const readerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Signature is enabled only once the end of the text has been in view (design D6: IntersectionObserver)
  useEffect(() => {
    const reader = readerRef.current;
    const end = endRef.current;
    if (!reader || !end) return;
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setRead(true), {
      root: reader,
      threshold: 1,
    });
    io.observe(end);
    const onScroll = () => {
      const max = reader.scrollHeight - reader.clientHeight;
      setProgress((p) => Math.max(p, max <= 0 ? 100 : Math.round((reader.scrollTop / max) * 100)));
    };
    reader.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io.disconnect();
      reader.removeEventListener('scroll', onScroll);
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
    if (Object.values(e).some(Boolean)) return;
    const pad = document.getElementById('sigpad');
    const rect = pad?.getBoundingClientRect();
    startTransition(async () => {
      const res = await submitSignature(props.sid, {
        note,
        place,
        readToEnd: true,
        liability: true,
        dataProcessing: true,
        unencryptedEmail: consents.unencryptedEmail,
        strokes,
        width: Math.round(rect?.width ?? 600),
        height: Math.round(rect?.height ?? 220),
      });
      if (res?.error) setServerError(s.submitError);
    });
  }

  const consentRow = (k: keyof Consents, label: string, required: boolean) => (
    <label className={`consent ${errors[k] ? 'bad' : ''}`} aria-disabled={!read || undefined} key={k}>
      <input
        type="checkbox"
        checked={consents[k]}
        disabled={!read}
        onChange={() => toggle(k)}
        data-testid={`consent-${k}`}
        aria-invalid={errors[k] || undefined}
      />
      <span>
        {label}
        <span className="tagr">{required ? s.required : s.optional}</span>
        {errors[k] ? (
          <span className="errtxt" style={{ display: 'block', marginTop: 6 }} role="alert">
            {s.consentRequiredError}
          </span>
        ) : null}
      </span>
    </label>
  );

  return (
    <div className="pmmain">
      <div>
        <h1>{s.title}</h1>
        <p className="lead">{s.intro}</p>
      </div>

      <section className="step" aria-labelledby="step1">
        <h2 id="step1">
          <span className="n done">1</span>
          {s.stepDetails}
        </h2>
        <div className="card">
          <dl className="kv">
            {props.details.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || '–'}</dd>
              </div>
            ))}
          </dl>
          <div className="body" style={{ paddingTop: 0 }}>
            <div className="f w6">
              <label className="l" htmlFor="pnote">
                {s.noteLabel}
              </label>
              <textarea
                className="inp"
                id="pnote"
                maxLength={1000}
                placeholder={s.notePlaceholder}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="step" aria-labelledby="step2">
        <h2 id="step2">
          <span className={`n ${read ? 'done' : ''}`}>2</span>
          {s.stepRead}
        </h2>
        <div className="progress" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="reader" ref={readerRef} tabIndex={0} aria-label={props.textTitle} data-testid="reader">
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
          <div className="end" ref={endRef}>
            {s.textEnd}
          </div>
        </div>
        <p
          className={read ? '' : 'muted'}
          style={{ margin: 0, fontSize: 14.5, ...(read ? { color: 'var(--ok)', fontWeight: 500 } : {}) }}
          aria-live="polite"
        >
          {read ? `✓ ${s.readDone}` : s.readHint}
        </p>
      </section>

      <section className="step" aria-labelledby="step3">
        <h2 id="step3">
          <span className="n">3</span>
          {s.stepConsents}
        </h2>
        {consentRow('liability', s.consentLiability, true)}
        {consentRow('dataProcessing', s.consentData, true)}
        {consentRow('unencryptedEmail', s.consentEmail, false)}
      </section>

      <section className="step" aria-labelledby="step4">
        <h2 id="step4">
          <span className="n">4</span>
          {s.stepSignature}
        </h2>
        <div className="sigrow">
          <div className="f">
            <label className="l" htmlFor="pplace">
              {s.place}
            </label>
            <input
              className="inp"
              id="pplace"
              value={place}
              maxLength={100}
              onChange={(e) => setPlace(e.target.value)}
            />
          </div>
          <div className="f">
            <label className="l" htmlFor="pdate">
              {s.date}
            </label>
            <input className="inp num" id="pdate" value={props.today} readOnly />
          </div>
        </div>
        <SignaturePad
          enabled={read}
          strokes={strokes}
          onChange={(st) => {
            setStrokes(st);
            setErrors((e) => ({ ...e, signature: false }));
          }}
          hint={read ? s.signatureHint : s.signatureLocked}
          invalid={!!errors.signature}
          label={s.stepSignature}
        />
        {errors.signature ? (
          <p className="errtxt" role="alert">
            {s.signatureError}
          </p>
        ) : null}
        {errors.read ? (
          <p className="errtxt" role="alert">
            {s.readError}
          </p>
        ) : null}
        {serverError ? (
          <p className="errtxt" role="alert">
            {serverError}
          </p>
        ) : null}
        <div className="actions" style={{ justifyContent: 'space-between' }}>
          <button type="button" className="btn btn--ghost" onClick={() => setStrokes([])} disabled={pending}>
            {s.clear}
          </button>
          <button
            type="button"
            className="btn btn--gold"
            onClick={submit}
            disabled={pending}
            style={{ minWidth: 200, minHeight: 52, fontSize: 16 }}
          >
            {pending ? s.signing : s.sign}
          </button>
        </div>
      </section>
    </div>
  );
}

function SignaturePad(props: {
  enabled: boolean;
  strokes: Stroke[];
  onChange: (s: Stroke[]) => void;
  hint: string;
  invalid: boolean;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const current = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>(props.strokes);
  strokesRef.current = current.current ? strokesRef.current : props.strokes;

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const g = c.getContext('2d')!;
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
  }, []);

  useEffect(() => {
    const c = canvasRef.current!;
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
  }, [draw]);
  useEffect(() => draw(), [props.strokes, draw]);

  const point = (e: React.PointerEvent): [number, number, number] => {
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
        id="sigpad"
        ref={canvasRef}
        role="img"
        aria-label={props.label}
        data-testid="signature"
        style={{ color: 'var(--ink)' }}
        onPointerDown={(e) => {
          if (!props.enabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = [point(e)];
          draw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          const events =
            typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [];
          if (events.length) for (const ev of events) current.current.push(point(ev as unknown as React.PointerEvent));
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
      <span className="baseline" />
      <span className="x" aria-hidden="true">
        ×
      </span>
      {props.strokes.length === 0 ? <span className="ph">{props.hint}</span> : null}
    </div>
  );
}
