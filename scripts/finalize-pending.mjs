// Job caj-pain-therapy-finalize (iteration 5, design D7, D11): every 5 minutes, asks the practice app to create the
// PDF of signatures from the patient zone that are still without one. Same HMAC as packages/shared/src/internal-auth.ts.
import { createHmac } from 'node:crypto';

const base = (process.env.PRACTICE_INTERNAL_URL ?? '').replace(/\/+$/, '');
const secret = process.env.ZONE_INTERNAL_SECRET ?? '';
if (!base || !secret) {
  console.error('PRACTICE_INTERNAL_URL and ZONE_INTERNAL_SECRET must be set');
  process.exit(1);
}
const token = createHmac('sha256', secret).update('finalize:finalize-pending', 'utf8').digest('hex');
const res = await fetch(`${base}/api/internal/signatures/finalize-pending`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(240_000),
});
const body = await res.text();
console.log(`finalize-pending: ${res.status} ${body}`);
if (!res.ok) process.exit(1);
