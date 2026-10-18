'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * app-navigation (iteration 9, design D1): the initials button opens a menu with "Mein Profil" and "Abmelden".
 * A tap outside, Escape or a navigation closes it.
 */
export function UserMenu({
  initials,
  name,
  role,
  menuLabel,
  profileLabel,
  signOut,
}: {
  initials: string;
  name: string;
  role: string;
  menuLabel: string;
  profileLabel: string;
  /** The sign-out form (server action) */
  signOut: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="user" ref={ref}>
      <div className="uname">
        <b>{name}</b>
        <small>{role}</small>
      </div>
      <button
        type="button"
        className="avatar avatarbtn"
        aria-label={menuLabel}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {initials}
      </button>
      <div id={id} className="usermenu" hidden={!open}>
        <div className="who-m">
          <b>{name}</b>
          <small>{role}</small>
        </div>
        <Link className="item" href="/profile">
          {profileLabel}
        </Link>
        {signOut}
      </div>
    </div>
  );
}
