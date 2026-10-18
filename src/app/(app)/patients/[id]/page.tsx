import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import type { AuditEvent, EmailDelivery } from '@prisma/client';
import { requireUser } from '@/lib/session';
import { historyOf, viewPatient } from '@/lib/patients';
import { treatmentsOf } from '@/lib/treatments';
import { listRegions, regionLabel } from '@/lib/catalog';
import { ageOn, formatDate, formatDateTime, formatPercent } from '@/lib/format';
import { weekdaysOf } from '@/lib/home-program';
import { ConsentPill, StatusPill } from '@/components/Pills';
import { PlusIcon } from '@/components/Icons';
import { DeactivateDialog } from '@/components/DeactivateDialog';
import { HandoutList } from '@/components/HandoutList';
import { handoutsOf } from '@/lib/handouts';
import { exerciseLogOf } from '@/lib/exercise-log';
import { ExerciseLogTab } from '@/components/ExerciseLogTab';
import { SignatureInvite } from '@/components/SignatureInvite';
import { PdfLink } from '@/components/PdfLink';
import { consentStateOf, inviteStatusOf, zoneEnabled, type InviteStatus } from '@/lib/patient-access';
import { ConsentStatePoller } from '@/components/ConsentStatePoller';
import { reactivatePatient, resendEmail } from '../../actions';
import { resolveNoteAction } from '../../access-link-actions';

export const dynamic = 'force-dynamic';

type Tab = 'treatments' | 'personal' | 'anamnesis' | 'documents' | 'log' | 'history';

