/** Ayanta wordmark. Replace with the official SVG logo from Ayanta once available (task 3.1). */
export function Logo({ appName }: { appName?: string }) {
  return (
    <span className="logo">
      <span className="mark">
        ayanta<i>.</i>
      </span>
      {appName ? <span className="app">{appName}</span> : null}
    </span>
  );
}
