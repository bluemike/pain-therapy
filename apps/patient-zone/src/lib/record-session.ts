import 'server-only';
import { redirect } from 'next/navigation';
import { touchSession, type ZoneSession } from './access';
import { zoneAudit } from './audit';
import { getZoneSession } from './session';

/**
 * Pages of the record (zone-record, iteration 6, design D6): a pending signature comes first, without a session the
 * neutral start page. Marks the session as seen and logs the view like the other pages.
 */
export async function recordSession(): Promise<ZoneSession> {
  const s = await getZoneSession();
  if (!s) redirect('/');
  if (s.signaturePending) redirect('/unterschrift');
  await touchSession(s);
  await zoneAudit('zone.viewed', { patientId: s.patient.id, linkId: s.session.linkId });
  return s;
}
