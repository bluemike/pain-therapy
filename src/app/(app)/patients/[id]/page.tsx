import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { AuditEvent, EmailDelivery } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { historyOf, viewPatient } from '@/lib/patients';
import { treatmentsOf } from '@/lib/treatments';
import { listRegions, regionLabel } from '@/lib/catalog';
import { ageOn, formatDate, formatDateTime, formatPercent } from '@/lib/format';
import { ConsentPill, StatusPill } from '@/components/Pills';
import { PlusIcon, TabletIcon } from '@/components/Icons';
import { DeactivateDialog } from '@/components/DeactivateDialog';
import { handOver, reactivatePatient, resendEmail } from '../../actions';

export const dynamic = 'force-dynamic';

type Tab = 'treatments' | 'personal' | 'anamnesis' | 'documents' | 'history';

export default async function PatientRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; flash?: string; error?: string; n?: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  // patient-records: Behandlungen in der Akte, first tab and default view (iteration 2, design D7)
  const tab: Tab =
    (['personal', 'anamnesis', 'documents', 'history'] as const).find((x) => x === sp.tab) ?? 'treatments';
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
  const treatments = await treatmentsOf(p.id);
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
              : sp.flash === 'treatmentCreated'
                ? { kind: 'ok', text: t('treatmentCreatedFlash') }
                : sp.flash === 'treatmentSaved'
                  ? { kind: 'ok', text: t('treatmentSavedFlash') }
                  : sp.flash === 'consultationSaved'
                    ? { kind: 'ok', text: t('consultationSavedFlash', { n: Number(sp.n) || 0 }) }
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
    ['treatments', t('tabTreatments')],
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
          {active ? (
            <Link className="btn btn--gold" href={`/patients/${p.id}/treatments/new`}>
              <PlusIcon />
              {(await getTranslations('treatments'))('new')}
            </Link>
          ) : null}
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
            href={`/patients/${p.id}${k === 'treatments' ? '' : `?tab=${k}`}`}
            aria-current={tab === k ? 'page' : undefined}
            replace
            scroll={false}
          >
            {label}
            {k === 'documents' ? <span className="count">{p.documents.length}</span> : null}
            {k === 'treatments' ? <span className="count">{treatments.length}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'treatments' ? (
        <Treatments patientId={p.id} list={treatments} active={active} canOpen={active && p.consent === 'signed'} />
      ) : null}
      {tab === 'personal' ? <Personal p={p} tf={tf} tc={tc} /> : null}
      {tab === 'anamnesis' ? <AnamnesisView a={p.anamnesis} tf={tf} tc={tc} /> : null}
      {tab === 'documents' ? <Documents p={p} active={active} handOverForm={handOverForm} /> : null}
      {tab === 'history' ? <History events={await historyOf(p.id)} regions={await listRegions()} /> : null}
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

type TreatmentRow = Awaited<ReturnType<typeof treatmentsOf>>[number];

