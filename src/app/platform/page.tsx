import { getTranslations } from 'next-intl/server';
import { authDb } from '@/lib/db';
import { practiceDetailsOf, practicesOverview } from '@/lib/platform';
import { listPlans } from '@/lib/plans';
import { PlansSection, PracticeUsage } from './usage';
import { exportsOf } from '@/lib/practice-export';
import { formatDate, formatDateTime } from '@/lib/format';
import { ExportList } from '@/components/ExportList';
import { PlatformPracticeForm } from '@/components/PlatformPracticeForm';
import { config } from '@/lib/config';
import { managerUrl } from '@/lib/infomaniak';
import { mailboxOverview, sweepMailboxes } from '@/lib/mailboxes';
import { ONBOARDING_ERRORS } from '@/lib/onboarding';
import { InviteFields } from '@/components/InviteFields';
import {
  deleteAction,
  exportAction,
  handOverAction,
  invitePlatformAdminAction,
  invitePracticeAdminAction,
  mailboxQuotaAction,
  practicePlanAction,
  retryMailboxPlatformAction,
  revokeInvitationPlatformAction,
  statusAction,
} from './actions';

export const dynamic = 'force-dynamic';

const FLASH = [
  'created',
  'suspended',
  'reactivated',
  'invited',
  'exporting',
  'deleted',
  'saved',
  'savedInvited',
  'handedOver',
  'quotaSaved',
  'mailboxRetried',
  'invitationRevoked',
  'planSaved',
  'planCreated',
  'planUpdated',
  'planDeactivated',
  'planActivated',
];
const ERRORS = [
  'planNameTaken',
  'planInUse',
  'slugTaken',
  'notSuspended',
  'noExport',
  'confirm',
  'otherPractice',
  'invalid',
  'notFound',
  'deleted',
];

function PersonForm({
  id,
  action,
  label,
  names,
}: {
  id: string;
  action: (fd: FormData) => Promise<void>;
  label: string;
  names: { name: string; email: string };
}) {
  return (
    <form action={action} className="team-form">
      <input type="hidden" name="id" value={id} />
      <div className="f">
        <label className="l" htmlFor={`${id}_name`}>
          {names.name}
        </label>
        <input className="inp" id={`${id}_name`} name="name" required maxLength={100} autoComplete="off" />
      </div>
      <div className="f">
        <label className="l" htmlFor={`${id}_email`}>
          {names.email}
        </label>
        <input
          className="inp"
          id={`${id}_email`}
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="off"
        />
      </div>
      <button className="btn btn--gold">{label}</button>
    </form>
  );
}

