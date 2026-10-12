'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

type Item = { href: string; label: string };

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function NavLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(pathname, i.href) ? 'page' : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile menu (app-shell: iPhone im Hochformat) */
export function MobileMenu({
  items,
  menuLabel,
  children,
}: {
  items: Item[];
  menuLabel: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button
        className="burger"
        aria-label={menuLabel}
        aria-expanded={open}
        aria-controls="drawer"
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>
      <div id="drawer" className="drawer" data-open={open}>
        {items.map((i) => (
          <Link
            key={i.href}
            className="item"
            href={i.href}
            aria-current={isActive(pathname, i.href) ? 'page' : undefined}
          >
            {i.label}
          </Link>
        ))}
        <div className="row">{children}</div>
      </div>
    </>
  );
}
