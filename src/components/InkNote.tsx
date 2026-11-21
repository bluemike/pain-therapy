import { asInk, inkDataUrl } from '@pain-therapy/shared/ink';

/**
 * handwritten-notes (iteration 10, design D6): a remark field as stored handwriting, scaled to the column width. The
 * SVG comes from the server (paths only), shown as an image on light paper so it reads in dark mode too.
 */
export function InkNote({ ink, alt }: { ink: unknown; alt: string }) {
  const note = asInk(ink);
  if (!note) return null;
  return (
    <figure className="ink">
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data, no optimisation */}
      <img src={inkDataUrl(note)} alt={alt} width={note.w} height={note.h} />
    </figure>
  );
}
