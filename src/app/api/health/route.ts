import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Liveness/readiness probe for Azure Container Apps. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'db-unavailable' }, { status: 503 });
  }
}
