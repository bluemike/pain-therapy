import { describe, expect, it } from 'vitest';
import { exifDateTime, isJpeg, jpegSize, stripMetadata } from '@/lib/jpeg';
import { PhotoError, preparePhotos } from '@/lib/photos';
import { TINY_JPEG, withExif } from '../fixtures/jpeg';

/** clinical-photos: JPEG-Prüfung, Grenzen und Entfernen der Metadaten (tasks 4.3, 4.4) */
describe('JPEG checks', () => {
  it('recognises a JPEG and reads its pixel size', () => {
    expect(isJpeg(TINY_JPEG)).toBe(true);
    expect(isJpeg(Buffer.from('%PDF-1.7'))).toBe(false);
    expect(jpegSize(TINY_JPEG)).toEqual({ width: 64, height: 48 });
  });

  it('reads the capture time from EXIF, also from the first part of a file only', () => {
    const photo = withExif(TINY_JPEG);
    expect(exifDateTime(photo)).toBe('2026-10-13T09:15:02');
    expect(exifDateTime(photo.subarray(0, 200))).toBe('2026-10-13T09:15:02');
    expect(exifDateTime(TINY_JPEG)).toBeNull();
  });

  it('removes EXIF with the GPS position and keeps the image (Standort entfernt)', () => {
    const photo = withExif(TINY_JPEG);
    expect(photo.includes('Exif')).toBe(true);
    const clean = stripMetadata(photo);
    expect(clean.includes('Exif')).toBe(false);
    expect(exifDateTime(clean)).toBeNull();
    expect(clean.equals(TINY_JPEG)).toBe(true);
    expect(jpegSize(clean)).toEqual({ width: 64, height: 48 });
  });
});

describe('preparing uploads', () => {
  it('rejects other file types, photos over 5 MB and more than 10 photos', () => {
    expect(() => preparePhotos('p', [{ data: Buffer.from('%PDF-1.7 fake') }])).toThrow(PhotoError);
    const big = Buffer.concat([TINY_JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    expect(() => preparePhotos('p', [{ data: big }])).toThrow('photoSize');
    expect(() =>
      preparePhotos(
        'p',
        Array.from({ length: 11 }, () => ({ data: TINY_JPEG })),
      ),
    ).toThrow('photoCount');
  });

  it('keeps the capture time from the browser but never a time in the future', () => {
    const now = new Date('2026-10-13T10:00:00Z');
    const [a, b, c] = preparePhotos(
      'p',
      [
        { data: TINY_JPEG, takenAt: '2026-10-13T07:15:02.000Z' },
        { data: TINY_JPEG, takenAt: '2027-01-01T00:00:00.000Z' },
        { data: TINY_JPEG, takenAt: 'nonsense' },
      ],
      now,
    );
    expect(a.takenAt.toISOString()).toBe('2026-10-13T07:15:02.000Z');
    expect(b.takenAt).toEqual(now);
    expect(c.takenAt).toEqual(now);
    expect(a.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(a.blobPath).toMatch(/^p\/[0-9a-f-]{36}\.jpg$/);
    // Without a thumbnail the photo itself is shown in lists
    expect(a.thumbPath).toBe(a.blobPath);
  });
});