/** treatments: Behandlungsliste, newest first, each with its consultations (design D7) */
async function Treatments({
  patientId,
  list,
  active,
  canOpen,
}: {
  patientId: string;
  list: TreatmentRow[];
  active: boolean;
  canOpen: boolean;
}) {
  const t = await getTranslations('treatments');
  const tp = await getTranslations('photos');
  const locale = await getLocale();
  if (!list.length)
    return (
      <section className="card">
        <div className="empty">
          <div className="ill" aria-hidden="true">
            +
          </div>
          <h2 style={{ fontSize: 18 }}>{t('emptyTitle')}</h2>
          <p className="muted" style={{ maxWidth: '52ch', margin: 0 }}>
            {t('emptyText')}
          </p>
          {active ? (
            <Link className="btn btn--gold" href={`/patients/${patientId}/treatments/new`}>
              <PlusIcon />
              {t('new')}
            </Link>
          ) : null}
        </div>
      </section>
    );
  const pain = (c: { painBefore: number | null; painAfter: number | null }) =>
    c.painBefore === null && c.painAfter === null
      ? ''
      : `${formatPercent(c.painBefore)} → ${formatPercent(c.painAfter)}`;
  return (
    <>
      {list.map((tr) => {
        const label = regionLabel(tr.region, locale);
        const base = `/patients/${patientId}/treatments/${tr.id}`;
        return (
          <section className="card treat" id={`t-${tr.id}`} key={tr.id} aria-labelledby={`th-${tr.id}`}>
            <header>
              <div style={{ minWidth: 0 }}>
                <h2 id={`th-${tr.id}`}>{label}</h2>
                <div className="meta num">
                  {t('opened', { at: formatDateTime(tr.startedAt) })} ·{' '}
                  {t('painStart', { pain: formatPercent(tr.painStart) })} ·{' '}
                  {t('photoCount', { count: tr.photos.length })}
                </div>
                <div className="diag">{t('diagnosisLine', { text: tr.diagnosis })}</div>
              </div>
              <div className="actions">
                <Link className="btn btn--ghost" href={`${base}/edit`} aria-label={`${t('edit')}: ${label}`}>
                  {t('edit')}
                </Link>
                {canOpen ? (
                  <Link className="btn btn--ghost" href={`${base}/consultations/new`}>
                    <PlusIcon />
                    {t('addConsultation')}
                  </Link>
                ) : null}
              </div>
            </header>
            {tr.photos.length ? (
              <ul className="photos strip" aria-label={t('photos')}>
                {tr.photos.map((ph) => {
                  const at = formatDateTime(ph.takenAt);
                  return (
                    <li key={ph.id} className="ph">
                      <a href={`/api/photos/${ph.id}`} target="_blank" rel="noopener" aria-label={tp('open', { at })}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- private, uncached photo */}
                        <img src={`/api/photos/${ph.id}/thumb`} alt={tp('alt', { at })} />
                      </a>
                      <small className="num">{at}</small>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {tr.consultations.length ? (
              <ul className="conslist" aria-label={`${t('consultationsOf')} ${label}`}>
                {tr.consultations.map((c) => (
                  <li key={c.id}>
                    <Link href={`${base}/consultations/${c.id}`}>
                      <span className="n">{t('number', { n: c.number })}</span>
                      <span className="d num">{formatDateTime(c.at)}</span>
                      <span className="p num">{pain(c)}</span>
                      <span className="x">
                        {[
                          c._count.points ? t('points', { count: c._count.points }) : null,
                          c._count.exercises ? t('exercises', { count: c._count.exercises }) : null,
                          c._count.rolling ? t('rolling', { count: c._count.rolling }) : null,
                          c._count.photos ? t('photoCount', { count: c._count.photos }) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <span aria-hidden="true">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="body muted">{t('noConsultations')}</div>
            )}
          </section>
        );
      })}
    </>
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

/** Name of a treatment or consultation field in the history ("point:2.11.1:sensitivity" → "Punkt 2.11.1 …") */
function sheetFieldLabel(th: T, field: string | null): string {
  if (!field) return '';
  const [kind, id, sub] = field.split(':');
  const key: Record<string, string> = {
    startedAt: 'fStartedAt',
    regionId: 'fRegionId',
    diagnosis: 'fDiagnosis',
    painStart: 'fPainStart',
    at: 'fAt',
    painBefore: 'fPainBefore',
    painAfter: 'fPainAfter',
    comparison: 'fComparison',
    'point:left': 'fPointLeft',
    'point:right': 'fPointRight',
    'point:sensitivity': 'fPointSensitivity',
    'exercise:prescribed': 'fExercisePrescribed',
    'exercise:difficulty': 'fExerciseDifficulty',
    'exercise:variants': 'fExerciseVariants',
    'rolling:area': 'fRollingArea',
    'rolling:tool': 'fRollingTool',
  };
  const k = key[sub ? `${kind}:${sub}` : kind];
  return k ? th(k as never, { id } as never) : field;
}

async function History({
  events,
  regions,
}: {
  events: AuditEvent[];
  regions: { id: number; nameDe: string; nameEn: string }[];
}) {
  const t = await getTranslations('history');
  const tf = await getTranslations('form');
  const ts = await getTranslations('scales');
  const locale = await getLocale();
  const detail = (e: AuditEvent) => (e.details ?? {}) as { regionId?: number; number?: number };
  const region = (e: AuditEvent) => {
    const r = regions.find((x) => x.id === detail(e).regionId);
    return r ? `${regionLabel(r, locale)} · ` : '';
  };
  const label = (e: AuditEvent) => {
    switch (e.action) {
      case 'treatment.created':
        return region(e) + t('treatmentCreated');
      case 'treatment.updated':
        return region(e) + t('treatmentUpdated', { field: sheetFieldLabel(t, e.field) });
      case 'consultation.created':
        return region(e) + t('consultationCreated', { n: detail(e).number ?? 0 });
      case 'consultation.updated':
        return region(e) + t('consultationUpdated', { n: detail(e).number ?? 0, field: sheetFieldLabel(t, e.field) });
      case 'photo.added':
        return region(e) + (detail(e).number ? t('photoAddedConsultation', { n: detail(e).number! }) : t('photoAdded'));
      case 'photo.removed':
        return (
          region(e) + (detail(e).number ? t('photoRemovedConsultation', { n: detail(e).number! }) : t('photoRemoved'))
        );
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
  const show = (e: AuditEvent, v: string | null) => {
    if (v === 'true') return '✓';
    if (v === 'false') return '–';
    if (v && /^(LOW|MEDIUM|STRONG|EXTREME|EASY|HARD|IMPOSSIBLE)$/.test(v)) return ts(v as 'LOW');
    if (v && /^(painStart|painBefore|painAfter)$/.test(e.field ?? '')) return `${v} %`;
    if (v && e.field === 'regionId') {
      const r = regions.find((x) => String(x.id) === v);
      return r ? regionLabel(r, locale) : v;
    }
    return v;
  };
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
                            <del>{show(e, e.before)}</del> →{' '}
                          </>
                        ) : null}
                        <ins>{show(e, e.after)}</ins>
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
