import type { ProfessionalTitle } from '@prisma/client';

/**
 * user-profile (iteration 8, design D9): preset for the first sign-in, like the migration does for existing users
 * (Mike Franz, 17.10.2026). No server imports: used by the sign-in callback.
 */
const PRESETS: Record<string, { displayName: string; title: ProfessionalTitle }> = {
  'christina.franz@ayanta.ch': { displayName: 'Chrissie', title: 'THERAPIST_F' },
  'mike.franz@ayanta.ch': { displayName: 'Mike', title: 'THERAPIST_M' },
  // Iteration 12: the new addresses under pain-therapy.online
  'christina.franz@pain-therapy.online': { displayName: 'Chrissie', title: 'THERAPIST_F' },
};

export const presetFor = (email: string) => PRESETS[email.trim().toLowerCase()];
