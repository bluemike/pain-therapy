import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { localName } from '@/lib/catalog';
import { exerciseDetail } from '@/lib/exercise-sheets';
import { executionTime, formatMinutes } from '@/lib/home-program';
import { ExerciseImage } from '@/components/ExerciseImage';
import { ExerciseAudio } from '@/components/ExerciseAudio';

export const dynamic = 'force-dynamic';

/**
 * exercise-segments (iteration 8, design D2): Übung in den L&B Basisdaten. Main image and time needed, then the
 * parts Faszien-Rollmassage (band, text, tools, audio), Standardübung (band, steps, aids, audio) and Varianten (band,
 * one row with text, aids, time and audio per variant), and the whole sheet. Read-only; texts and images come from
 * the private container and are shown signed in only.
 */
export default async function ExercisePage({ params }: { params: Promise<{ code: string }> }) {
  await requireUser();
  const { code } = await params;
  const x = await exerciseDetail(decodeURIComponent(code));
  if (!x) notFound();
  const [t, tc, locale] = await Promise.all([getTranslations('exercise'), getTranslations('catalog'), getLocale()]);
  const min = (m: number) => formatMinutes(m, locale);
  const todo = <span className="todo">{t('notCaptured')}</span>;
  const notSet = <span className="todo">{t('notSet')}</span>;
  const regions = x.regions.map((r) => r.region.code).join(', ');
  const group = `${x.bodyArea.id} ${localName(x.bodyArea, locale)}`;
  const e = executionTime(x.timing);
  const seg = x.segments;
  const stdSeconds = x.timing?.stretchSecondsPerSide ? x.timing.stretchSecondsPerSide * x.timing.sides : null;
  const aids = (list: string[]) => (list.length ? list.join(', ') : t('noAids'));
  return (
    <>
      <div className="crumb">
        <Link href="/catalog?tab=exercises">← {t('back')}</Link>
        {/* tc: catalog namespace, for the title of the reference data */}
        <span className="muted"> · {tc('title')}</span>
      </div>
      <div className="ptitle">
        <div>
          <h1>
            {x.code} {localName(x, locale)}
          </h1>
          <div className="sub">
            {x.sheet ? t('meta', { group, regions, page: x.sheet.sheetPage }) : t('metaNoSheet', { group, regions })}
          </div>
        </div>
      </div>
      <div className="exdet">
        <div>
          <ExerciseImage className="exmain" code={x.code} kind="main" alt={t('mainImage', { code: x.code })} />
          <section className="card" aria-labelledby="h_timing">
            <h2 id="h_timing">{t('timing')}</h2>
            <dl className="kv">
              <div>
                <dt>{t('stretch')}</dt>
                <dd>
                  {x.timing?.stretchSecondsPerSide
                    ? t('stretchValue', { duration: min(x.timing.stretchSecondsPerSide / 60) })
                    : notSet}
                </dd>
              </div>
              <div>
                <dt>{t('sides')}</dt>
                <dd>{x.timing ? x.timing.sides : notSet}</dd>
              </div>
              <div>
                <dt>{t('rolling')}</dt>
                <dd>{x.timing?.rollingSeconds ? min(x.timing.rollingSeconds / 60) : notSet}</dd>
              </div>
              <div>
                <dt>{t('execution')}</dt>
                <dd>
                  {x.timing ? min(e.seconds / 60) : notSet}
                  {x.timing && e.stretchMissing ? <small className="todo"> · {t('stretchNotSet')}</small> : null}
                </dd>
              </div>
            </dl>
            {x.timingTodo.length ? (
              <ul className="hint">
                {x.timingTodo.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>
        <div>
          <section className="card" aria-labelledby="h_rolling">
            <header>
              <h2 id="h_rolling">{t('sectionRolling')}</h2>
              {x.sheet ? (
                <ExerciseAudio code={x.code} kind="frm-audio" label={`${x.code} ${t('sectionRolling')}`} />
              ) : null}
            </header>
            <div className="body">
              <ExerciseImage
                className="exband"
                code={x.code}
                kind="frm"
                alt={t('bandOf', { code: x.code, part: t('sectionRolling') })}
                lazy
              />
              <p>
                {t('tools')}:{' '}
                {x.tools.length
                  ? x.tools.map((tool, i) => (
                      <span key={tool.code}>
                        {i ? ', ' : ''}
                        <Link href="/catalog?tab=tools" title={localName(tool, locale)}>
                          {tool.code}
                        </Link>
                      </span>
                    ))
                  : '–'}
                {x.timing?.rollingSeconds ? ` · ${min(x.timing.rollingSeconds / 60)}` : null}
              </p>
              {seg ? (
                seg.frm.items.length ? (
                  <ol className="steps">
                    {seg.frm.items.map((it, i) => (
                      <li key={i}>
                        {it.n.length ? <b>({it.n.join('/')}) </b> : null}
                        <span className="pre">{it.text}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  '–'
                )
              ) : (
                todo
              )}
            </div>
          </section>
          <section className="card" aria-labelledby="h_stretch">
            <header>
              <h2 id="h_stretch">{t('sectionStandard')}</h2>
              {x.sheet ? (
                <ExerciseAudio code={x.code} kind="std-audio" label={`${x.code} ${t('sectionStandard')}`} />
              ) : null}
            </header>
            <div className="body">
              <ExerciseImage
                className="exband"
                code={x.code}
                kind="std"
                alt={t('bandOf', { code: x.code, part: t('sectionStandard') })}
                lazy
              />
              <p>
                {t('aids')}: {aids(x.sheet?.standardAids ?? [])}
                {stdSeconds
                  ? ` · ${t('sidesTimes', { sides: x.timing!.sides, duration: min(x.timing!.stretchSecondsPerSide! / 60) })}`
                  : null}
              </p>
              {seg ? (
                <>
                  {seg.standard.intro ? <p className="pre">{seg.standard.intro}</p> : null}
                  <ol className="steps">
                    {seg.standard.steps.map((st, i) => (
                      <li key={i}>
                        {st.label ? <b>{st.label}: </b> : null}
                        <span className="pre">{st.text}</span>
                      </li>
                    ))}
                  </ol>
                  {seg.standard.note ? <p className="hint pre">{seg.standard.note}</p> : null}
                </>
              ) : (
                todo
              )}
            </div>
          </section>
          <section className="card" aria-labelledby="h_variants">
            <h2 id="h_variants">{t('sectionVariants')}</h2>
            <div className="body">
              {x.epdVariants.length ? (
                <>
                  <ExerciseImage
                    className="exband"
                    code={x.code}
                    kind="var"
                    alt={t('bandOf', { code: x.code, part: t('sectionVariants') })}
                    lazy
                  />
                  {seg?.variants.intro ? <p className="pre">{seg.variants.intro}</p> : null}
                  <div className="sheetwrap">
                    <table className="list catalog">
                      <thead>
                        <tr>
                          <th scope="col">{t('colVariant')}</th>
                          <th scope="col">{t('colImages')}</th>
                          <th scope="col">{t('colText')}</th>
                          <th scope="col">{t('aids')}</th>
                          <th scope="col">{t('colTime')}</th>
                          <th scope="col">{t('listen')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {x.epdVariants.map((v) => {
                          const text = seg?.variants.items.find((it) => it.number === v.number)?.text;
                          const seconds = v.seconds ?? stdSeconds;
                          return (
                            <tr key={v.number} data-variant={v.number}>
                              <td className="pid">{t('variantN', { n: v.number })}</td>
                              <td className="num">{v.images.join('+')}</td>
                              <td className="pre">{text ?? (seg ? '–' : todo)}</td>
                              <td>{aids(v.aids)}</td>
                              <td className="num">{seconds ? min(seconds / 60) : notSet}</td>
                              <td>
                                <ExerciseAudio
                                  code={x.code}
                                  kind={`v${v.number}-audio`}
                                  label={`${x.code} ${t('variantN', { n: v.number })}`}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="muted">{t('noVariants')}</p>
              )}
            </div>
          </section>
          <section className="card" aria-labelledby="h_sheet">
            <h2 id="h_sheet">{t('sheet')}</h2>
            <div className="body">
              <ExerciseImage className="exsheet" code={x.code} kind="sheet" alt={t('sheetImage', { code: x.code })} />
            </div>
          </section>
          <p className="hint">{t('source')}</p>
        </div>
      </div>
    </>
  );
}
