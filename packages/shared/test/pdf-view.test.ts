import { describe, expect, it } from 'vitest';
import { backPath, pdfSource, pdfViewHref } from '../src/pdf-view';

describe('pdf view links', () => {
  it('accepts only relative app paths with an allowed prefix as source', () => {
    expect(pdfSource('/documents/abc', ['/documents/'])).toBe('/documents/abc');
    expect(pdfSource('/patients/p/x', ['/documents/'])).toBeNull();
    expect(pdfSource('//evil.example/x.pdf', ['/'])).toBeNull();
    expect(pdfSource('https://evil.example/x.pdf', ['/'])).toBeNull();
    expect(pdfSource('/documents/\\evil', ['/documents/'])).toBeNull();
    expect(pdfSource(undefined, ['/documents/'])).toBeNull();
  });

  it('falls back when the way back is not a relative path', () => {
    expect(backPath('/patients/1', '/')).toBe('/patients/1');
    expect(backPath('https://evil.example', '/')).toBe('/');
    expect(backPath(undefined, '/patients')).toBe('/patients');
  });

  it('builds the viewer link with encoded parameters', () => {
    expect(pdfViewHref('/documents/a?x=1', '/patients/1', 'Übungsblatt')).toBe(
      '/pdf?src=%2Fdocuments%2Fa%3Fx%3D1&back=%2Fpatients%2F1&title=%C3%9Cbungsblatt',
    );
  });
});
