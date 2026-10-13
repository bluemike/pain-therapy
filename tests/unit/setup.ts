import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5432/pain_therapy_test';
process.env.AUTH_SECRET = 'test-secret';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_LOCAL_DIR = path.join(os.tmpdir(), `pt-docs-${process.pid}`);
process.env.STORAGE_PHOTO_LOCAL_DIR = path.join(os.tmpdir(), `pt-photos-${process.pid}`);
// Empty unless a test writes placeholder media into it (tests/fixtures/exercise-media.ts)
process.env.STORAGE_EXERCISE_LOCAL_DIR = path.join(os.tmpdir(), `pt-exercise-media-${process.pid}`);
process.env.MAIL_DRIVER = 'outbox';
process.env.MAIL_OUTBOX_DIR = path.join(os.tmpdir(), `pt-outbox-${process.pid}`);

vi.mock('server-only', () => ({}));
