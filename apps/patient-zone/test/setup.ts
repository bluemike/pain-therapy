import os from 'node:os';
import path from 'node:path';
import { inject, vi } from 'vitest';

// The patient zone connects with its own role; fixtures are written with the test user (test/fixtures.ts)
process.env.DATABASE_URL = inject('zoneUrl');
process.env.PATIENT_ZONE_SECRET = 'test-zone-secret';
process.env.STORAGE_DRIVER = 'local';
process.env.STORAGE_EXERCISE_LOCAL_DIR = path.join(os.tmpdir(), `pz-media-${process.pid}`);

vi.mock('server-only', () => ({}));
