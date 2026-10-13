import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { localName } from '@/lib/catalog';
import { exerciseDetail } from '@/lib/exercise-sheets';
import { executionTime, formatMinutes } from '@/lib/home-program';
import { ExerciseImage } from '@/components/ExerciseImage';

export const dynamic = 'force-dynamic';

/**
 * exercise-library: Übung im Katalog ansehen (mockup view 4). Main image, the sections of the sheet, the time needed
 * and the whole sheet. Read-only; texts and images come from the private container and are shown signed in only.
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
  const regions = x.regions.map((r) => r.regionId).join(', ');
  const group = x.group >= 1 && x.group <= 4 ? tc(`group${x.group}` as 'group1') : String(x.group);
  const e = executionTime(x.timing);
  const c = x.content;
  return (
    <>
      <div className="crumb">
        <Link href="/catalog?tab=exercises">← {t('back')}</Link>
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
            <h2 id="h_rolling">{t('sectionRolling')}</h2>
            <div className="body pre">{c ? (c.rolling ?? '–') : todo}</div>
          </section>
          <section className="card" aria-labelledby="h_stretch">
            <h2 id="h_stretch">{t('sectionStretch')}</h2>
            <div className="body">
              {c?.steps.length ? (
                <ol className="steps">
                  {c.steps.map((s, i) => (
                    <li key={i}>
                      {s.label ? <b>{s.label}: </b> : null}
                      <span className="pre">{s.text}</span>
                    </li>
                  ))}
                </ol>
              ) : c ? (
                '–'
              ) : (
                todo
              )}
            </div>
          </section>
          <section className="card" aria-labelledby="h_variants">
            <h2 id="h_variants">{t('sectionVariants')}</h2>
            <div className="body pre">{c ? (c.variants ?? '–') : todo}</div>
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
