/**
 * exercise-audio (iteration 15, design D3): recordings in Hochdeutsch (de), Mundart (gsw) and English (en). Shared by
 * the practice app and the patient zone; no server imports.
 */
export const AUDIO_LANGUAGES = ['de', 'gsw', 'en'] as const;
export type AudioLanguage = (typeof AUDIO_LANGUAGES)[number];
/** What a user or patient chooses while the interface is German */
export const GERMAN_AUDIO = ['de', 'gsw'] as const;
export type GermanAudio = (typeof GERMAN_AUDIO)[number];

export const isAudioLanguage = (v: unknown): v is AudioLanguage =>
  typeof v === 'string' && (AUDIO_LANGUAGES as readonly string[]).includes(v);

/** English interface: always English; German interface: the chosen Hochdeutsch or Mundart */
export function audioLanguageOf(ui: string, chosen: string | null | undefined): AudioLanguage {
  if (ui === 'en') return 'en';
  return chosen === 'gsw' ? 'gsw' : 'de';
}

/** "2A-frm.mp3" → "2A-frm.gsw.mp3"; Hochdeutsch keeps the existing names */
export function audioFileIn(file: string, lang: AudioLanguage): string {
  if (lang === 'de') return file;
  return file.replace(/\.mp3$/i, `.${lang}.mp3`);
}
