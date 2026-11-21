/**
 * exercise-audio (iteration 15, design D3): the recordings per part (FRM, Standardübung, each Variante) in Hochdeutsch,
 * English or Mundart, from the segment texts of the sheets:
 *   npm run media:audio-parts -- <segments.json> --lang de|en|gsw [--only 1A,2B] [--force]
 * - de: Azure AI Speech F0, de-CH-LeniNeural (as before): <code>-frm.mp3, <code>-std.mp3, <code>-V<n>.mp3
 * - en: Azure AI Speech F0, en-GB-SoniaNeural (AZURE_SPEECH_VOICE to change): <name>.en.mp3
 * - gsw: Google Gemini TTS with a Zurich German prompt (GEMINI_API_KEY, GEMINI_TTS_MODEL, GEMINI_TTS_VOICE):
 *   <name>.gsw.mp3; needs ffmpeg to turn the PCM answer into MP3
 * <segments.json> is segments.json (de), segments-content.en.json or segments-content.gsw.json, same structure; the
 * MP3s are written next to it and then uploaded to the container exercise-media (docs/deployment.md). Existing files
 * are skipped unless --force. Only the L&B texts go to the speech services, never patient data.
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { audioFileIn, isAudioLanguage, type AudioLanguage } from '../packages/shared/src/audio-language';
import { forSpeech, speechSsml } from '../src/lib/exercise-audio';

type Segments = {
  code: string;
  name: string;
  frm: { items: { n: number[]; text: string }[] };
  standard: { intro: string | null; steps: { label: string; text: string }[]; note: string | null };
  variants: { intro: string | null; items: { id: string; n: number[]; text: string }[] };
};

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const force = args.includes('--force') && !!args.splice(args.indexOf('--force'), 1);
const lang = flag('--lang') ?? 'de';
const only = flag('--only')?.split(',');
const file = path.resolve(args[0] ?? 'segments.json');

/** Spoken intros per language; Mundart as written by the practice (Chrissie reviews every file) */
const INTRO: Record<AudioLanguage, { frm: string; std: string; variant: string; and: string }> = {
  de: { frm: 'Faszien-Rollmassage zur Übung', std: 'Engpassdehnung', variant: 'Variante', and: 'und' },
  en: { frm: 'Fascia rolling massage for exercise', std: 'Stretch', variant: 'Variation', and: 'and' },
  gsw: { frm: 'Faszie-Rollmassage zur Üebig', std: 'Engpassdehnig', variant: 'Variante', and: 'und' },
};
const VOICE: Record<'de' | 'en', string> = { de: 'de-CH-LeniNeural', en: 'en-GB-SoniaNeural' };

/** The files of a sheet with their sections, named like the app expects (exercise-sheets.ts, zone entries.ts) */
export function jobsOf(s: Segments, l: AudioLanguage): [string, string[]][] {
  const t = INTRO[l];
  const name = (base: string) => audioFileIn(`${base}.mp3`, l);
  return [
    [name(`${s.code}-frm`), [`${t.frm} ${s.code}, ${s.name}.`, ...s.frm.items.map((i) => i.text)]],
    [
      name(`${s.code}-std`),
      [
        `${t.std} ${s.code}, ${s.name}.`,
        ...(s.standard.intro ? [s.standard.intro] : []),
        ...s.standard.steps.map((st) => `${st.label}. ${st.text}`),
        ...(s.standard.note ? [s.standard.note] : []),
      ],
    ],
    ...s.variants.items.map((v): [string, string[]] => [
      name(v.id),
      [
        `${t.variant} ${v.n.join(` ${t.and} `)} – ${s.code}, ${s.name}.`,
        ...(s.variants.intro ? [s.variants.intro] : []),
        v.text,
      ],
    ]),
  ];
}

const exists = (f: string) =>
  stat(f).then(
    () => true,
    () => false,
  );
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function azure(sections: string[], voice: string): Promise<Buffer> {
  const key = process.env.AZURE_SPEECH_KEY;
  if (!key) throw new Error('AZURE_SPEECH_KEY is not set (docs/deployment.md)');
  const region = process.env.AZURE_SPEECH_REGION ?? 'switzerlandnorth';
  const spoken = voice.startsWith('de') ? sections.map(forSpeech) : sections.map((x) => x.replace(/\s+/g, ' ').trim());
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'pain-therapy-exercise-audio',
      },
      body: speechSsml(spoken, voice),
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // The free tier allows 20 requests per minute
    if (res.status === 429 && attempt < 6) {
      await sleep(Number(res.headers.get('retry-after') ?? 10) * 1000);
      continue;
    }
    throw new Error(`Azure Speech ${res.status}: ${await res.text()}`);
  }
}

/** Gemini TTS answers 24 kHz 16-bit mono PCM; ffmpeg turns it into the same MP3 format as Azure */
async function gemini(sections: string[]): Promise<Buffer> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set (Google AI Studio, docs/deployment.md)');
  const model = process.env.GEMINI_TTS_MODEL ?? 'gemini-2.5-flash-preview-tts';
  const voice = process.env.GEMINI_TTS_VOICE ?? 'Kore';
  const prompt =
    'Lies den folgenden Text auf Zürichdeutsch vor, ruhig, freundlich und deutlich, wie eine Physiotherapeutin, ' +
    'die einer Patientin eine Übung erklärt. Mache zwischen den Absätzen eine kurze Pause.\n\n' +
    sections.join('\n\n');
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[];
      };
      const data = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (!data) throw new Error('Gemini TTS: no audio in the answer');
      return toMp3(Buffer.from(data, 'base64'));
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await sleep(15_000 * attempt);
      continue;
    }
    throw new Error(`Gemini TTS ${res.status}: ${await res.text()}`);
  }
}

async function toMp3(pcm: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), 'gsw-'));
  try {
    const raw = path.join(dir, 'a.pcm');
    const mp3 = path.join(dir, 'a.mp3');
    await writeFile(raw, pcm);
    execFileSync('ffmpeg', [
      '-loglevel',
      'error',
      '-f',
      's16le',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-i',
      raw,
      '-b:a',
      '48k',
      mp3,
    ]);
    return await readFile(mp3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  if (!isAudioLanguage(lang)) throw new Error(`--lang must be de, en or gsw, not ${lang}`);
  const sheets = JSON.parse(await readFile(file, 'utf8')) as Segments[];
  const dir = path.dirname(file);
  let written = 0;
  let chars = 0;
  for (const s of sheets.filter((x) => !only || only.includes(x.code))) {
    for (const [name, sections] of jobsOf(s, lang)) {
      const out = path.join(dir, name);
      if (!force && (await exists(out))) continue;
      chars += sections.join(' ').length;
      const voice = process.env.AZURE_SPEECH_VOICE ?? (lang === 'en' ? VOICE.en : VOICE.de);
      await writeFile(out, lang === 'gsw' ? await gemini(sections) : await azure(sections, voice));
      console.log(name);
      written++;
    }
  }
  console.log(`${written} MP3s (${lang}) written to ${dir}, about ${chars} characters`);
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith('exercise-audio-parts'))
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
