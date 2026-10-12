import { getStroke } from 'perfect-freehand';

export type Stroke = [number, number, number][];

/** perfect-freehand options shared by the signature pad and the server (design D6). */
export function strokeOptions(points: Stroke) {
  const realPressure = points.some((p) => p[2] !== 0.5);
  return { size: 4.2, thinning: 0.6, smoothing: 0.55, streamline: 0.45, simulatePressure: !realPressure };
}

/** Outline polygon of a stroke as an SVG path. */
export function strokePath(points: Stroke): string {
  const outline = getStroke(points, strokeOptions(points));
  if (!outline.length) return '';
  const d = outline.reduce<(string | number)[]>(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(r(x0), r(y0), r((x0 + x1) / 2), r((y0 + y1) / 2));
      return acc;
    },
    ['M', r(outline[0][0]), r(outline[0][1]), 'Q'],
  );
  return d.join(' ') + ' Z';
}

const r = (n: number) => Math.round(n * 100) / 100;

/** Builds the stored signature SVG from raw points. The server never trusts an SVG sent by the browser. */
export function signatureSvg(strokes: Stroke[], width: number, height: number): { svg: string; paths: string[] } {
  const paths = strokes.map(strokePath).filter(Boolean);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(width)} ${r(height)}" width="${r(width)}" height="${r(height)}">${paths
    .map((d) => `<path d="${d}" fill="#1b2a5c"/>`)
    .join('')}</svg>`;
  return { svg, paths };
}
