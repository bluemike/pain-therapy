import { getTranslations } from 'next-intl/server';
import { authDb } from '@/lib/db';
import { practiceDetailsOf, practicesOverview } from '@/lib/platform';
import { exportsOf } from '@/lib/practice-export';
import { formatDate, formatDateTime } from '@/lib/format';
import { ExportList } from '@/components/ExportList';
import { PlatformPracticeForm } from '@/components/PlatformPracticeForm';
import { deleteAction, exportAction, invitePlatformAdminAction, statusAction } from './actions';

export const dynamic = 'force-dynamic';

const FLASH = ['created', 'suspended', 'reactivated', 'invited', 'exporting', 'deleted', 'saved', 'savedInvited'];
const ERRORS = ['slugTaken', 'notSuspended', 'noExport', 'confirm', 'otherPractice', 'invalid', 'notFound', 'deleted'];

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
  const [t, tt, sp, practices, admins] = await Promise.all([
    getTranslations('platformAdmin'),
    getTranslations('team'),
    searchParams,
    practicesOverview(),
    authDb.user.findMany({
      where: { platformAdmin: true },
      select: { id: true, name: true, email: true, activatedAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);
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
      ) : null}

      {practices.map((p) => (
        <section key={p.id} className="card team-card" data-testid="practice" aria-labelledby={`h_${p.id}`}>
          <h2 id={`h_${p.id}`}>
            {p.name}{' '}
            <span className={`pill ${p.deletedAt ? 'err' : p.status === 'ACTIVE' ? 'ok' : 'warn'}`}>
              {p.deletedAt ? t('deleted', { date: formatDate(p.deletedAt) }) : t(`status_${p.status}`)}
            </span>
          </h2>
          <p className="meta">
            {p.slug} · {p.contactEmail} · {t('members', { count: p.members })} ·{' '}
            {p.lastActivity ? t('lastActivity', { at: formatDateTime(p.lastActivity) }) : t('neverActive')}
            {p.openInvitations.length ? ` · ${t('openInvitations', { emails: p.openInvitations.join(', ') })}` : ''}
          </p>
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
