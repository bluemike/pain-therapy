'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ExerciseImage } from './ExerciseImage';

/**
 * exercise-audio (iteration 7, design D5): small main image of an exercise; a click opens the whole image in a popup.
 */
export function ExercisePreview({ code, name }: { code: string; name: string }) {
  const t = useTranslations('exercise');
  const ref = useRef<HTMLDialogElement>(null);
  const hId = `expv-h-${code}`;
  return (
    <>
      <button
        type="button"
        className="expv"
        aria-label={t('openImage', { code })}
        onClick={() => ref.current?.showModal()}
      >
        <ExerciseImage className="expvimg" code={code} kind="main" alt={t('mainImage', { code })} lazy />
      </button>
      <dialog
        ref={ref}
        className="modal lightbox"
        aria-labelledby={hId}
        onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      >
        <header>
          <h2 id={hId}>
            {code} {name}
          </h2>
          <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()}>
            {t('close')}
          </button>
        </header>
        <div className="body">
          <ExerciseImage className="lbimg" code={code} kind="main" alt={t('mainImage', { code })} />
        </div>
      </dialog>
    </>
  );
}
