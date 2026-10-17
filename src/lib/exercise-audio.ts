import type { SheetContent } from './exercise-sheets';

/**
 * exercise-audio (iteration 7, design D2 and D3): the spoken version of an exercise sheet. The MP3 is generated once
 * with Azure AI Speech by scripts/exercise-audio.ts and sits next to the images in the private container
 * `exercise-media`, named like the main image: 1A.jpg → 1A.mp3.
 */

export const DEFAULT_VOICE = 'de-CH-LeniNeural';

export function audioFileOf(mainImage: string) {
  return mainImage.replace(/\.[^./]+$/, '') + '.mp3';
}

/** Spoken form of signs that the voice would read oddly or skip */
export function forSpeech(text: string) {
  return text
    .replace(/(\d)\s*[×x]\s*(\d)/g, '$1 mal $2')
    .replace(/×/g, ' mal ')
    .replace(/(\d)\s*s\b/g, '$1 Sekunden')
    .replace(/(\d)\s*min\b/g, '$1 Minuten')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** The sections in the order of the sheet: title, Faszien-Rollmassage, steps of the Engpassdehnung, Varianten */
export function speechSections(code: string, title: string, content: SheetContent) {
  const name = title.replace(new RegExp(`^${code}\\s*`), '').trim();
  const out = [`Übung ${code}${name ? `, ${name}` : ''}.`];
  if (content.rolling?.trim()) out.push(`Faszien-Rollmassage. ${content.rolling.trim()}`);
  for (const s of content.steps) {
    const text = s.text?.trim();
    if (text) out.push(s.label ? `${s.label}. ${text}` : text);
  }
  if (content.variants?.trim()) out.push(`Varianten. ${content.variants.trim()}`);
  return out.map(forSpeech);
}

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** SSML for Azure AI Speech: a pause between the sections, slightly slower so the patient can follow along */
export function speechSsml(sections: string[], voice = DEFAULT_VOICE) {
  const lang = voice.split('-').slice(0, 2).join('-');
  const body = sections.map(xml).join('<break time="900ms"/>');
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${lang}">` +
    `<voice name="${xml(voice)}"><prosody rate="-8%">${body}</prosody></voice></speak>`
  );
}
