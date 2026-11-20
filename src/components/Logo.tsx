/**
 * Platform wordmark «Pain Therapy Online» (iteration 12, design D5), or inside the app the logo or name of the practice of the
 * signed-in user.
 */
export function Logo({ appName, practice }: { appName?: string; practice?: { name: string; logoUrl: string | null } }) {
  return (
    <span className="logo">
      {practice?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- small logo from the database, no optimisation needed
        <img className="plogo" src={practice.logoUrl} alt={practice.name} />
      ) : practice ? (
        <span className="mark">{practice.name}</span>
      ) : (
        <span className="mark">
          Pain Therapy <i>Online</i>
        </span>
      )}
      {/* iteration 13: the app name only beside a practice, never twice (e.g. practice «Pain Therapy», English app name) */}
      {appName && practice && appName.toLowerCase() !== practice.name.toLowerCase() ? (
        <span className="app">{appName}</span>
      ) : null}
    </span>
  );
}
