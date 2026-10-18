'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { SheetSegments } from '@/lib/exercise-sheets';
import { ExerciseImage } from './ExerciseImage';

type Texts = {
  segments: SheetSegments | null;
  tools: string[];
  standardAids: string[];
  variants: { number: number; aids: string[] }[];
};

/**
 * home-exercises: Zugeschnittenes Übungsblatt (iteration 9). The name of a prescribed exercise in the Selbstausführung
 * opens its sheet as prescribed: the FRM and the chosen EPD (Standardübung or the one variant), nothing else.
 */
export function TailoredSheet({
  code,
  name,
  variant,
  epd,
}: {
  code: string;
  name: string;
  /** null = Standardübung */
  variant: number | null;
  /** Label of the EPD, e.g. "Standard" or "Variante 2" */
  epd: string;
}) {
  const t = useTranslations('exercise');
  const ref = useRef<HTMLDialogElement>(null);
  const [texts, setTexts] = useState<Texts | null | 'error'>(null);
  const hId = `ts-h-${code}`;

  function open() {
    ref.current?.showModal();
    if (texts && texts !== 'error') return;
    fetch(`/api/exercises/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Texts>) : Promise.reject(new Error(String(r.status)))))
      .then(setTexts, () => setTexts('error'));
  }

  const seg = texts && texts !== 'error' ? texts.segments : null;
  const aids =
    texts && texts !== 'error'
      ? variant
        ? (texts.variants.find((v) => v.number === variant)?.aids ?? [])
        : texts.standardAids
      : [];
  const chosen = seg && variant ? seg.variants.items.find((v) => v.number === variant) : null;

  return (
    <>
      <button type="button" className="linkbtn" onClick={open} aria-haspopup="dialog">
        <b>{code}</b> {name}
      </button>
      <dialog
        ref={ref}
        className="modal lightbox tsheet"
        aria-labelledby={hId}
        data-testid={`tailored-${code}`}
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      >
        <header>
          <h2 id={hId}>
            {code} {name} · {epd}
          </h2>
          <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()}>
            {t('close')}
          </button>
        </header>
        <div className="body">
          <h3>
            {t('sectionRolling')}
            {texts && texts !== 'error' && texts.tools.length ? ` · ${texts.tools.join(', ')}` : ''}
          </h3>
          <ExerciseImage className="lbimg" code={code} kind="frm" alt={t('bandOf', { code, part: 'FRM' })} />
          {seg?.frm.items.map((x, i) => (
            <p key={i}>
              {x.n.length ? <b>({x.n.join('/')}) </b> : null}
              {x.text}
            </p>
          ))}
          <h3>
            {t('sectionStretch')} · {epd}
            {aids.length ? ` · ${aids.join(', ')}` : ''}
          </h3>
          <ExerciseImage
            className="lbimg"
            code={code}
            kind={variant ? 'var' : 'std'}
            alt={t('bandOf', { code, part: epd })}
          />
          {seg && !variant ? (
            <>
              {seg.standard.intro ? <p>{seg.standard.intro}</p> : null}
              {seg.standard.steps.map((st, i) => (
                <p key={i}>
                  {st.label ? <b>{st.label}: </b> : null}
                  {st.text}
                </p>
              ))}
              {seg.standard.note ? <p className="muted">{seg.standard.note}</p> : null}
            </>
          ) : null}
          {chosen ? (
            <>
              {seg?.variants.intro ? <p>{seg.variants.intro}</p> : null}
              <p>
                <b>{t('variantN', { n: chosen.number })}: </b>
                {chosen.text}
              </p>
            </>
          ) : null}
          {texts === 'error' ? <p className="muted">{t('notCaptured')}</p> : null}
        </div>
      </dialog>
    </>
  );
}
