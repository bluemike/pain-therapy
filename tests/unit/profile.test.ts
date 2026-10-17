import { describe, expect, it } from 'vitest';
import { shouldGreet } from '@/lib/greeting';
import { presetFor } from '@/lib/profile-presets';
import { profileSchema } from '@/lib/schemas';
import { isMediaKind, mediaFileOf } from '@/lib/exercise-sheets';

/** user-profile (iteration 8, design D9) */
describe('profile and greeting', () => {
  it('greets once per sign-in (Hallo nur nach dem Anmelden)', () => {
    expect(shouldGreet(undefined, 1_760_000_000)).toBe(true);
    expect(shouldGreet('1760000000', 1_760_000_000)).toBe(false);
    // A new sign-in has a new time and is greeted again
    expect(shouldGreet('1760000000', 1_760_090_000)).toBe(true);
    // Sessions from before iteration 8 carry no sign-in time: no greeting
    expect(shouldGreet(undefined, undefined)).toBe(false);
  });

  it('presets Chrissie as Therapeutin and Mike as Therapeut', () => {
    expect(presetFor('Christina.Franz@ayanta.ch')).toEqual({ displayName: 'Chrissie', title: 'THERAPIST_F' });
    expect(presetFor('mike.franz@ayanta.ch')).toEqual({ displayName: 'Mike', title: 'THERAPIST_M' });
    expect(presetFor('someone@ayanta.ch')).toBeUndefined();
  });

  it('requires a display name and a known title', () => {
    expect(profileSchema.parse({ displayName: ' Chrissie ', title: 'THERAPIST_F' })).toEqual({
      displayName: 'Chrissie',
      title: 'THERAPIST_F',
    });
    expect(profileSchema.safeParse({ displayName: '', title: 'THERAPIST_F' }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: 'Mike', title: 'DOCTOR' }).success).toBe(false);
  });
});

/** exercise-segments (iteration 8, design D6): media of the bands and the audio per segment */
describe('exercise media kinds', () => {
  const sheet = { mainImage: '2A.jpg', sheetImage: '2A-blatt.png' };
  it('names band images and segment audio in the container exercise-media', () => {
    expect(['frm', 'std', 'var', 'frm-audio', 'std-audio', 'v1-audio', 'v12-audio'].every(isMediaKind)).toBe(true);
    expect(['v0-audio', 'v-audio', 'x', '../2A'].some(isMediaKind)).toBe(false);
    expect(mediaFileOf('2A', 'main', sheet)).toBe('2A.jpg');
    expect(mediaFileOf('2A', 'audio', sheet)).toBe('2A.mp3');
    expect(mediaFileOf('2A', 'frm', sheet)).toBe('2A-frm.png');
    expect(mediaFileOf('2A', 'var', sheet)).toBe('2A-var.png');
    expect(mediaFileOf('2A', 'std-audio', sheet)).toBe('2A-std.mp3');
    expect(mediaFileOf('2A', 'v3-audio', sheet)).toBe('2A-V3.mp3');
  });
});
