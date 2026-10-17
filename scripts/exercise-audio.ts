/**
 * exercise-audio (iteration 7, design D3): generates the spoken version of every exercise sheet with Azure AI Speech
 * (free tier F0, region Switzerland North), from the digitised texts in exercises-content.json:
 *   AZURE_SPEECH_KEY=… npm run media:audio -- <dir> [--voice de-CH-JanNeural] [--only 1A,2B] [--force]
 * <dir> is the folder with exercises-content.json (the OneDrive folder "digitalisiert"); the MP3s are written next
 * to it as <code>.mp3 and then uploaded to the container exercise-media like the images (docs/deployment.md).
 * Existing MP3s are skipped unless --force. Only the L&B texts go to the Speech service, never patient data.
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { contentByCode, normalizeContent } from '../prisma/catalog/sync.mjs';
import { audioFileOf, DEFAULT_VOICE, speechSections, speechSsml } from '../src/lib/exercise-audio';

type SheetRef = { code: string; title: string; mainImage: string; stretchStepLabels: string[] };

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.splice(i, 2)[1] : undefined;
};
const force = args.includes('--force') && !!args.splice(args.indexOf('--force'), 1);
const voice = flag('--voice') ?? process.env.AZURE_SPEECH_VOICE ?? DEFAULT_VOICE;
const only = flag('--only')?.split(',');
const dir = path.resolve(args[0] ?? process.env.STORAGE_EXERCISE_LOCAL_DIR ?? './data/exercise-media');
const key = process.env.AZURE_SPEECH_KEY;
const region = process.env.AZURE_SPEECH_REGION ?? 'switzerlandnorth';

const exists = (f: string) =>
  stat(f).then(
    () => true,
    () => false,
  );
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function synthesize(ssml: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'pain-therapy-exercise-audio',
      },
      body: ssml,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // The free tier allows 20 requests per minute
    if (res.status === 429 && attempt < 5) {
      await sleep(Number(res.headers.get('retry-after') ?? 10) * 1000);
      continue;
    }
    throw new Error(`Azure Speech ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  if (!key) throw new Error('AZURE_SPEECH_KEY is not set (az cognitiveservices account keys list, docs/deployment.md)');
  const sheets = JSON.parse(
    await readFile(path.resolve(__dirname, '../prisma/catalog/exercise-sheets.json'), 'utf8'),
  ) as SheetRef[];
  const content = contentByCode(JSON.parse(await readFile(path.join(dir, 'exercises-content.json'), 'utf8')));
  let written = 0;
  let chars = 0;
  for (const s of sheets.filter((x) => !only || only.includes(x.code))) {
    const file = path.join(dir, audioFileOf(s.mainImage));
    const c = normalizeContent(content?.get(s.code), s.stretchStepLabels);
    if (!c) {
      console.warn(`${s.code}: no texts in exercises-content.json, skipped`);
      continue;
    }
    if (!force && (await exists(file))) {
      console.log(`${s.code}: ${path.basename(file)} exists, skipped (--force to replace)`);
      continue;
    }
    const sections = speechSections(s.code, s.title, c);
    chars += sections.join(' ').length;
    await writeFile(file, await synthesize(speechSsml(sections, voice)));
    console.log(`${s.code}: ${path.basename(file)} written`);
    written++;
  }
  console.log(`${written} audio files written to ${dir} with ${voice}, about ${chars} characters`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
