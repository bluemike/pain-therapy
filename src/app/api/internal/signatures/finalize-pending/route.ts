import { verifyInternalToken } from '@pain-therapy/shared/internal-auth';
import { config } from '@/lib/config';
import { finalizePending } from '@/lib/signing';
import { ensurePlatformAdmin, removeDueBlobs } from '@/lib/platform';
import { exportHousekeeping } from '@/lib/practice-export';
import { deleteStaleHandoffPhotos } from '@/lib/photo-handoff';

export const dynamic = 'force-dynamic';

/**
 * Rückfall of design D7: the job caj-pain-therapy-finalize calls this every 5 minutes (scripts/finalize-pending.mjs).
 * Creates the PDF of every signed session without a document that is older than a minute. Iteration 12 adds the
 * housekeeping of the platform: exports after 24 hours, files of deleted practices after their retention, and the
 * invitation of the platform account while none exists; iteration 15 the photos from the phone never saved.
 */
export async function POST(req: Request) {
  if (!verifyInternalToken('finalize-pending', config.internalSecret, req.headers.get('authorization')))
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  const signatures = await finalizePending();
  const run = <T>(name: string, fn: () => Promise<T>) =>
    fn().catch((e: unknown) => {
      console.error(`finalize-pending: ${name} failed`, e);
      return { error: true };
    });
  return Response.json({
    ...signatures,
    exports: await run('exports', () => exportHousekeeping()),
    blobs: await run('blobs', () => removeDueBlobs()),
    platformAdmin: await run('platformAdmin', () => ensurePlatformAdmin()),
    // Iteration 15 (design D5): photos from the phone never saved, after 24 hours
    handoffPhotos: await run('handoffPhotos', () => deleteStaleHandoffPhotos()),
  });
}
