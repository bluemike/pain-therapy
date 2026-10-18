/**
 * app-navigation (iteration 9, design D3): links to the in-app PDF view. Only relative paths of the app itself are
 * accepted as source and as way back, so the view cannot be pointed at another site.
 */
const RELATIVE = /^\/(?!\/)[^\s\\]*$/;

export const isRelativePath = (value: string | undefined | null): value is string =>
  typeof value === 'string' && value.length <= 500 && RELATIVE.test(value);

/** The source if it is a relative path starting with one of the allowed prefixes, otherwise null */
export function pdfSource(value: string | undefined | null, prefixes: readonly string[]): string | null {
  return isRelativePath(value) && prefixes.some((p) => value.startsWith(p)) ? value : null;
}

/** A safe way back; fallback when the value is missing or not a relative path */
export const backPath = (value: string | undefined | null, fallback: string) =>
  isRelativePath(value) ? value : fallback;

/** Link to the viewer page (practice app: /pdf, patient zone: /pdf) */
export function pdfViewHref(src: string, back: string, title?: string) {
  const q = new URLSearchParams({ src, back });
  if (title) q.set('title', title);
  return `/pdf?${q.toString()}`;
}
