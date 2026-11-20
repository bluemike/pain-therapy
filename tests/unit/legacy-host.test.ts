import { describe, expect, it } from 'vitest';
import { legacyTarget } from '@/lib/legacy-host';

const req = (host: string, path = '/patients?q=a') =>
  [new Headers({ host }), new URL(`https://${host}${path}`)] as const;
const LEGACY = 'pain-therapy.ayanta.ch,www.pain-therapy.online';
const AUTH = 'https://pain-therapy.online';

/** domain (iteration 12, design D10): former host names redirect to the new domain */
describe('legacy host redirect', () => {
  it('redirects the former host name with path and query', () => {
    expect(legacyTarget(...req('pain-therapy.ayanta.ch'), LEGACY, AUTH)?.toString()).toBe(
      'https://pain-therapy.online/patients?q=a',
    );
  });
  it('redirects www, case-insensitive and with a port', () => {
    expect(legacyTarget(...req('WWW.pain-therapy.online:443', '/'), LEGACY, AUTH)?.toString()).toBe(
      'https://pain-therapy.online/',
    );
  });
  it('prefers X-Forwarded-Host', () => {
    const h = new Headers({ host: 'ca-pain-therapy.internal', 'x-forwarded-host': 'pain-therapy.ayanta.ch' });
    expect(legacyTarget(h, new URL('http://x/login'), LEGACY, AUTH)?.toString()).toBe(
      'https://pain-therapy.online/login',
    );
  });
  it('leaves the new domain and the internal host alone', () => {
    expect(legacyTarget(...req('pain-therapy.online'), LEGACY, AUTH)).toBeNull();
    expect(
      legacyTarget(...req('ca-pain-therapy.niceocean.switzerlandnorth.azurecontainerapps.io'), LEGACY, AUTH),
    ).toBeNull();
  });
  it('does nothing without configuration', () => {
    expect(legacyTarget(...req('pain-therapy.ayanta.ch'), '', AUTH)).toBeNull();
    expect(legacyTarget(...req('pain-therapy.ayanta.ch'), LEGACY, undefined)).toBeNull();
  });
});
