'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { pdfViewHref } from '@pain-therapy/shared/pdf-view';

/** app-navigation (iteration 9, design D3): opens a PDF in the in-app view; "Zurück" returns to this page */
export function PdfLink({
  src,
  title,
  className = 'btn btn--ghost',
  style,
  children,
}: {
  src: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const back = search ? `${pathname}?${search}` : pathname;
  return (
    <Link className={className} style={style} href={pdfViewHref(src, back, title)}>
      {children}
    </Link>
  );
}
