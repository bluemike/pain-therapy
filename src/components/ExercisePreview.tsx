'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FileText } from 'lucide-react';
import { ExerciseImage } from './ExerciseImage';

/**
 * exercise-audio (iteration 7, design D5): small main image of an exercise; a click opens the whole image in a popup.
 * With `sheet` (iteration 15, design D4) a button «Blatt ansehen» opens the whole exercise sheet instead.
 */
export function ExercisePreview({ code, name, sheet = false }: { code: string; name: string; sheet?: boolean }) {
  const t = useTranslations('exercise');
  const ref = useRef<HTMLDialogElement>(null);
  const hId = `expv-h-${sheet ? 'sheet-' : ''}${code}`;
  const kind = sheet ? 'sheet' : 'main';
  const alt = sheet ? t('sheetImage', { code }) : t('mainImage', { code });
  return (
    <>
      {sheet ? (
        <button
          type="button"
          className="btn btn--ghost sheetbtn"
          aria-label={t('openSheetOf', { code })}
          onClick={() => ref.current?.showModal()}
        >
          <FileText size={16} aria-hidden="true" />
          <span aria-hidden="true">{t('openSheet')}</span>
        </button>
      ) : (
        <button
          type="button"
          className="expv"
          aria-label={t('openImage', { code })}
          onClick={() => ref.current?.showModal()}
        >
          <ExerciseImage className="expvimg" code={code} kind="main" alt={alt} lazy />
        </button>
      )}
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
          <ExerciseImage className={`lbimg${sheet ? ' lbsheet' : ''}`} code={code} kind={kind} alt={alt} lazy />
        </div>
      </dialog>
    </>
  );
}
