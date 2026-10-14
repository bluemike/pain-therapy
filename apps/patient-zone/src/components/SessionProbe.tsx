'use client';

import { useEffect } from 'react';

/**
 * The session cookie is SameSite=Strict, so a link opened from an email arrives without it. This same-site request
 * carries the cookie; with a valid session the device goes straight to its exercises (Wiederkehren).
 */
export function SessionProbe() {
  useEffect(() => {
    fetch('/api/session', { cache: 'no-store' })
      .then((r) => {
        if (r.status === 204) window.location.replace('/');
      })
      .catch(() => {});
  }, []);
  return null;
}
