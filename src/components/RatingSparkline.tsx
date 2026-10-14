/** adherence-overview: Bewertung im Verlauf (mockup view 4), ratings 1 to 10 oldest first as a small line */
export function RatingSparkline({ ratings, label }: { ratings: number[]; label: string }) {
  if (!ratings.length) return <span className="muted">–</span>;
  const w = 110;
  const h = 28;
  const x = (i: number) => (ratings.length === 1 ? w / 2 : 4 + (i * (w - 8)) / (ratings.length - 1));
  const y = (v: number) => h - 3 - ((v - 1) * (h - 6)) / 9;
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <polyline points={ratings.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      {ratings.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} />
      ))}
    </svg>
  );
}

/** "↗ 62 % → 73 %": the last two calendar weeks of the trend */
export function trendText(trend: { percent: number | null }[]): string {
  const known = trend.filter((w) => w.percent !== null).map((w) => w.percent!);
  if (known.length < 2) return '–';
  const [prev, cur] = known.slice(-2);
  const arrow = cur > prev ? '↗' : cur < prev ? '↘' : '→';
  return `${arrow} ${prev} % → ${cur} %`;
}

/**
 * adherence-overview: Bewertung im Verlauf as a full chart for the trend popup. Fixed scale 1 to 10, one point per
 * rating in time order, labelled with date and time (Zurich).
 */
export function RatingTrendChart({
  ratings,
  label,
  formatAt,
}: {
  ratings: { at: Date; rating: number }[];
  label: string;
  formatAt: (d: Date) => string;
}) {
  const w = 460;
  const h = 250;
  const left = 34;
  const right = 16;
  const top = 12;
  const bottom = 46;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const n = ratings.length;
  const x = (i: number) => left + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => top + plotH - ((v - 1) * plotH) / 9;
  const every = Math.max(1, Math.ceil(n / 6));
  return (
    <svg className="trendchart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {Array.from({ length: 10 }, (_, k) => k + 1).map((v) => (
        <g key={v}>
          <line className="grid" x1={left} x2={w - right} y1={y(v)} y2={y(v)} />
          <text className="ylab" x={left - 8} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <line className="axis" x1={left} x2={left} y1={top} y2={top + plotH} />
      <line className="axis" x1={left} x2={w - right} y1={top + plotH} y2={top + plotH} />
      {n > 1 && <polyline points={ratings.map((r, i) => `${x(i)},${y(r.rating)}`).join(' ')} />}
      {ratings.map((r, i) => {
        const [date, time] = formatAt(r.at).split(' ');
        const show = i === n - 1 || (i % every === 0 && n - 1 - i >= every);
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(r.rating)} r={4}>
              <title>{`${formatAt(r.at)}: ${r.rating}`}</title>
            </circle>
            {show && (
              <text
                className="xlab"
                x={x(i)}
                y={top + plotH + 18}
                textAnchor={n > 1 && i === 0 ? 'start' : n > 1 && i === n - 1 ? 'end' : 'middle'}
              >
                <tspan x={x(i)}>{date.slice(0, 6)}</tspan>
                <tspan x={x(i)} dy="14">
                  {time}
                </tspan>
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
