import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { AuditEvent, EmailDelivery } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { historyOf, viewPatient } from '@/lib/patients';
import { ageOn, formatDate, formatDateTime } from '@/lib/format';
import { ConsentPill, StatusPill } from '@/components/Pills';
import { TabletIcon } from '@/components/Icons';
import { DeactivateDialog } from '@/components/DeactivateDialog';
import { handOver, reactivatePatient, resendEmail } from '../../actions';

export const dynamic = 'force-dynamic';

type Tab = 'personal' | 'anamnesis' | 'documents' | 'history';

export default async function PatientRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; flash?: string; error?: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const tab: Tab = (['personal', 'anamnesis', 'documents', 'history'] as const).find((x) => x === sp.tab) ?? 'personal';
  const p = await viewPatient(actor, id);
  if (!p) notFound();
  const [t, tc, tf, te, td, tp] = await Promise.all([
    getTranslations('record'),
    getTranslations('common'),
    getTranslations('form'),
    getTranslations('errors'),
    getTranslations('deactivate'),
    getTranslations('patients'),
  ]);
  const name = `${p.firstName} ${p.lastName}`;
  const active = p.status === 'ACTIVE';
  const lastSession = p.signatureSessions[0];
  const handOverForm = (
    <form action={handOver}>
      <input type="hidden" name="id" value={p.id} />
      <button className="btn btn--gold">
        <TabletIcon />
        {t('handOver')}
      </button>
    </form>
  );

  const flash =
    sp.flash === 'created'
      ? {
          kind: 'ok',
          text: t('createdFlash', { name }),
          action: active && p.consent !== 'signed' ? handOverForm : null,
        }
      : sp.flash === 'saved'
        ? { kind: 'ok', text: t('savedFlash') }
        : sp.flash === 'deactivated'
          ? { kind: 'info', text: t('deactivatedFlash', { name }) }
          : sp.flash === 'reactivated'
            ? { kind: 'ok', text: t('reactivatedFlash', { name }) }
            : sp.flash === 'resent'
              ? { kind: 'ok', text: (await getTranslations('documents'))('resent') }
              : null;
  const error =
    sp.error === 'noText'
      ? te('noConsentText')
      : sp.error === 'inactive'
        ? te('patientInactive')
        : sp.error
          ? te('generic')
          : null;

  const tabs: [Tab, string][] = [
    ['personal', t('tabPersonal')],
    ['anamnesis', t('tabAnamnesis')],
    ['documents', t('tabDocuments')],
    ['history', t('tabHistory')],
  ];

  return (
    <>
      <div className="crumb">
        <Link href="/patients">← {tp('title')}</Link>
      </div>
      {flash ? (
        <div className={`banner ${flash.kind}`} role="status">
          <p>{flash.text}</p>
          {'action' in flash ? flash.action : null}
        </div>
      ) : null}
      {error ? (
        <div className="banner err" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      {!active ? (
        <div className="banner warn" role="status">
          <p>
            <b>{tc('inactive').toUpperCase()}</b> ·{' '}
            {t('inactiveBanner', { date: formatDate(p.deactivatedAt), reason: p.deactivationReason || t('noReason') })}
          </p>
          <form action={reactivatePatient}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn btn--dark">{t('reactivate')}</button>
          </form>
        </div>
      ) : flash?.action ? null : p.consent === 'pending' ? (
        <div className="banner err">
          <p>
            {t('pendingBanner')}
            {lastSession?.status === 'ABORTED'
              ? ` · ${t('abortedNote', { at: formatDateTime(lastSession.abortedAt) })}`
              : ''}
          </p>
          {handOverForm}
        </div>
      ) : p.consent === 'resign' ? (
        <div className="banner warn">
          <p>{t('resignBanner', { version: p.currentVersion })}</p>
          {handOverForm}
        </div>
      ) : null}
      {p.documents[0]?.session.patientNote && tab !== 'documents' ? (
        <div className="banner info">
          <p>{t('patientNoteBanner', { name: p.firstName, note: p.documents[0].session.patientNote })}</p>
        </div>
      ) : null}

      <div className="rechead">
        <div className="who">
          <span className="avatar" aria-hidden="true">
            {p.firstName[0]}
            {p.lastName[0]}
          </span>
          <div style={{ minWidth: 0 }}>
            <h1>{name}</h1>
            <div className="facts">
              <span className="num">
                {formatDate(p.dateOfBirth)} · {t('age', { n: ageOn(p.dateOfBirth) })}
              </span>
              <span>{p.preferredLanguage === 'en' ? tc('languageEn') : tc('languageDe')}</span>
              <span>{t('since', { date: formatDate(p.createdAt) })}</span>
              <StatusPill active={active} />
              <ConsentPill status={p.consent} />
            </div>
          </div>
        </div>
        <div className="actions">
          <Link className="btn btn--ghost" href={`/patients/${p.id}/edit`}>
            {t('edit')}
          </Link>
          {active ? (
            <>
              <form action={handOver}>
                <input type="hidden" name="id" value={p.id} />
                <button className="btn btn--ghost">
                  <TabletIcon />
                  {t('handOver')}
                </button>
              </form>
              <DeactivateDialog
                id={p.id}
                label={t('deactivate')}
                title={td('title', { name })}
                text={td('text')}
                reasonLabel={td('reason')}
                reasonPlaceholder={td('reasonPlaceholder')}
                cancel={tc('cancel')}
                confirm={td('confirm')}
              />
            </>
          ) : null}
        </div>
      </div>

      <nav className="tabs" aria-label={name}>
        {tabs.map(([k, label]) => (
          <Link
            key={k}
            href={`/patients/${p.id}${k === 'personal' ? '' : `?tab=${k}`}`}
            aria-current={tab === k ? 'page' : undefined}
            replace
            scroll={false}
          >
            {label}
            {k === 'documents' ? <span className="count">{p.documents.length}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'personal' ? <Personal p={p} tf={tf} tc={tc} /> : null}
      {tab === 'anamnesis' ? <AnamnesisView a={p.anamnesis} tf={tf} tc={tc} /> : null}
      {tab === 'documents' ? <Documents p={p} active={active} handOverForm={handOverForm} /> : null}
      {tab === 'history' ? <History events={await historyOf(p.id)} /> : null}
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;
type Rec = NonNullable<Awaited<ReturnType<typeof viewPatient>>>;

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v === null || v === undefined || v === '' ? <span className="muted">–</span> : v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Personal({ p, tf, tc }: { p: Rec; tf: T; tc: T }) {
  const gender = p.gender ? tf(p.gender === 'm' ? 'genderM' : p.gender === 'w' ? 'genderW' : 'genderD') : null;
  return (
    <div className="kvgrid">
      <section className="card">
        <h2>{tf('groupPerson')}</h2>
        <KV
          rows={[
            [tf('firstName'), p.firstName],
            [tf('lastName'), p.lastName],
            [tf('gender'), gender],
            [
              tf('dateOfBirth'),
              <span className="num" key="d">
                {formatDate(p.dateOfBirth)}
              </span>,
            ],
            [tf('preferredLanguage'), p.preferredLanguage === 'en' ? tc('languageEn') : tc('languageDe')],
            [tf('occupation'), p.occupation],
            [tf('gp'), p.gp],
          ]}
        />
      </section>
      <section className="card">
        <h2>{tf('groupContact')}</h2>
        <KV
          rows={[
            [tf('street'), p.street],
            [tf('city'), [p.zip, p.city].filter(Boolean).join(' ')],
            [tf('phone'), p.phone],
            [tf('mobile'), p.mobile],
            [tf('email'), p.email],
          ]}
        />
      </section>
      <section className="card">
        <h2>{tf('groupEmergency')}</h2>
        <KV
          rows={[
            [tf('emergencyName'), p.emergencyName],
            [tf('emergencyPhone'), p.emergencyPhone],
          ]}
        />
      </section>
      <section className="card">
        <h2>{tf('groupInsurance')}</h2>
        <KV
          rows={[
            [tf('insurer'), p.insurer],
            [tf('insuranceNumber'), p.insuranceNumber],
          ]}
        />
      </section>
    </div>
  );
}

function AnamnesisView({ a, tf, tc }: { a: Rec['anamnesis']; tf: T; tc: T }) {
  const tags = (keys: string[], other?: [boolean, string | null]) => {
    const items = keys.filter((k) => a?.[k as keyof typeof a]).map((k) => tf(k as never));
    if (other?.[0]) items.push(`${tf('other')}: ${other[1] ?? ''}`);
    return items.length ? (
      <div className="tags">
        {items.map((i) => (
          <span className="tag" key={i}>
            {i}
          </span>
        ))}
      </div>
    ) : (
      <span className="muted">{tf('noneReported')}</span>
    );
  };
  const yn = (v?: string) => (v === 'YES' ? tc('yes') : v === 'NO' ? tc('no') : tc('notApplicable'));
  return (
    <section className="card">
      <h2>{tf('groupAnamnesis')}</h2>
      <KV
        rows={[
          [
            tf('smoker'),
            a?.smoker === 'YES'
              ? [
                  tc('yes'),
                  a.smokingYears != null ? tf('years', { n: a.smokingYears }) : null,
                  a.packsPerDay != null ? tf('packs', { n: String(a.packsPerDay) }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : tc('no'),
          ],
          [tf('general'), tags(['highBloodPressure', 'highBloodLipids', 'dizziness'])],
          [
            tf('orthopaedic'),
            tags(['osteoporosis', 'arthrosis', 'rheumatism'], [!!a?.orthoOther, a?.orthoOtherText ?? null]),
          ],
          [
            tf('internal'),
            tags(
              ['cardiovascular', 'diabetes', 'asthma', 'allergies'],
              [!!a?.internalOther, a?.internalOtherText ?? null],
            ),
          ],
          [tf('furtherDiagnoses'), a?.furtherDiagnoses],
          [tf('medication'), a?.medication],
          [tf('pregnancy'), yn(a?.pregnancy)],
          [
            tf('inTreatment'),
            a?.inTreatment === 'YES' ? `${tc('yes')}${a.treatingDoctor ? ` · ${a.treatingDoctor}` : ''}` : tc('no'),
          ],
        ]}
      />
    </section>
  );
}

async function DeliveryLine({
  d,
  documentId,
  patientId,
}: {
  d?: EmailDelivery;
  documentId: string;
  patientId: string;
}) {
  const t = await getTranslations('documents');
  const tc = await getTranslations('common');
  if (!d) return null;
  const printLink = (
    <a
      className="btn btn--ghost"
      style={{ minHeight: 36 }}
      href={`/documents/${documentId}`}
      target="_blank"
      rel="noopener"
    >
      {tc('print')}
    </a>
  );
  const resend = (
    <form action={resendEmail} className="inline">
      <input type="hidden" name="documentId" value={documentId} />
      <input type="hidden" name="patientId" value={patientId} />
      <button className="btn btn--ghost" style={{ minHeight: 36 }}>
        {t('resend')}
      </button>
    </form>
  );
  switch (d.status) {
    case 'SENT':
      return (
        <>
          <span className="pill ok">E-Mail</span>
          <span>{t('emailSent', { to: d.recipient ?? '', at: formatDateTime(d.sentAt) })}</span>
        </>
      );
    case 'PENDING':
      return (
        <>
          <span className="pill warn">E-Mail</span>
          <span>{t('emailPending')}</span>
        </>
      );
    case 'FAILED':
      return (
        <>
          <span className="pill err">{t('emailFailed', { attempts: d.attempts })}</span>
          {resend}
          {printLink}
        </>
      );
    case 'SKIPPED_NO_CONSENT':
      return (
        <>
          <span className="pill off">E-Mail</span>
          <span>{t('emailNoConsent')}</span>
          {printLink}
        </>
      );
    case 'SKIPPED_NO_ADDRESS':
      return (
        <>
          <span className="pill off">E-Mail</span>
          <span>{t('emailNoAddress')}</span>
          {resend}
          {printLink}
        </>
      );
  }
}

async function Documents({ p, active, handOverForm }: { p: Rec; active: boolean; handOverForm: React.ReactNode }) {
  const t = await getTranslations('documents');
  const tcs = await getTranslations('consentStatus');
  const tc = await getTranslations('common');
  return (
    <section className="card">
      <h2>{(await getTranslations('record'))('tabDocuments')}</h2>
      {p.consent !== 'signed' ? (
        <div className="doc">
          <div className="ico" style={{ color: 'var(--muted)' }}>
            —
          </div>
          <div>
            <b>{t('notSigned')}</b>
            <div className="meta">{tcs(p.consent)}</div>
          </div>
          <div className="act">{active ? handOverForm : null}</div>
        </div>
      ) : null}
      {p.documents.map((d, i) => (
        <div className="doc" key={d.id}>
          <div className="ico">PDF</div>
          <div style={{ minWidth: 0 }}>
            <b>{t('title')}</b>{' '}
            {i === 0 ? (
              <span className="pill ok">{t('valid')}</span>
            ) : (
              <span className="pill off">{t('superseded')}</span>
            )}
            <div className="meta num">
              <span>{t('signedOn', { at: formatDateTime(d.session.completedAt ?? d.createdAt) })}</span>
              <span>{t('textVersion', { version: d.textVersion })}</span>
              <span>{t('documentNumber', { number: d.documentNumber })}</span>
              <span>{d.language.toUpperCase()}</span>
            </div>
            <div className="del">
              <DeliveryLine d={d.deliveries[0]} documentId={d.id} patientId={p.id} />
            </div>
          </div>
          <div className="act">
            <a className="btn btn--ghost" href={`/documents/${d.id}`} target="_blank" rel="noopener">
              {tc('openPdf')}
            </a>
          </div>
        </div>
      ))}
      {!p.documents.length && p.consent === 'signed' ? <div className="body muted">{t('none')}</div> : null}
    </section>
  );
}

async function History({ events }: { events: AuditEvent[] }) {
  const t = await getTranslations('history');
  const tf = await getTranslations('form');
  const label = (e: AuditEvent) => {
    switch (e.action) {
      case 'patient.created':
        return t('created');
      case 'patient.updated':
        return t('updated', { field: e.field ? tf(e.field as never) : '' });
      case 'patient.deactivated':
        return t('deactivated');
      case 'patient.reactivated':
        return t('reactivated');
      case 'signing.started':
        return t('signingStarted');
      case 'signing.aborted':
        return t('signingAborted');
      case 'signing.completed':
        return t('signed');
      case 'email.sent':
        return t('emailSent');
      case 'email.failed':
        return t('emailFailed');
      case 'email.resend':
        return t('emailResend');
      default:
        return e.action;
    }
  };
  const show = (v: string | null) => (v === 'true' ? '✓' : v === 'false' ? '–' : v);
  return (
    <section className="card">
      <h2>{(await getTranslations('record'))('tabHistory')}</h2>
      <div className="body muted" style={{ paddingBottom: 0, fontSize: 13.5 }}>
        {t('note')}
      </div>
      {events.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="hist">
            <thead>
              <tr>
                <th scope="col">{t('when')}</th>
                <th scope="col">{t('who')}</th>
                <th scope="col">{t('what')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    {formatDateTime(e.at)}
                  </td>
                  <td>{e.userName}</td>
                  <td>
                    <b>{label(e)}</b>
                    {e.before || e.after ? (
                      <>
                        <br />
                        {e.before ? (
                          <>
                            <del>{show(e.before)}</del> →{' '}
                          </>
                        ) : null}
                        <ins>{show(e.after)}</ins>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="body muted">{t('empty')}</div>
      )}
    </section>
  );
}
