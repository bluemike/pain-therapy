'use client';

import { useState } from 'react';

/**
 * Column «Lage» of the session (iteration 15, design D1): the code in an abbr with the full name as title; a tap
 * shows the same name in a small popover, because the iPad never shows a title.
 */
export function PositionCell({ code, label }: { code: string | null; label: string }) {
  const [open, setOpen] = useState(false);
  if (!code) return null;
  return (
    <span className="lage">
      <button
        type="button"
        className="lage-btn"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
      >
        <abbr title={label}>{code}</abbr>
      </button>
      {open ? (
        <span className="lage-pop" role="tooltip">
          {label}
        </span>
      ) : null}
    </span>
  );
}
