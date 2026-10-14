import { getLocale, getTranslations } from 'next-intl/server';
import { formatDate, formatDateTime, formatDateZurich } from '@/lib/format';
import { localName } from '@/lib/catalog';
import { repetitionParts, type Repetition } from '@/lib/home-program';
import { zoneEnabled } from '@/lib/patient-access';
import type { exerciseLogOf } from '@/lib/exercise-log';
import { regionLabel } from '@/lib/catalog';
import { AccessLinkPanel } from './AccessLinkPanel';
import { LinkStatusPill } from './LinkStatusPill';
import { RatingSparkline } from './RatingSparkline';

type Log = Awaited<ReturnType<typeof exerciseLogOf>>;

/**
 * adherence-overview: Reiter "Übungstagebuch" (design D10, mockup view 4). Key figures, table per exercise with the
 * rating over time, the entries with notes and the status of the link. Read only: no change or delete is offered.
 */
export async function ExerciseLogTab({ patientId, log, flash }: { patientId: string; log: Log; flash?: string }) {
  const [t, th, locale] = await Promise.all([getTranslations('exerciseLog'), getTranslations('home'), getLocale()]);
  const rep = (r: Repetition) => {
    const { daily, times } = repetitionParts(r);
    return th(daily ? 'repDaily' : 'repWeekly', { n: times });
  };
  const a = log.adherence;
  const program = log.program;
  const link = log.link;
  const linkOpen = !!link && !link.revokedAt && !link.replacedAt;
  const emailDelivery = link?.deliveries.find((d) => d.channel === 'EMAIL');
  return (
    <>
      {flash === 'linkRevoked' ? (
        <div className="banner ok" role="status">
          <p>{t('revokedFlash')}</p>
        </div>
      ) : null}
      {a?.flags.length ? (
        <div className="banner warn" role="status">
          <p>{a.flags.map((f) => t(f === 'lowAdherence' ? 'flagLow' : 'flagNoEntry')).join(' · ')}</p>
        </div>
      ) : null}
      {a ? (
        <div className="kpis">
          <div className="card">
            <b className="num" data-testid="log-adherence">
              {a.total.percent ?? 0} %
            </b>
            <span>{t('kpiAdherence')}</span>
          </div>
          <div className="card">
            <b className="num">
              {a.total.done} / {a.total.required}
            </b>
            <span>{t('kpiDone')}</span>
          </div>
          <div className="card">
            <b className="num">{a.averageRating?.toFixed(1) ?? '–'}</b>
            <span>{t('kpiRating')}</span>
          </div>
          <div className="card">
            <b className="num">{a.lastEntryAt ? formatDateTime(a.lastEntryAt) : t('noEntryYet')}</b>
            <span>{t('kpiLast')}</span>
          </div>
        </div>
      ) : null}
      <div className="two logtwo">
        <div className="stack">
          <section className="card" aria-labelledby="h_perExercise">
            <h2 id="h_perExercise">{t('perExercise')}</h2>
            {program && a ? (
              <>
                <div className="body muted small">
                  {t('programFrom', {
                    n: program.consultation.number,
                    date: formatDateZurich(program.consultation.at),
                    region: regionLabel(program.consultation.treatment.region, locale),
                  })}
                  {!log.active ? ` · ${t('programInactive')}` : ''}
                </div>
                <div className="tablewrap-s" role="region" aria-labelledby="h_perExercise" tabIndex={0}>
                  <table className="adhtable">
                    <thead>
                      <tr>
                        <th scope="col">{t('colExercise')}</th>
                        <th scope="col">{t('colRepetition')}</th>
                        <th scope="col">{t('colRequired')}</th>
                        <th scope="col">{t('colDone')}</th>
                        <th scope="col">{t('colAdherence')}</th>
                        <th scope="col">{t('colRating')}</th>
                        <th scope="col">{t('colLast')}</th>
                        <th scope="col">{t('colTrend')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {a.perExercise.map((x) => {
                        const p = program.prescriptions.find((y) => y.exerciseCode === x.exerciseCode)!;
                        return (
                          <tr key={x.exerciseCode} data-code={x.exerciseCode}>
                            <td>
                              <b>{x.exerciseCode}</b> {localName(p.exercise, locale)}
                            </td>
                            <td data-l={t('colRepetition')}>{rep(x.repetition)}</td>
                            <td data-l={t('colRequired')} className="num">
                              {x.required}
                            </td>
                            <td data-l={t('colDone')} className="num">
                              {x.done}
                            </td>
                            <td data-l={t('colAdherence')}>
                              <span className={`pill ${(x.percent ?? 0) < 50 ? 'err' : 'ok'}`}>{x.percent ?? 0} %</span>
                            </td>
                            <td data-l={t('colRating')} className="num">
                              {x.averageRating?.toFixed(1) ?? '–'}
                            </td>
                            <td data-l={t('colLast')} className="num">
                              {x.lastEntryAt ? formatDateTime(x.lastEntryAt) : '–'}
                            </td>
                            <td>
                              <RatingSparkline
                                ratings={x.ratings.map((r) => r.rating)}
                                label={t('ratingsOf', {
                                  code: x.exerciseCode,
                                  list: x.ratings.map((r) => r.rating).join(', '),
                                })}
                              />
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="total">
                        <td>
                          <b>{t('total')}</b>
                        </td>
                        <td />
                        <td data-l={t('colRequired')} className="num">
                          {a.total.required}
                        </td>
                        <td data-l={t('colDone')} className="num">
                          {a.total.done}
                        </td>
                        <td data-l={t('colAdherence')}>
                          <span className={`pill ${(a.total.percent ?? 0) < 50 ? 'err' : 'ok'}`}>
                            {a.total.percent ?? 0} %
                          </span>
                        </td>
                        <td data-l={t('colRating')} className="num">
                          {a.averageRating?.toFixed(1) ?? '–'}
                        </td>
                        <td />
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="body muted">{t('noProgram')}</div>
            )}
          </section>
          <section className="card" aria-labelledby="h_entries">
            <h2 id="h_entries">{t('entries')}</h2>
            {log.entries.length ? (
              <ul className="loglist">
                {log.entries.map((e) => (
                  <li key={e.id} className={e.deletedAt ? 'deleted' : undefined} data-testid="log-entry">
                    <span>
                      <b>{e.exerciseCode}</b> {localName(e.prescription.exercise, locale)}
                      <small className="num">
                        {formatDateTime(e.performedAt)}
                        {e.quick ? ` · ${t('quick')}` : ''}
                        {e.correctedAt ? ` · ${t('corrected', { at: formatDateTime(e.correctedAt) })}` : ''}
                        {e.deletedAt ? ` · ${t('deleted', { at: formatDateTime(e.deletedAt) })}` : ''}
                      </small>
                      {e.note ? <q className="note">{e.note}</q> : null}
                    </span>
                    <span className="res">
                      {e.done ? (
                        <>
                          <span className="pill ok">{t('done')}</span>{' '}
                          <span className="num">{e.rating ? `${e.rating}/10` : t('noRating')}</span>
                        </>
                      ) : (
                        <span className="pill off">{t('notDone')}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="body muted">{t('noEntries')}</div>
            )}
          </section>
        </div>
        <div className="stack">
          <section className="card linkcard" aria-labelledby="h_link">
            <h2 id="h_link">{t('link')}</h2>
            <div className="body">
              <dl className="kv">
                <div>
                  <dt>{t('linkStatus')}</dt>
                  <dd data-testid="link-status">
                    <LinkStatusPill status={log.linkStatus} />
                  </dd>
                </div>
                {link ? (
                  <>
                    <div>
                      <dt>{t('linkIssued')}</dt>
                      <dd className="num">
                        {formatDateTime(link.createdAt)} · {link.createdBy}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('linkValidUntil')}</dt>
                      <dd className="num">{formatDate(link.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt>{t('linkLastUsed')}</dt>
                      <dd className="num">{link.lastUsedAt ? formatDateTime(link.lastUsedAt) : '–'}</dd>
                    </div>
                    <div>
                      <dt>{t('linkFailures')}</dt>
                      <dd className="num">{link.failedAttempts}</dd>
                    </div>
                    {emailDelivery ? (
                      <div>
                        <dt>{t('linkEmail')}</dt>
                        <dd data-testid="link-email">
                          {emailDelivery.status === 'SENT'
                            ? t('emailSent', {
                                to: emailDelivery.recipient ?? '',
                                at: formatDateTime(emailDelivery.sentAt),
                              })
                            : emailDelivery.status === 'FAILED'
                              ? t('emailFailed', { attempts: emailDelivery.attempts })
                              : t('emailPending')}
                        </dd>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </dl>
              {zoneEnabled() ? (
                <AccessLinkPanel
                  patientId={patientId}
                  canSend={log.active}
                  canRevoke={linkOpen && log.linkStatus !== 'expired'}
                />
              ) : (
                <p className="muted small">{t('zoneDisabled')}</p>
              )}
              <p className="muted small">{t('linkNote')}</p>
            </div>
          </section>
          <div className="banner warn">
            <p>{t('readOnly')}</p>
          </div>
        </div>
      </div>
    </>
  );
}
