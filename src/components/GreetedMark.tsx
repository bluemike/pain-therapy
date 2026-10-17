'use client';

import { useEffect } from 'react';
import { GREETED_COOKIE } from '@/lib/greeting';

/** Marks the current sign-in as greeted once the first page is shown (user-profile, design D9) */
export function GreetedMark({ authTime }: { authTime: number }) {
  useEffect(() => {
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${GREETED_COOKIE}=${authTime}; path=/; SameSite=Lax${secure}`;
  }, [authTime]);
  return null;
}
