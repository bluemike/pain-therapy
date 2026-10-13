/**
 * Server-side checks for clinical photos (design D5). The browser already re-encodes every photo through a canvas,
 * which drops all metadata; the server does not rely on that and removes metadata segments again.
 */

export const isJpeg = (b: Uint8Array) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

const SOS = 0xda;
const EOI = 0xd9;
/** Start-of-frame markers carry the pixel size (C4, C8 and CC are not frames) */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

type Segment = { marker: number; start: number; end: number };

/**
 * Header segments up to (not including) the image data. Throws on a malformed file; `partial` accepts a file cut
 * off after the header (the browser reads only the start of a large photo for EXIF).
 */
function segments(b: Uint8Array, partial = false): { list: Segment[]; dataStart: number } {
  const list: Segment[] = [];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) throw new Error('Malformed JPEG');
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    if (marker === SOS || marker === EOI) return { list, dataStart: i };
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) throw new Error('Malformed JPEG');
    if (i + 2 + len > b.length) {
      if (partial) return { list, dataStart: i };
      throw new Error('Malformed JPEG');
    }
    list.push({ marker, start: i, end: i + 2 + len });
    i += 2 + len;
  }
  if (partial) return { list, dataStart: i };
  throw new Error('Malformed JPEG');
}

/** Pixel size from the frame header, or null. */
export function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  try {
    const sof = segments(b).list.find((s) => SOF.has(s.marker));
    if (!sof) return null;
    const p = sof.start + 4;
    return { height: (b[p + 1] << 8) | b[p + 2], width: (b[p + 3] << 8) | b[p + 4] };
  } catch {
    return null;
  }
}

/**
 * Removes APP1 to APP15 (EXIF with GPS, XMP, ICC, maker notes) and comments. Keeps APP0 (JFIF) and everything
 * needed to decode the image.
 */
export function stripMetadata(b: Uint8Array): Buffer {
  const { list, dataStart } = segments(b);
  const keep = list.filter((s) => !((s.marker >= 0xe1 && s.marker <= 0xef) || s.marker === 0xfe));
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    ...keep.map((s) => Buffer.from(b.subarray(s.start, s.end))),
    Buffer.from(b.subarray(dataStart)),
  ]);
}

/**
 * DateTimeOriginal (EXIF tag 0x9003, else DateTime 0x0132) as "YYYY-MM-DDTHH:mm:ss" in the camera's local time,
 * or null. Used in the browser before the photo is re-encoded.
 */
export function exifDateTime(b: Uint8Array): string | null {
  try {
    const app1 = segments(b, true).list.find(
      (s) => s.marker === 0xe1 && String.fromCharCode(...b.subarray(s.start + 4, s.start + 8)) === 'Exif',
    );
    if (!app1) return null;
    const t = app1.start + 10; // TIFF header
    const le = b[t] === 0x49; // "II" little endian, "MM" big endian
    const u16 = (o: number) => (le ? b[t + o] | (b[t + o + 1] << 8) : (b[t + o] << 8) | b[t + o + 1]);
    const u32 = (o: number) => (le ? u16(o) + u16(o + 2) * 65536 : u16(o) * 65536 + u16(o + 2));
    const tags = (ifd: number) => {
      const out = new Map<number, number>();
      const n = u16(ifd);
      for (let k = 0; k < n; k++) {
        const e = ifd + 2 + k * 12;
        out.set(u16(e), e);
      }
      return out;
    };
    const ascii = (entry: number) => {
      const count = u32(entry + 4);
      const off = count > 4 ? u32(entry + 8) : entry + 8;
      return String.fromCharCode(...b.subarray(t + off, t + off + count)).replace(/\0.*$/, '');
    };
    const ifd0 = tags(u32(4));
    let value: string | null = null;
    const exifPtr = ifd0.get(0x8769);
    if (exifPtr !== undefined) {
      const original = tags(u32(exifPtr + 8)).get(0x9003);
      if (original !== undefined) value = ascii(original);
    }
    if (!value && ifd0.has(0x0132)) value = ascii(ifd0.get(0x0132)!);
    const m = value && /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(value);
    return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : null;
  } catch {
    return null;
  }
}
