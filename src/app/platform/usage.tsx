import type { getTranslations } from 'next-intl/server';
import { formatDateTime } from '@/lib/format';
import type { practicesOverview } from '@/lib/platform';
import type { listPlans } from '@/lib/plans';
import { PlanForm } from '@/components/PlanForm';
import { planActiveAction } from './actions';

type T = Awaited<ReturnType<typeof getTranslations<'platformAdmin'>>>;
type Overview = Awaited<ReturnType<typeof practicesOverview>>[number];

const DAY = 24 * 60 * 60 * 1000;

/** Whole days between two times, for «vor 3 Tagen» and «inaktiv seit 31 Tagen» */
export const daysSince = (d: Date, now = new Date()) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY));

/** platform-statistics (iteration 17, design D5, D6): sign-in, last change, counts and plan of a practice */
export function PracticeUsage({ p, t }: { p: Overview; t: T }) {
  const idle = p.lastActivity ? daysSince(p.lastActivity) : null;
  const pct = p.plan.patientLimit ? Math.min(100, Math.round((p.usage.patients / p.plan.patientLimit) * 100)) : 0;
  return (
    <div className="practice-usage" data-testid="practice-usage">
      <dl className="kv">
        <dt>{t('lastLogin')}</dt>
        <dd>
          {p.lastActivity
            ? `${formatDateTime(p.lastActivity)}${p.lastLoginBy ? ` · ${p.lastLoginBy}` : ''}`
            : t('neverActive')}{' '}
          {idle !== null && idle >= 30 ? <span className="pill warn">{t('idleDays', { days: idle })}</span> : null}
        </dd>
        <dt>{t('lastChange')}</dt>
        <dd>
          {p.lastChange
            ? t('lastChangeAt', { days: daysSince(p.lastChange), at: formatDateTime(p.lastChange) })
            : t('noChange')}
        </dd>
        <dt>{t('plan')}</dt>
        <dd>
          {p.plan.patientLimit === null
            ? p.plan.name
            : t('planUsage', { plan: p.plan.name, count: p.usage.patients, limit: p.plan.patientLimit })}{' '}
          {p.plan.state === 'reached' ? <span className="pill warn">{t('limitReached')}</span> : null}
        </dd>
      </dl>
      {p.plan.patientLimit !== null ? (
        <div className="plan-meter" aria-hidden="true">
          <i style={{ width: `${pct}%` }} data-state={p.plan.state} />
        </div>
      ) : null}
      <div className="usage-stats">
        <div>
          <b>{p.usage.patients}</b>
          <span>{t('countPatients')}</span>
        </div>
        <div>
          <b>{p.usage.treatments}</b>
          <span>{t('countTreatments')}</span>
        </div>
        <div>
          <b>{p.usage.sessions}</b>
          <span>{t('countSessions')}</span>
        </div>
      </div>
    </div>
  );
}

/** practice-plans (iteration 17, design D7): plans with their limit and how many practices use them */
export function PlansSection({ plans, t }: { plans: Awaited<ReturnType<typeof listPlans>>; t: T }) {
  return (
    <section className="card team-card" id="plans" aria-labelledby="h_plans" data-testid="plans">
      <h2 id="h_plans">{t('plans')}</h2>
      <p className="muted">{t('plansNote')}</p>
      <ul className="team">
        {plans.map((pl) => (
          <li key={pl.id} data-testid="plan">
            <div className="who">
              <b>
                {pl.name} {pl.id === 'freemium' ? <span className="pill">{t('planDefault')}</span> : null}
                {!pl.active ? <span className="pill warn">{t('planInactive')}</span> : null}
              </b>
              <span className="muted">
                {pl.patientLimit === null ? t('unlimited') : t('planLimit', { limit: pl.patientLimit })} ·{' '}
                {t('planPractices', { count: pl.practices })}
              </span>
            </div>
            <details>
              <summary>{t('planEdit')}</summary>
              <PlanForm plan={{ id: pl.id, name: pl.name, patientLimit: pl.patientLimit }} />
              {pl.id === 'freemium' ? null : (
                <form action={planActiveAction}>
                  <input type="hidden" name="id" value={pl.id} />
                  <input type="hidden" name="active" value={pl.active ? '0' : '1'} />
                  <button className="btn btn--ghost">{pl.active ? t('planDeactivate') : t('planActivate')}</button>
                </form>
              )}
            </details>
          </li>
        ))}
      </ul>
      <details>
        <summary>{t('planNew')}</summary>
        <PlanForm />
      </details>
    </section>
  );
}
