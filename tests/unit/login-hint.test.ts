import { describe, expect, it } from 'vitest';
import { loginHintFrom } from '@/lib/login-hint';

describe('loginHintFrom', () => {
  it('accepts a remembered address and normalises it', () => {
    expect(loginHintFrom(' Mike.Franz@Ayanta.ch ')).toBe('mike.franz@ayanta.ch');
  });

  it('ignores missing or malformed values', () => {
    expect(loginHintFrom(undefined)).toBeUndefined();
    expect(loginHintFrom('')).toBeUndefined();
    expect(loginHintFrom('no-address')).toBeUndefined();
    expect(loginHintFrom('a@b')).toBeUndefined();
    expect(loginHintFrom('x"@y.ch')).toBeUndefined();
    expect(loginHintFrom(`${'a'.repeat(250)}@b.ch`)).toBeUndefined();
  });
});
