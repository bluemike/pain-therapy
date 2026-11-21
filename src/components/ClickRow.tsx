'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Table row that opens `href` on a click anywhere in the row. The first cell still holds a real link for
 * keyboard and screen readers. Safari on iPad ignores `position: relative` on <tr>, so a stretched link
 * (a::after with inset 0) covered the whole table and every tap opened the last row (bug 21.11.2026).
 */
export function ClickRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className={['click', className].filter(Boolean).join(' ')}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a, button, input, select, textarea, label')) return;
        if (window.getSelection()?.toString()) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
