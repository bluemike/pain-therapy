// Iteration 12 (design D10): the former host names (pain-therapy.ayanta.ch, www.pain-therapy.online) redirect to
// AUTH_URL, so that passkeys and session cookies stay on one host. The internal calls of the zone and the jobs use
// the default host name of the Container App and are not affected. Edge-safe: no Node imports.

/** Target URL on AUTH_URL when the request came in on one of the comma-separated legacy hosts, else null. */
export function legacyTarget(
  headers: Headers,
  url: URL,
  legacyHosts: string | undefined,
  authUrl: string | undefined,
): URL | null {
  const hosts = (legacyHosts ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (!hosts.length || !authUrl) return null;
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '')
    .split(',')[0]
    .split(':')[0]
    .trim()
    .toLowerCase();
  if (!hosts.includes(host)) return null;
  return new URL(url.pathname + url.search, authUrl);
}
