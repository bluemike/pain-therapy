import Link from 'next/link';
import { Logo } from './Logo';
import { LockIcon } from './Icons';

/** Top bar in patient mode: no navigation, only a discreet way back for the therapist (requires re-login). */
export function PatientModeBar({ sid, modeLabel, exitLabel }: { sid: string; modeLabel: string; exitLabel?: string }) {
  return (
    <div className="pmbar">
      <Logo />
      <span className="lock">
        <LockIcon />
        {modeLabel}
      </span>
      {exitLabel ? (
        <Link className="pmexit" href={`/sign/${sid}/leave`} aria-label={exitLabel} prefetch={false}>
          {exitLabel}
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
