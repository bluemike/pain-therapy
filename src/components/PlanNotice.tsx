import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { currentPlanUsage, type PlanUsage } from '@/lib/plans';
import { PlusIcon } from './Icons';

/** practice-plans (iteration 17, design D8): notice from 80 % of the plan's patient limit and at the limit */
export async function PlanNotice({ usage }: { usage?: PlanUsage | null }) {
  const u = usage === undefined ? await currentPlanUsage() : usage;
  if (!u || u.state === 'ok' || u.limit === null) return null;
  const t = await getTranslations('plan');
  const values = { plan: u.planName, count: u.patients, limit: u.limit, contact: PLATFORM_CONTACT };
  return (
    <div className={`banner ${u.state === 'reached' ? 'warn' : 'info'}`} role="status" data-testid="plan-notice">
      <p>{u.state === 'reached' ? t('reached', values) : t('near', values)}</p>
    </div>
  );
}

/** «Neuer Patient», disabled with the reason when the plan's limit is reached */
export async function NewPatientButton({ label }: { label: string }) {
  const u = await currentPlanUsage();
  if (u?.state === 'reached') {
    const t = await getTranslations('plan');
    return (
      <button type="button" className="btn btn--gold" disabled title={t('buttonTitle', { limit: u.limit ?? 0 })}>
        <PlusIcon />
        {label}
      </button>
    );
  }
  return (
    <Link className="btn btn--gold" href="/patients/new">
      <PlusIcon />
      {label}
    </Link>
  );
}

export const PLATFORM_CONTACT = 'admin@pain-therapy.online';

/** Plan and usage on «Praxis», read only; the platform admin changes the plan (design D7) */
export async function PlanCard({ usage }: { usage: PlanUsage }) {
  const t = await getTranslations('plan');
  const pct = usage.limit ? Math.min(100, Math.round((usage.patients / usage.limit) * 100)) : 0;
  return (
    <section className="card team-card" aria-labelledby="h_plan" data-testid="plan-card">
      <h2 id="h_plan" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {t('title')} <span className={`pill ${usage.state === 'reached' ? 'warn' : 'ok'}`}>{usage.planName}</span>
      </h2>
      {usage.limit === null ? (
        <p className="muted">{t('unlimited', { count: usage.patients })}</p>
      ) : (
        <>
          <div className="plan-meter" aria-hidden="true">
            <i style={{ width: `${pct}%` }} data-state={usage.state} />
          </div>
          <p className="muted">{t('usage', { count: usage.patients, limit: usage.limit })}</p>
          <PlanNotice usage={usage} />
        </>
      )}
    </section>
  );
}
