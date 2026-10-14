'use client';
import { useRef, type ReactNode } from 'react';

/**
 * adherence-overview: trend popup next to the average rating. Native popover (light dismiss, Esc), placed at the
 * button that opened it and kept inside the viewport.
 */
export function TrendPopover({
  id,
  title,
  openLabel,
  closeLabel,
  children,
}: {
  id: string;
  title: ReactNode;
  openLabel: string;
  closeLabel: string;
  children: ReactNode;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const place = (e: { newState?: string }) => {
    const b = btn.current;
    const p = pop.current;
    if (!b || !p) return;
    if (e.newState !== 'open') {
      delete p.dataset.placed;
      return;
    }
    const gap = 8;
    const r = b.getBoundingClientRect();
    const pw = p.offsetWidth;
    const ph = p.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clamp = (v: number, max: number) => Math.max(gap, Math.min(v, max - gap));
    let left: number;
    let top: number;
    if (r.bottom + gap + ph <= vh - gap || r.top - gap - ph >= gap) {
      // below the button, or above it when there is no room below; right edges aligned
      left = clamp(r.right - pw, vw - pw);
      top = r.bottom + gap + ph <= vh - gap ? r.bottom + gap : r.top - gap - ph;
    } else {
      // not enough height either way: beside the button, so it stays visible
      left = r.left - gap - pw >= gap ? r.left - gap - pw : clamp(r.right + gap, vw - pw);
      top = clamp(r.top + r.height / 2 - ph / 2, vh - ph);
    }
    p.style.left = `${left}px`;
    p.style.top = `${top}px`;
    p.dataset.placed = '';
  };

  return (
    <>
      <button ref={btn} type="button" className="trendbtn" popoverTarget={id} aria-label={openLabel} title={openLabel}>
        ↗
      </button>
      <div ref={pop} id={id} popover="auto" className="trendpop" onToggle={(e) => place(e.nativeEvent as ToggleEvent)}>
        <div className="trendpop-head">
          <b>{title}</b>
          <button
            type="button"
            className="trendpop-close"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label={closeLabel}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
