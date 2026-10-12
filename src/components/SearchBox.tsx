'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SearchIcon } from './Icons';

/** Search field that updates the ?q= parameter as the user types. */
export function SearchBox({
  placeholder,
  id = 'q',
  autoFocus,
}: {
  placeholder: string;
  id?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function onChange(v: string) {
    setValue(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (v.trim()) next.set('q', v);
      else next.delete('q');
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    }, 250);
  }
  return (
    <form className="search" role="search" onSubmit={(e) => e.preventDefault()}>
      <SearchIcon />
      <input
        id={id}
        type="search"
        placeholder={placeholder}
        aria-label={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
      />
    </form>
  );
}
