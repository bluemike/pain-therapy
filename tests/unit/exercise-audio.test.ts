import { describe, expect, it } from 'vitest';
import { audioFileOf, forSpeech, speechSections, speechSsml } from '@/lib/exercise-audio';

describe('exercise audio (iteration 7)', () => {
  it('names the audio like the main image', () => {
    expect(audioFileOf('2A.jpg')).toBe('2A.mp3');
    expect(audioFileOf('4G.jpeg')).toBe('4G.mp3');
  });

  it('reads the sheet in its order: title, Rollmassage, steps, Varianten', () => {
    expect(
      speechSections('2A', '2A Nacken-Übung', {
        rolling: ' Langsam rollen. ',
        steps: [
          { label: 'Schritt 1', text: 'Kopf neigen, 2 × 30 s halten.' },
          { label: 'Schritt 2', text: '' },
          { label: '', text: 'Ohne Bezeichnung.' },
        ],
        variants: null,
      }),
    ).toEqual([
      'Übung 2A, Nacken-Übung.',
      'Faszien-Rollmassage. Langsam rollen.',
      'Schritt 1. Kopf neigen, 2 mal 30 Sekunden halten.',
      'Ohne Bezeichnung.',
    ]);
  });

  it('speaks units and signs', () => {
    expect(forSpeech('ca. 2 min, dann 30s und 3x10')).toBe('ca. 2 Minuten, dann 30 Sekunden und 3 mal 10');
    expect(forSpeech('2 Seiten')).toBe('2 Seiten');
  });

  it('escapes the text in the SSML and pauses between sections', () => {
    const ssml = speechSsml(['A & B <C>', 'D'], 'de-CH-JanNeural');
    expect(ssml).toContain('xml:lang="de-CH"');
    expect(ssml).toContain('<voice name="de-CH-JanNeural">');
    expect(ssml).toContain('A &amp; B &lt;C&gt;<break time="900ms"/>D');
  });
});
