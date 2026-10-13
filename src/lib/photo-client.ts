import { exifDateTime } from './jpeg';

/**
 * clinical-photos in the browser (design D5): time taken from EXIF, then resized to at most 2048 px and re-encoded
 * as JPEG through a canvas. Re-encoding drops all metadata including the location and turns HEIC into JPEG.
 */

export const MAX_EDGE = 2048;
export const THUMB_EDGE = 360;
const QUALITY = 0.85;

export type ProcessedPhoto = {
  key: string;
  photo: Blob;
  thumb: Blob;
  /** ISO time the photo was taken (EXIF DateTimeOriginal), else the time it was chosen */
  takenAt: string;
  previewUrl: string;
};

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  // createImageBitmap applies the EXIF orientation by default
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height };
    } catch {
      // fall through to <img>, which also decodes HEIC on Safari
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(src: CanvasImageSource, w: number, h: number, edge: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, edge / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No canvas');
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), 'image/jpeg', quality),
  );
}

/** Time from EXIF ("2026-10-13T09:15:02", camera local time) as ISO, or the current time */
function takenAt(head: Uint8Array): string {
  const local = exifDateTime(head);
  const d = local ? new Date(local) : null;
  return d && !Number.isNaN(d.getTime()) && d.getTime() <= Date.now() + 5 * 60_000
    ? d.toISOString()
    : new Date().toISOString();
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  // EXIF sits at the start of the file; 256 KB covers it including embedded previews
  const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
  const time = takenAt(head);
  const { source, width, height } = await decode(file);
  const photo = await encode(source, width, height, MAX_EDGE, QUALITY);
  const thumb = await encode(source, width, height, THUMB_EDGE, 0.8);
  if ('close' in source && typeof source.close === 'function') source.close();
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    photo,
    thumb,
    takenAt: time,
    previewUrl: URL.createObjectURL(thumb),
  };
}
