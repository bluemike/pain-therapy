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
