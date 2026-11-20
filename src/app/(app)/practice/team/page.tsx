import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { requirePractice } from '@/lib/practice';
import { teamOf } from '@/lib/team';
import { formatDate, formatDateTime } from '@/lib/format';
import { activeAction, inviteAction, resetAction, revokeAction, rolesAction } from './actions';

export const dynamic = 'force-dynamic';

const ROLES = ['THERAPIST', 'PRACTICE_ADMIN'] as const;
const FLASH = ['invited', 'revoked', 'roles', 'deactivated', 'reactivated', 'reset'];
const ERRORS = ['lastAdmin', 'self', 'member', 'otherPractice', 'noRole', 'invalid', 'notFound'];

/** team-management (iteration 12, design D3, D4): Seite «Team», nur für die Praxis-Admin */
export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ flash?: string; error?: string }>;
}) {
  const actor = await requireUser('manageConsentTexts');
  const [t, practice, sp] = await Promise.all([getTranslations('team'), requirePractice(), searchParams]);
  const { members, invitations } = await teamOf(practice.id);
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
                  <span className="muted">{m.email}</span>
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
                  <span className="muted">{i.email}</span>
                  <span className="muted">
                    {i.roles.map((r) => t(`role_${r}`)).join(', ')} ·{' '}
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
          <div className="f">
            <label className="l" htmlFor="i_name">
              {t('name')}
            </label>
            <input id="i_name" name="name" required maxLength={100} autoComplete="off" />
          </div>
          <div className="f">
            <label className="l" htmlFor="i_email">
              {t('email')}
            </label>
            <input id="i_email" name="email" type="email" required maxLength={200} autoComplete="off" />
          </div>
          <fieldset className="f">
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
