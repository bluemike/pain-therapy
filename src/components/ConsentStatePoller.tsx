'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Every 15 s, at most 15 minutes, so an open page does not keep the 30-minute sign-in alive forever */
export const POLL_MS = 15_000;
const MAX_POLLS = 60;

/**
 * zone-documents (iteration 9, design D5): while an invitation to sign is open or the PDF is still being created,
 * checks the signature state of the patient and reloads the page when it changed. Pauses while the tab is hidden.
 */
export function ConsentStatePoller({ patientId, state }: { patientId: string; state: string }) {
  const router = useRouter();
  useEffect(() => {
    let polls = 0;
    let stopped = false;
    const check = async () => {
      if (stopped || document.hidden) return;
      if (++polls > MAX_POLLS) return clearInterval(timer);
      try {
        const res = await fetch(`/api/patients/${patientId}/consent-state`, { cache: 'no-store' });
        if (!res.ok) return;
        const { state: now } = (await res.json()) as { state: string };
        if (!stopped && now !== state) {
          stopped = true;
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // Offline for a moment: try again at the next interval
      }
    };
    const timer = setInterval(check, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [patientId, state, router]);
  return null;
}
