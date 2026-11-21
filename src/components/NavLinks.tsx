'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';

type Item = { href: string; label: string };

const matches = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

/** The most specific item is the current one: «Team» under /practice/team, not also «Praxis» */
function isActive(pathname: string, href: string, items: Item[]) {
  if (!matches(pathname, href)) return false;
  return !items.some((i) => i.href.length > href.length && matches(pathname, i.href));
}

export function NavLinks({ items }: { items: Item[] }) {
  const pathname = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={isActive(pathname, i.href, items) ? 'page' : undefined}>
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
        <Menu size={20} aria-hidden="true" />
      </button>
      <div id="drawer" className="drawer" data-open={open}>
        {items.map((i) => (
          <Link
            key={i.href}
            className="item"
            href={i.href}
            aria-current={isActive(pathname, i.href, items) ? 'page' : undefined}
          >
            {i.label}
          </Link>
        ))}
        <div className="row">{children}</div>
      </div>
    </>
  );
}
