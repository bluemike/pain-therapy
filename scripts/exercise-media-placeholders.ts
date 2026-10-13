/**
 * Writes synthetic placeholder exercise media for local development and the end-to-end tests:
 *   npm run media:placeholders [-- <dir>]      (default STORAGE_EXERCISE_LOCAL_DIR or ./data/exercise-media)
 * then `npm run catalog:sync` loads the placeholder texts. Never use this for the real container.
 */
import path from 'node:path';
import { writePlaceholderMedia } from '../tests/fixtures/exercise-media';

const dir = path.resolve(process.argv[2] ?? process.env.STORAGE_EXERCISE_LOCAL_DIR ?? './data/exercise-media');
writePlaceholderMedia(dir)
  .then((n) => console.log(`Placeholder media for ${n} exercises written to ${dir}`))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
