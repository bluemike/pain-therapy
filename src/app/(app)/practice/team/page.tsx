import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { requirePractice } from '@/lib/practice';
import { teamOf } from '@/lib/team';
import { formatDate, formatDateTime } from '@/lib/format';
import { config } from '@/lib/config';
import { mailboxesEnabled } from '@/lib/infomaniak';
import { practiceMailboxCount, sweepMailboxes } from '@/lib/mailboxes';
import { ONBOARDING_ERRORS } from '@/lib/onboarding';
import { maskMobile } from '@/lib/phone';
import { authDb } from '@/lib/db';
import { InviteFields } from '@/components/InviteFields';
import { activeAction, inviteAction, resetAction, retryMailboxAction, revokeAction, rolesAction } from './actions';

export const dynamic = 'force-dynamic';

const ROLES = ['THERAPIST', 'PRACTICE_ADMIN'] as const;
const FLASH = ['invited', 'revoked', 'roles', 'deactivated', 'reactivated', 'reset', 'mailboxRetried'];
const ERRORS = ['lastAdmin', 'self', 'member', 'otherPractice', 'noRole', 'invalid', 'notFound'];

/** team-management (iteration 12, design D3, D4): Seite «Team», nur für die Praxis-Admin */
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; error?: string }>;
}) {
  const actor = await requireUser('manageConsentTexts');
  const [t, to, practice, sp] = await Promise.all([
    getTranslations('team'),
    getTranslations('onboarding'),
    requirePractice(),
    searchParams,
  ]);
  await sweepMailboxes().catch((e) => console.error('Mailbox sweep failed', e instanceof Error ? e.message : e));
  const { members, invitations } = await teamOf(practice.id);
  const [{ mailboxQuota }, used] = await Promise.all([
    authDb.practice.findUniqueOrThrow({ where: { id: practice.id }, select: { mailboxQuota: true } }),
    practiceMailboxCount(practice.id),
  ]);
  const mailboxPill = (mb: { id: string; status: string; access: string } | null) =>
    mb ? (
      <span className="mb-state">
        <span className={`pill ${mb.status === 'FAILED' ? 'err' : mb.access === 'DELIVERED' ? 'ok' : 'warn'}`}>
          {mb.status === 'FAILED' ? to('mb_FAILED') : to(`mb_${mb.access}` as 'mb_OPEN')}
        </span>
        {mb.status === 'FAILED' ? (
          <form action={retryMailboxAction}>
            <input type="hidden" name="id" value={mb.id} />
            <button className="linkbtn inline">{to('retry')}</button>
          </form>
        ) : null}
      </span>
    ) : null;
  const roleBoxes = (prefix: string, roles: readonly string[]) =>
    ROLES.map((r) => (
      <label key={r} className="ck">
        <input
          type="checkbox"
          name={`role_${r}`}
          defaultChecked={roles.includes(r)}
          aria-describedby={`${prefix}_roles`}
        />{' '}
        {t(`role_${r}`)}
      </label>
    ));
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
          <p>{t(`flash_${sp.flash}` as 'flash_invited')}</p>
        </div>
      ) : null}
      {sp.error && ERRORS.includes(sp.error) ? (
        <div className="banner err" role="alert">
          <p>{t(`error_${sp.error}` as 'error_self')}</p>
        </div>
      ) : sp.error && (ONBOARDING_ERRORS as string[]).includes(sp.error) ? (
        <div className="banner err" role="alert">
          <p>{to(`error_${sp.error}` as 'error_invalid')}</p>
        </div>
      ) : null}

      <section className="card team-card" aria-labelledby="h_members">
        <h2 id="h_members">{t('members')}</h2>
        <ul className="team">
          {members.map((m) => {
            const status = !m.active ? 'inactive' : m.activated ? 'active' : 'pending';
            const self = m.id === actor.id;
            return (
              <li key={m.id} data-testid="member">
                <div className="who">
                  <b>
                    {m.name}
                    {self ? ` (${t('you')})` : ''}
                  </b>
                  <span className="muted">
                    {m.email}
                    {m.mobile ? ` · ${maskMobile(m.mobile)}` : ''}
                  </span>
                  {mailboxPill(m.mailbox)}
                  <span className="muted">
                    <span className={`pill ${status === 'active' ? 'ok' : status === 'pending' ? 'warn' : ''}`}>
                      {t(`status_${status}`)}
                    </span>{' '}
                    {m.activated ? t('lastLogin', { at: formatDateTime(m.lastLoginAt) }) : null}
                  </span>
                </div>
                <form action={rolesAction} className="roles">
                  <input type="hidden" name="userId" value={m.id} />
                  <span className="sr-only" id={`m_${m.id}_roles`}>
                    {t('roles')} {m.name}
                  </span>
                  {roleBoxes(`m_${m.id}`, m.roles)}
                  <button className="btn btn--ghost">{t('saveRoles')}</button>
                </form>
                {self ? null : (
                  <div className="acts">
                    <form action={activeAction}>
                      <input type="hidden" name="userId" value={m.id} />
                      <input type="hidden" name="active" value={m.active ? 'false' : 'true'} />
                      <button className="btn btn--ghost">{m.active ? t('deactivate') : t('reactivate')}</button>
                    </form>
                    {m.active ? (
                      <form action={resetAction}>
                        <input type="hidden" name="userId" value={m.id} />
                        <button className="btn btn--ghost" title={t('resetHint')}>
                          {t('reset')}
                        </button>
                      </form>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted small">{t('resetHint')}</p>
      </section>

      <section className="card team-card" aria-labelledby="h_invitations">
        <h2 id="h_invitations">{t('invitations')}</h2>
        {invitations.length ? (
          <ul className="team">
            {invitations.map((i) => (
              <li key={i.id} data-testid="invitation">
                <div className="who">
                  <b>{i.name ?? i.email}</b>
                  <span className="muted">
                    {i.email}
                    {i.mobile ? ` · ${maskMobile(i.mobile)}` : ''}
                  </span>
                  {mailboxPill(i.mailbox)}
                  <span className="muted">
                    {to(`via_${i.channel}`)} · {i.roles.map((r) => t(`role_${r}`)).join(', ')} ·{' '}
                    {t('validUntil', { date: formatDate(i.expiresAt) })} · {t('invitedBy', { name: i.invitedBy })}
                  </span>
                </div>
                <form action={revokeAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button className="btn btn--ghost">{t('revoke')}</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('noInvitations')}</p>
        )}
      </section>

      <section className="card team-card" aria-labelledby="h_invite">
        <h2 id="h_invite">{t('invite')}</h2>
        <form action={inviteAction} className="team-form">
          <InviteFields
            idPrefix="i"
            domain={config.mailboxes.domain}
            mailboxesEnabled={mailboxesEnabled()}
            quotaLeft={Math.max(0, mailboxQuota - used)}
          />
          <fieldset className="full">
            <legend className="l" id="i_roles">
              {t('roles')}
            </legend>
            {roleBoxes('i', ['THERAPIST'])}
          </fieldset>
          <button className="btn btn--gold">{t('send')}</button>
        </form>
      </section>
    </>
  );
}
