'use client';

import { createContext, useContext } from 'react';
import type { AudioLanguage } from '@pain-therapy/shared/audio-language';

/** Hörsprache of the signed-in user (iteration 15, design D3): English interface = en, otherwise from «Mein Profil» */
const Ctx = createContext<AudioLanguage>('de');

export function AudioLanguageProvider({ value, children }: { value: AudioLanguage; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAudioLanguage = () => useContext(Ctx);
