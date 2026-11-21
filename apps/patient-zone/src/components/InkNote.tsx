/**
 * zone-record (iteration 10, design D6): a remark the practice wrote by hand, as the SVG built by the practice app
 * (paths only), on light paper so it reads in dark mode too.
 */
export function InkNote({ svg, alt }: { svg: string; alt: string }) {
  return (
    <figure className="ink">
      {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data, no optimisation */}
      <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt={alt} />
    </figure>
  );
}
