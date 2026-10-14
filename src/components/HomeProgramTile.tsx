import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { formatDateTime } from '@/lib/format';
import type { HomeProgramRow } from '@/lib/exercise-log';
import { LinkStatusPill } from './LinkStatusPill';
import { trendText } from './RatingSparkline';

/**
 * adherence-overview: Kachel "Heimprogramm" im Cockpit (design D10, mockup view 3). Independent tile (dashboard:
 * Erweiterbarkeit); flagged patients first; a name opens the tab "Übungstagebuch".
 */
export async function HomeProgramTile({ rows }: { rows: HomeProgramRow[] }) {
  const t = await getTranslations('exerciseLog');
  return (
    <section className="card" aria-labelledby="h_homeprogram" data-testid="home-program-tile">
      <header>
        <span id="h_homeprogram">
          {t('tile')} <span className="pill off">{t('tileCount', { count: rows.length })}</span>
        </span>
        <span className="muted small">{t('tileHint')}</span>
      </header>
      {rows.length ? (
        <>
          <div className="adh hd" aria-hidden="true">
            <span>{t('colPatient')}</span>
            <span>{t('kpiAdherence')}</span>
            <span>{t('colTrend')}</span>
            <span>{t('kpiLast')}</span>
            <span>{t('colRating')}</span>
            <span>{t('link')}</span>
          </div>
          <ul className="adhlist">
            {rows.map(({ patient: p, adherence: a, linkStatus }) => {
              const pct = a.total.percent ?? 0;
              return (
                <li className="adh" key={p.id} data-testid="home-program-row">
                  <Link href={`/patients/${p.id}?tab=log`}>
                    {p.firstName} {p.lastName}
                  </Link>
                  <span className="meter">
                    <span className="track" aria-hidden="true">
                      <span className={`fill ${pct < 50 ? 'low' : ''}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </span>
                    <b className="num" aria-label={t('adherenceOf', { percent: pct })}>
                      {pct} %
                    </b>
                  </span>
                  <span className="c num" data-l={t('colTrend')}>
                    {trendText(a.trend)}
                  </span>
                  <span className="c num" data-l={t('kpiLast')}>
                    {a.lastEntryAt ? formatDateTime(a.lastEntryAt) : t('noEntryYet')}
                  </span>
                  <span className="c num" data-l={t('colRating')}>
                    {a.averageRating?.toFixed(1) ?? '–'}
                  </span>
                  <span className="flags">
                    <LinkStatusPill status={linkStatus} />
                    {a.flags.map((f) => (
                      <span className="pill err" key={f}>
                        {t(f === 'lowAdherence' ? 'flagLow' : 'flagNoEntry')}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="body muted">{t('tileEmpty')}</div>
      )}
    </section>
  );
}