/** platform-admin (iteration 12, design D3, D9): Praxen anlegen, sperren, exportieren, löschen; keine Patientendaten */
export default async function PlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; error?: string }>;
}) {
  await sweepMailboxes().catch((e) => console.error('Mailbox sweep failed', e instanceof Error ? e.message : e));
  const [t, tt, to, sp, practices, admins, mailboxes] = await Promise.all([
    getTranslations('platformAdmin'),
    getTranslations('team'),
    getTranslations('onboarding'),
    searchParams,
    practicesOverview(),
    authDb.user.findMany({
      where: { platformAdmin: true },
      select: { id: true, name: true, email: true, activatedAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    mailboxOverview(),
  ]);
  const plans = await listPlans();
  const names = { name: tt('name'), email: tt('email') };
  const exports = new Map(await Promise.all(practices.map(async (p) => [p.id, await exportsOf(p.id)] as const)));
  const details = new Map(
    await Promise.all(practices.map(async (p) => [p.id, (await practiceDetailsOf(p.id)) ?? {}] as const)),
  );
  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{t('sub')}</div>
        </div>
      </div>
      {sp.flash && FLASH.includes(sp.flash) ? (
        <div className="banner ok" role="status">
          <p>{t(`flash_${sp.flash}` as 'flash_created')}</p>
        </div>
      ) : null}
      {sp.error && ERRORS.includes(sp.error) ? (
        <div className="banner err" role="alert">
          <p>{t(`error_${sp.error}` as 'error_invalid')}</p>
        </div>
      ) : sp.error && (ONBOARDING_ERRORS as string[]).includes(sp.error) ? (
        <div className="banner err" role="alert">
          <p>{to(`error_${sp.error}` as 'error_invalid')}</p>
        </div>
      ) : null}

      <section className="card team-card" aria-labelledby="h_mailboxes" data-testid="mailboxes">
        <h2 id="h_mailboxes">{to('mailboxesTitle')}</h2>
        <p className="meta">
          {!mailboxes.enabled
            ? to('mailboxOff')
            : mailboxes.used === null
              ? to('usageUnknown')
              : to('usage', { used: mailboxes.used, total: mailboxes.total })}
        </p>
        {mailboxes.rows.length ? (
          <ul className="team">
            {mailboxes.rows.map((m) => (
              <li key={m.id} data-testid="mailbox">
                <div className="who">
                  <b>{m.person}</b>
                  <span className="muted">
                    {m.address}
                    {m.practice ? ` · ${m.practice.name}` : ''}
                  </span>
                  <span className="muted">
                    <span
                      className={`pill ${m.status === 'FAILED' ? 'err' : m.access === 'DELIVERED' ? 'ok' : 'warn'}`}
                    >
                      {m.status === 'FAILED' ? to('mb_FAILED') : to(`mb_${m.access}` as 'mb_OPEN')}
                    </span>
                    {m.memberInactive ? (
                      <>
                        {' '}
                        <span className="pill warn">{to('memberInactive')}</span>
                      </>
                    ) : null}
                    {m.requestedAt ? ` · ${to('requested', { at: formatDateTime(m.requestedAt) })}` : ''}
                    {m.access === 'READY' && m.handoverExpiresAt
                      ? ` · ${to('readyUntil', { date: formatDate(m.handoverExpiresAt) })}`
                      : ''}
                  </span>
                </div>
                {m.status === 'FAILED' ? (
                  <form action={retryMailboxPlatformAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <button className="btn btn--ghost">{to('retry')}</button>
                  </form>
                ) : m.task ? (
                  <form action={handOverAction} className="handover">
                    <input type="hidden" name="id" value={m.id} />
                    <p className="muted small full">
                      {to('handoverSteps', { address: m.address })}{' '}
                      <a href={managerUrl()} target="_blank" rel="noreferrer">
                        {to('openManager')}
                      </a>
                    </p>
                    <div className="f">
                      <label className="l" htmlFor={`ho_${m.id}`}>
                        {to('devicePassword')}
                      </label>
                      <input
                        className="inp"
                        id={`ho_${m.id}`}
                        name="password"
                        type="password"
                        required
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                    <button className="btn btn--gold">{to('handOver')}</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{to('noMailboxes')}</p>
        )}
      </section>

      {practices.map((p) => (
        <section key={p.id} className="card team-card" data-testid="practice" aria-labelledby={`h_${p.id}`}>
          <h2 id={`h_${p.id}`}>
            {p.name}{' '}
            <span className={`pill ${p.deletedAt ? 'err' : p.status === 'ACTIVE' ? 'ok' : 'warn'}`}>
              {p.deletedAt ? t('deleted', { date: formatDate(p.deletedAt) }) : t(`status_${p.status}`)}
            </span>
          </h2>
          <p className="meta">
            {p.slug} · {p.contactEmail} · {t('members', { count: p.members })}
          </p>
          {p.deletedAt ? null : <PracticeUsage p={p} t={t} />}
          {p.deletedAt || !p.invitations.length ? null : (
            <ul className="team" data-testid="open-invitations">
              {p.invitations.map((i) => (
                <li key={i.id}>
                  <div className="who">
                    <span className="muted">{t('openInvitation', { email: i.email })}</span>
                  </div>
                  <form action={revokeInvitationPlatformAction}>
                    <input type="hidden" name="practiceId" value={p.id} />
                    <input type="hidden" name="id" value={i.id} />
                    <button className="btn btn--ghost">{t('revokeInvitation')}</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {p.deletedAt ? null : (
            <>
              <div className="acts">
                <form action={statusAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="status" value={p.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'} />
                  <button className="btn btn--ghost">{p.status === 'ACTIVE' ? t('suspend') : t('reactivate')}</button>
                </form>
                <form action={exportAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="btn btn--ghost">{t('export')}</button>
                </form>
              </div>
              <ExportList exports={exports.get(p.id) ?? []} />
              <details>
                <summary>{t('editDetails')}</summary>
                <PlatformPracticeForm practice={{ id: p.id, values: details.get(p.id) ?? {} }} />
              </details>
              <details>
                <summary>{to('inviteAdmin')}</summary>
                <form action={invitePracticeAdminAction} className="team-form">
                  <input type="hidden" name="id" value={p.id} />
                  <InviteFields
                    idPrefix={`pa_${p.id}`}
                    domain={config.mailboxes.domain}
                    allowExisting
                    mailboxesEnabled={mailboxes.enabled}
                  />
                  <button className="btn btn--gold">{tt('send')}</button>
                </form>
              </details>
              <form action={practicePlanAction} className="quota">
                <input type="hidden" name="id" value={p.id} />
                <label className="l" htmlFor={`plan_${p.id}`}>
                  {t('plan')}
                </label>
                <select className="inp" id={`plan_${p.id}`} name="planId" defaultValue={p.plan.id}>
                  {plans
                    .filter((pl) => pl.active || pl.id === p.plan.id)
                    .map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.patientLimit === null
                          ? `${pl.name} (${t('unlimited')})`
                          : `${pl.name} (${pl.patientLimit})`}
                      </option>
                    ))}
                </select>
                <button className="btn btn--ghost">{t('savePlan')}</button>
              </form>
              <form action={mailboxQuotaAction} className="quota">
                <input type="hidden" name="id" value={p.id} />
                <label className="l" htmlFor={`q_${p.id}`}>
                  {to('quota')}
                </label>
                <input
                  className="inp"
                  id={`q_${p.id}`}
                  name="quota"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={p.mailboxQuota}
                />
                <button className="btn btn--ghost">{to('saveQuota')}</button>
              </form>
              {p.status === 'SUSPENDED' ? (
                <details className="danger-zone">
                  <summary>{t('delete')}</summary>
                  <p className="muted">{t('deleteHint')}</p>
                  <form action={deleteAction} className="team-form">
                    <input type="hidden" name="id" value={p.id} />
                    <div className="f">
                      <label className="l" htmlFor={`del_${p.id}`}>
                        {t('deleteConfirm', { slug: p.slug })}
                      </label>
                      <input className="inp" id={`del_${p.id}`} name="confirm" required autoComplete="off" />
                    </div>
                    <label className="ck full">
                      <input type="checkbox" name="understood" required /> {t('deleteCheck')}
                    </label>
                    <button className="btn btn--danger">{t('delete')}</button>
                  </form>
                </details>
              ) : null}
            </>
          )}
        </section>
      ))}

      <PlansSection plans={plans} t={t} />

      <section className="card team-card" aria-labelledby="h_new">
        <h2 id="h_new">{t('new')}</h2>
        <PlatformPracticeForm />
      </section>

      <section className="card team-card" aria-labelledby="h_admins">
        <h2 id="h_admins">{t('platformAdmins')}</h2>
        <ul className="team">
          {admins.map((a) => (
            <li key={a.id}>
              <div className="who">
                <b>{a.name}</b>
                <span className="muted">{a.email}</span>
              </div>
            </li>
          ))}
        </ul>
        <details>
          <summary>{t('invitePlatformAdmin')}</summary>
          <PersonForm id="platform" action={invitePlatformAdminAction} label={t('invite')} names={names} />
        </details>
      </section>
    </>
  );
}