export default async function PatientRecord({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; flash?: string; error?: string; n?: string; invite?: string }>;
}) {
  const actor = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  // patient-records: Behandlungen in der Akte, first tab and default view (iteration 2, design D7)
  const tab: Tab =
    (['personal', 'anamnesis', 'documents', 'log', 'history'] as const).find((x) => x === sp.tab) ?? 'treatments';
  const p = await viewPatient(actor, id);
  if (!p) notFound();
  const [t, tc, tf, te, td, tp, tsi] = await Promise.all([
    getTranslations('record'),
    getTranslations('common'),
    getTranslations('form'),
    getTranslations('errors'),
    getTranslations('deactivate'),
    getTranslations('patients'),
    getTranslations('signatureInvite'),
  ]);
  const [treatments, handouts] = await Promise.all([treatmentsOf(p.id), handoutsOf(p.id)]);
  const name = `${p.firstName} ${p.lastName}`;
  const active = p.status === 'ACTIVE';
  const lastSession = p.signatureSessions[0];
  // zone-consent-invitation (iteration 5, design D3, D9): invite to sign in the patient zone, state of the invitation
  const canInvite = active && p.consent !== 'signed' && zoneEnabled();
  const invite = active && zoneEnabled() ? await inviteStatusOf(p.id, p.consent !== 'signed') : null;
  // zone-documents (iteration 9, design D5): watch an open invitation and a PDF still being created
  const watching =
    !!invite &&
    (invite.kind === 'sent' || invite.kind === 'opened' || invite.kind === 'failed' || p.finalizing.length > 0);
  const consentState = watching ? await consentStateOf(p.id) : null;
  const inviteButton = (variant: 'gold' | 'ghost', openOnLoad = false) =>
    canInvite ? (
      <SignatureInvite patientId={p.id} name={name} email={p.email} variant={variant} openOnLoad={openOnLoad} />
    ) : null;

  const flash =
    sp.flash === 'created'
      ? {
          kind: 'ok',
          text: t('createdFlash', { name }),
          action: active && p.consent !== 'signed' ? <div className="actions">{inviteButton('gold')}</div> : null,
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
    ['log', t('tabLog')],
    ['history', t('tabHistory')],
  ];

  return (
    <>
      {consentState ? <ConsentStatePoller patientId={p.id} state={consentState} /> : null}
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
            {invite ? <InviteLine invite={invite} t={tsi} /> : null}
          </p>
          <div className="actions">{inviteButton('gold', sp.invite === '1')}</div>
        </div>
      ) : p.consent === 'resign' ? (
        <div className="banner warn">
          <p>
            {t('resignBanner', { version: p.currentVersion })}
            {invite ? <InviteLine invite={invite} t={tsi} /> : null}
          </p>
          <div className="actions">{inviteButton('gold', sp.invite === '1')}</div>
        </div>
      ) : invite?.kind === 'signedOnline' ? (
        <div className="banner ok" role="status">
          <p>
            <InviteLine invite={invite} t={tsi} />
          </p>
        </div>
      ) : null}
      {p.unresolvedNote?.patientNote ? (
        <div className="banner info notebox" data-testid="patient-note">
          <p>
            <b>{tsi('noteTitle', { name: p.firstName })}</b> <q>{p.unresolvedNote.patientNote}</q>
          </p>
          <form action={resolveNoteAction}>
            <input type="hidden" name="patientId" value={p.id} />
            <input type="hidden" name="sessionId" value={p.unresolvedNote.id} />
            <button className="btn btn--ghost">{tsi('noteDone')}</button>
          </form>
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
              {inviteButton('ghost')}
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
            {k === 'documents' ? <span className="count">{p.documents.length + handouts.length}</span> : null}
            {k === 'treatments' ? <span className="count">{treatments.length}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === 'treatments' ? (
        <Treatments patientId={p.id} list={treatments} active={active} canOpen={active && p.consent === 'signed'} />
      ) : null}
      {tab === 'personal' ? <Personal p={p} tf={tf} tc={tc} /> : null}
      {tab === 'anamnesis' ? <AnamnesisView a={p.anamnesis} tf={tf} tc={tc} /> : null}
      {tab === 'documents' ? (
        <>
          <Documents p={p} invite={inviteButton('gold')} />
          {handouts.length ? (
            <section className="card" aria-labelledby="h_handouts">
              <h2 id="h_handouts">{(await getTranslations('documents'))('handouts')}</h2>
              <HandoutList handouts={handouts} />
            </section>
          ) : null}
        </>
      ) : null}
      {tab === 'log' ? (
        <ExerciseLogTab patientId={p.id} log={await exerciseLogOf(actor, p.id)} flash={sp.flash} />
      ) : null}
      {tab === 'history' ? <History events={await historyOf(p.id)} regions={await listRegions()} /> : null}
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;
type Rec = NonNullable<Awaited<ReturnType<typeof viewPatient>>>;

/** zone-consent-invitation: Stand der Einladung in der Akte (design D9) */
function InviteLine({ invite, t }: { invite: InviteStatus; t: T }) {
  const text =
    invite.kind === 'notInvited'
      ? t('notInvited')
      : invite.kind === 'sent'
        ? t(`sent${invite.channel}`, { at: formatDateTime(invite.at) })
        : invite.kind === 'failed'
          ? t('failed')
          : invite.kind === 'opened'
            ? t('opened', { at: formatDateTime(invite.at) })
            : t('signedOnline', { at: formatDateTime(invite.at), version: invite.version });
  return invite.kind === 'signedOnline' ? (
    <span data-testid="invite-state">{text}</span>
  ) : (
    <span className="sigstate" data-testid="invite-state">
      {' · '}
      {text}
    </span>
  );
}

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
                <h2 id={`th-${tr.id}`}>{t('treatmentTitle', { label })}</h2>
                <div className="meta num">
                  {t('opened', { at: formatDateTime(tr.startedAt) })} ·{' '}
                  {t('painStart', { pain: formatPercent(tr.painStart) })} ·{' '}
                  {t('sideLine', { side: t(`side_${tr.side}`) })} · {t('photoCount', { count: tr.photos.length })}
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
            {/* session-form (iteration 9): sessions under a dark gold divider, each with its own "Ändern" */}
            {tr.consultations.length ? (
              <div className="sessions">
                <h3 className="sessions-h">{t('consultationsOf')}</h3>
                <ul className="conslist" aria-label={`${t('consultationsOf')} ${label}`}>
                  {tr.consultations.map((c) => (
                    <li key={c.id}>
                      <span className="n">{t('sessionTitle', { n: c.number })}</span>
                      <span className="d num">{formatDateTime(c.at)}</span>
                      <span className="p num">{pain(c)}</span>
                      <span className="x">
                        {[
                          c._count.points ? t('points', { count: c._count.points }) : null,
                          c._count.exercises ? t('exercises', { count: c._count.exercises }) : null,
                          c._count.photos ? t('photoCount', { count: c._count.photos }) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <Link
                        className="btn btn--ghost"
                        href={`${base}/consultations/${c.id}`}
                        aria-label={`${t('edit')}: ${t('sessionTitle', { n: c.number })}`}
                      >
                        {t('edit')}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
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
  // zone-documents (iteration 9, design D4): with the patient zone the document is sent to nobody, it is there
  if (!d)
    return zoneEnabled() ? (
      <>
        <span className="pill ok">{t('zonePill')}</span>
        <span>{t('inZone')}</span>
      </>
    ) : null;
  const printLink = (
    <PdfLink src={`/documents/${documentId}`} style={{ minHeight: 36 }}>
      {tc('print')}
    </PdfLink>
  );
  const resend = zoneEnabled() ? null : (
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

async function Documents({ p, invite }: { p: Rec; invite: React.ReactNode }) {
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
          <div className="act">{invite}</div>
        </div>
      ) : null}
      {p.finalizing.map((f) => (
        <div className="doc" key={f.id} data-testid="doc-finalizing">
          <div className="ico" style={{ color: 'var(--muted)' }}>
            PDF
          </div>
          <div style={{ minWidth: 0 }}>
            <b>{t('title')}</b> <span className="pill warn">{t('finalizing')}</span>
            <div className="meta num">
              <span>{t('finalizingMeta', { at: formatDateTime(f.completedAt), version: f.textVersion.version })}</span>
              <span>
                {t('channel')}: {t(`channel${f.channel}`)}
              </span>
            </div>
          </div>
        </div>
      ))}
      {p.documents.map((d, i) => (
        <div className="doc" key={d.id}>
          <div className="ico">PDF</div>
          <div style={{ minWidth: 0 }}>
            <b>{t('title')}</b>{' '}
            {i === 0 && !p.finalizing.length ? (
              <span className="pill ok">{t('valid')}</span>
            ) : (
              <span className="pill off">{t('superseded')}</span>
            )}
            <div className="meta num">
              <span>{t('signedOn', { at: formatDateTime(d.session.completedAt ?? d.createdAt) })}</span>
              <span>{t('textVersion', { version: d.textVersion })}</span>
              <span>{t('documentNumber', { number: d.documentNumber })}</span>
              <span>{d.language.toUpperCase()}</span>
              <span>
                {t('channel')}: {t(`channel${d.session.channel}`)}
              </span>
            </div>
            <div className="del">
              <DeliveryLine d={d.deliveries[0]} documentId={d.id} patientId={p.id} />
            </div>
          </div>
          <div className="act">
            <PdfLink src={`/documents/${d.id}`} title={t('documentNumber', { number: d.documentNumber })}>
              {tc('openPdf')}
            </PdfLink>
          </div>
        </div>
      ))}
      {!p.documents.length && !p.finalizing.length && p.consent === 'signed' ? (
        <div className="body muted">{t('none')}</div>
      ) : null}
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
    side: 'fSide',
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
    'exercise:variant': 'fExerciseVariant',
    'home:timesPerDay': 'fHomeTimesPerDay',
    'home:weekdays': 'fHomeWeekdays',
    'home:note': 'fHomeNote',
  };
  const k = key[sub ? `${kind}:${sub}` : kind];
  return k ? th(k as never, { id } as never) : field;
}

async function History({
  events,
  regions,
}: {
  events: AuditEvent[];
  regions: { id: number; code: string; nameDe: string; nameEn: string }[];
}) {
  const t = await getTranslations('history');
  const tf = await getTranslations('form');
  const ts = await getTranslations('scales');
  const th = await getTranslations('home');
  const locale = await getLocale();
  const detail = (e: AuditEvent) =>
    (e.details ?? {}) as { regionId?: number; number?: number; kind?: string; exerciseCode?: string; channel?: string };
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
      case 'handout.created':
        return region(e) + t('handoutCreated', { n: detail(e).number ?? 0 });
      case 'handout.printed':
        return region(e) + t('handoutPrinted', { n: detail(e).number ?? 0 });
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
        return detail(e).channel === 'PATIENT_ZONE' ? t('signedZone') : t('signed');
      case 'document.archived':
        return t('documentArchived');
      case 'email.sent':
        return detail(e).kind === 'accessLink'
          ? t('linkEmailSent')
          : detail(e).kind === 'signatureInvite'
            ? t('inviteEmailSent')
            : t('emailSent');
      case 'email.failed':
        return detail(e).kind === 'accessLink'
          ? t('linkEmailFailed')
          : detail(e).kind === 'signatureInvite'
            ? t('inviteEmailFailed')
            : t('emailFailed');
      // zone-consent-invitation and zone-consent-signing (iteration 5)
      case 'accessLink.invited':
        return t('linkInvited');
      case 'signing.noteResolved':
        return t('noteResolved');
      case 'signing.formOpened':
        return t('formOpened');
      // zone-documents (iteration 6): the document number is shown as the new value
      case 'document.viewedInZone':
        return t('documentViewedInZone');
      // patient-access and exercise-log (iteration 4): link events and entries of the patient zone
      case 'accessLink.issued':
        return t('linkIssued');
      case 'accessLink.replaced':
        return t('linkReplaced');
      case 'accessLink.sent':
        return t('linkSent');
      case 'accessLink.shown':
        return t('linkShown');
      case 'accessLink.printed':
        return t('linkPrinted');
      case 'accessLink.revoked':
        return t('linkRevoked');
      case 'accessLink.confirmed':
        return t('linkConfirmed');
      case 'accessLink.confirmFailed':
        return t('linkConfirmFailed');
      case 'accessLink.locked':
        return t('linkLocked');
      case 'accessLink.blocked':
        return t('linkBlocked');
      case 'zone.signedOut':
        return t('zoneSignedOut');
      case 'exerciseLog.created':
        return t('logCreated', { code: detail(e).exerciseCode ?? '' });
      case 'exerciseLog.corrected':
        return t('logCorrected', { code: detail(e).exerciseCode ?? '' });
      case 'exerciseLog.deleted':
        return t('logDeleted', { code: detail(e).exerciseCode ?? '' });
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
    if (v && e.field === 'side') return t(`side_${v}` as 'side_LEFT');
    if (v && /^exercise:.*:variant$/.test(e.field ?? '')) return t('variantN', { n: v });
    if (v && /^home:.*:timesPerDay$/.test(e.field ?? '')) return th('timesPerDayN', { n: v });
    if (v && /^home:.*:weekdays$/.test(e.field ?? ''))
      return weekdaysOf(Number(v))
        .map((d) => th(`short_${d}`))
        .join(' ');
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
