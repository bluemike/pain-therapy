'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { savePlanAction, type PlanFormState } from '@/app/platform/actions';

/** practice-plans (iteration 17, design D7): new plan, or name and limit of an existing one */
export function PlanForm({ plan }: { plan?: { id: string; name: string; patientLimit: number | null } }) {
  const t = useTranslations('platformAdmin');
  const te = useTranslations('errors');
  const [state, action, pending] = useActionState<PlanFormState, FormData>(savePlanAction, {});
  const prefix = `pl_${plan?.id ?? 'new'}_`;
  const v = (k: 'name' | 'patientLimit') =>
    state.values?.[k] ?? (k === 'name' ? (plan?.name ?? '') : (plan?.patientLimit?.toString() ?? ''));
  const msg = (k: string) => {
    const e = state.errors?.[k];
    if (!e) return null;
    return (
      <span className="msg" id={`${prefix}${k}_m`}>
        {e === 'planNameTaken' ? t('error_planNameTaken') : e === 'number' ? t('planLimitInvalid') : te('required')}
      </span>
    );
  };
  return (
    <form action={action} className="team-form">
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <div className={`f ${state.errors?.name ? 'bad' : ''}`}>
        <label className="l" htmlFor={`${prefix}name`}>
          {t('planName')}
        </label>
        <input className="inp" id={`${prefix}name`} name="name" required maxLength={60} defaultValue={v('name')} />
        {msg('name')}
      </div>
      <div className={`f ${state.errors?.patientLimit ? 'bad' : ''}`}>
        <label className="l" htmlFor={`${prefix}patientLimit`}>
          {t('planLimitLabel')}
        </label>
        <input
          className="inp"
          id={`${prefix}patientLimit`}
          name="patientLimit"
          inputMode="numeric"
          placeholder={t('planLimitPlaceholder')}
          defaultValue={v('patientLimit')}
        />
        {msg('patientLimit')}
      </div>
      <button className="btn btn--gold" disabled={pending}>
        {plan ? t('planSave') : t('planCreate')}
      </button>
    </form>
  );
}
