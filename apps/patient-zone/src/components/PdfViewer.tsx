'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * app-navigation (iteration 9, design D3): a PDF in the app instead of a new tab. pdf.js draws every page, because
 * Safari on iPad and iPhone often shows only the first page of an embedded PDF. "Zurück" goes back in the history
 * (keeping the previous page as it was), or to backHref when the viewer was opened directly.
 */
export function PdfViewer({
  src,
  title,
  backHref,
  labels,
}: {
  src: string;
  title: string;
  backHref: string;
  labels: { back: string; download: string; loading: string; error: string; page: string };
}) {
  const pages = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const container = pages.current;
    if (!container) return;
    (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString();
        const doc = await pdfjs.getDocument({ url: src }).promise;
        const width = Math.min(container.clientWidth || 800, 1000);
        const ratio = window.devicePixelRatio || 1;
        for (let n = 1; n <= doc.numPages && !cancelled; n++) {
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
          canvas.setAttribute('role', 'img');
          canvas.setAttribute(
            'aria-label',
            labels.page.replace('{n}', String(n)).replace('{total}', String(doc.numPages)),
          );
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        }
        if (!cancelled) setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [src, labels.page]);

  const back = () => {
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) window.history.back();
    else window.location.assign(backHref);
  };

  return (
    <div className="pdfview" data-testid="pdf-viewer" data-state={state}>
      <div className="pdfbar">
        <button type="button" className="btn" onClick={back}>
          ← {labels.back}
        </button>
        <h1>{title}</h1>
        <a className="btn" href={src} download>
          {labels.download}
        </a>
      </div>
      {state === 'loading' ? (
        <p className="muted pdfmsg" role="status">
          {labels.loading}
        </p>
      ) : null}
      {state === 'error' ? (
        <p className="pdfmsg" role="alert">
          {labels.error}{' '}
          <a href={src} download>
            {labels.download}
          </a>
        </p>
      ) : null}
      <div className="pdfpages" ref={pages} />
    </div>
  );
}
