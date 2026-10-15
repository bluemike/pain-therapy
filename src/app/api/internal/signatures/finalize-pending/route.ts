import { verifyInternalToken } from '@pain-therapy/shared/internal-auth';
import { config } from '@/lib/config';
import { finalizePending } from '@/lib/signing';

export const dynamic = 'force-dynamic';

/**
 * Rückfall of design D7: the job caj-pain-therapy-finalize calls this every 5 minutes (scripts/finalize-pending.mjs).
 * Creates the PDF of every signed session without a document that is older than a minute.
 */
export async function POST(req: Request) {
  if (!verifyInternalToken('finalize-pending', config.internalSecret, req.headers.get('authorization')))
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  return Response.json(await finalizePending());
}
