import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** Liveness and readiness probe: a query with the role patient_zone on one of its tables (design D13) */
export async function GET() {
  try {
    await db.patientZoneSession.count({ where: { id: '' } });
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'db-unavailable' }, { status: 503 });
  }
}
