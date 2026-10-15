import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { dashboardData, listPatients } from '@/lib/patients';
import { formatDate, formatDateTime, greetingKey, hourInZurich } from '@/lib/format';
import { ConsentPill } from '@/components/Pills';
import { SearchBox } from '@/components/SearchBox';
import { PlusIcon, TabletIcon } from '@/components/Icons';
import { HomeProgramTile } from '@/components/HomeProgramTile';
import { homeProgramOverview } from '@/lib/exercise-log';
import { inviteStatusOf, zoneEnabled, type InviteStatus } from '@/lib/patient-access';
import { handOver } from './actions';

export const dynamic = 'force-dynamic';

/** dashboard: Startseite nach der Anmeldung */
const PENDING_SHOWN = 8;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const t = await getTranslations('dashboard');
  const tc = await getTranslations('common');
  const tcs = await getTranslations('consentStatus');
  const tp = await getTranslations('patients');
  const tsi = await getTranslations('signatureInvite');
  const { q = '' } = await searchParams;
  const [data, hits, homeProgram] = await Promise.all([
    dashboardData(),
    q.trim() ? listPatients({ q, filter: 'active' }) : Promise.resolve([]),
    homeProgramOverview(),
  ]);
  // zone-consent-invitation: Unterschrift ausstehend im Cockpit with the state of the invitation (design D9)
  const zone = zoneEnabled();
  const invites = new Map<string, InviteStatus | null>(
    zone
      ? await Promise.all(
          data.pending.slice(0, PENDING_SHOWN).map(async (p) => [p.id, await inviteStatusOf(p.id, true)] as const),
        )
      : [],
  );
  const inviteText = (i: InviteStatus | null | undefined) =>
    !i || i.kind === 'signedOnline'
      ? null
      : i.kind === 'notInvited'
        ? tsi('shortNotInvited')
        : i.kind === 'failed'
          ? tsi('shortFailed')
          : i.kind === 'opened'
            ? tsi('shortOpened', { at: formatDateTime(i.at) })
            : tsi(`shortSent${i.channel}`, { at: formatDateTime(i.at) });
  const hour = hourInZurich();
  const first = user.name.split(' ')[0];
  const greeting = t(greetingKey(hour), { name: first });
  const empty = data.activeCount === 0 && data.recent.length === 0;

  return (
    <>
      <div className="greet">
        <div>
          <div className="eyebrow">{formatDateTime(new Date()).slice(0, 10)}</div>
          <h1>{greeting}</h1>
        </div>
      </div>
      <div className="quick">
        <SearchBox placeholder={t('searchPlaceholder')} id="dq" />
        <Link className="btn btn--gold" href="/patients/new">
          <PlusIcon />
          {t('newPatient')}
        </Link>
      </div>

      {data.openNotes.length ? (
        <div className="banner info notebox" role="status" data-testid="open-notes">
          <p>
            <b>{tsi('noteHint')}:</b>{' '}
            {data.openNotes.map((n, i) => (
              <span key={n.id}>
                {i ? ', ' : ''}
                <Link href={`/patients/${n.id}`}>
                  {n.firstName} {n.lastName}
                </Link>
              </span>
            ))}
          </p>
        </div>
      ) : null}
      {q.trim() ? (
        <section className="card" aria-live="polite">
          <header>
            {t('searchResults', { q })}
            <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
              {tp('count', { count: hits.length })}
            </span>
          </header>
          {hits.length ? (
            <ul className="rows">
              {hits.map((p) => (
                <li key={p.id}>
                  <div className="grow">
                    <Link className="name" href={`/patients/${p.id}`}>
                      {p.firstName} {p.lastName}
                    </Link>
                    <small className="num">
                      {formatDate(p.dateOfBirth)}
                      {p.insuranceNumber ? ` · ${p.insuranceNumber}` : ''}
                    </small>
                  </div>
                  <ConsentPill status={p.consent} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="body muted">{tp('noResults', { q })}</div>
          )}
        </section>
      ) : null}

      <div className="tiles">
        <Link className="card tile link" href="/patients">
          <span className="eyebrow">{t('activePatients')}</span>
          <span className="big num" data-testid="kpi-active">
            {data.activeCount}
          </span>
        </Link>
        <div className={`card tile ${data.pending.length ? 'attn' : ''}`}>
          <span className="eyebrow">{t('pendingSignatures')}</span>
          <span className="big num" data-testid="kpi-pending">
            {data.pending.length}
          </span>
        </div>
        <div className="card tile">
          <span className="eyebrow">{t('newThisMonth')}</span>
          <span className="big num">{data.newThisMonth}</span>
        </div>
      </div>

      {empty ? (
        <div className="card">
          <div className="empty">
            <div className="ill" aria-hidden="true">
              +
            </div>
            <h2 style={{ fontSize: 18 }}>{t('emptyTitle')}</h2>
            <p className="muted" style={{ maxWidth: '46ch', margin: 0 }}>
              {t('emptyText')}
            </p>
            <Link className="btn btn--gold" href="/patients/new">
              <PlusIcon />
              {t('newPatient')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="two">
          <section className="card" aria-labelledby="pending-h">
            <header>
              <span id="pending-h">{t('pendingSignatures')}</span>
              <span className="pill warn">{data.pending.length}</span>
            </header>
            {data.pending.length ? (
              <ul className="rows">
                {data.pending.slice(0, PENDING_SHOWN).map((p) => (
                  <li key={p.id}>
                    <span className="avatar" aria-hidden="true">
                      {p.firstName[0]}
                      {p.lastName[0]}
                    </span>
                    <div className="grow">
                      <Link className="name" href={`/patients/${p.id}`}>
                        {p.firstName} {p.lastName}
                      </Link>
                      <small>
                        {tcs(p.consent)} · {p.preferredLanguage === 'en' ? tc('languageEn') : tc('languageDe')}
                        {inviteText(invites.get(p.id)) ? (
                          <span data-testid="invite-state">
                            {' · '}
                            {t('colInvite')}: {inviteText(invites.get(p.id))}
                          </span>
                        ) : null}
                      </small>
                    </div>
                    {zone ? (
                      <Link className="btn btn--ghost" href={`/patients/${p.id}?invite=1`} style={{ minHeight: 40 }}>
                        {invites.get(p.id)?.kind === 'failed' ? tsi('reinvite') : tsi('inviteShort')}
                      </Link>
                    ) : null}
                    <form action={handOver}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn btn--ghost" style={{ minHeight: 40 }}>
                        <TabletIcon />
                        {t('startSigning')}
                      </button>
                    </form>
                  </li>
                ))}
                {data.pending.length > PENDING_SHOWN ? (
                  <li>
                    <Link className="linkbtn" href="/patients" style={{ minHeight: 32 }}>
                      {t('morePending', { count: data.pending.length - PENDING_SHOWN })}
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : (
              <div className="body muted">{t('allSigned')}</div>
            )}
          </section>
          <section className="card" aria-labelledby="recent-h">
            <header>
              <span id="recent-h">{t('recent')}</span>
              <Link className="linkbtn" href="/patients" style={{ minHeight: 32 }}>
                {t('showAll')}
              </Link>
            </header>
            <ul className="rows">
              {data.recent.map((p) => (
                <li key={p.id}>
                  <div className="grow">
                    <Link className="name" href={`/patients/${p.id}`}>
                      {p.firstName} {p.lastName}
                    </Link>
                    <small>{t('changedBy', { when: formatDateTime(p.updatedAt), user: p.updatedBy })}</small>
                  </div>
                  <ConsentPill status={p.consent} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {empty ? null : <HomeProgramTile rows={homeProgram} />}
    </>
  );
}
