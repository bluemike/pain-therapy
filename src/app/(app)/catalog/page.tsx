import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { catalogView, localName } from '@/lib/catalog';
import { timingOf } from '@/lib/exercise-sheets';
import { executionTime, formatMinutes } from '@/lib/home-program';
import { ExercisePreview } from '@/components/ExercisePreview';
import { ExerciseAudio } from '@/components/ExerciseAudio';

export const dynamic = 'force-dynamic';

type Tab = 'regions' | 'points' | 'exercises' | 'tools';

/**
 * therapy-catalog: "L&B Basisdaten" (iteration 8, design D1, D10). Read-only for both roles (iteration 2, design D8):
 * no form posts anything here; the filter is a plain GET form. The Schmerzbereiche are shown in their 4 Bereiche.
 * Retired entries are not shown.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; region?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;
  const tab: Tab = (['points', 'exercises', 'tools'] as const).find((x) => x === sp.tab) ?? 'regions';
  const [t, locale, c] = await Promise.all([getTranslations('catalog'), getLocale(), catalogView()]);
  const other = (x: { nameDe: string; nameEn: string }) => (locale === 'en' ? x.nameDe : x.nameEn);
  const todo = <span className="todo">{t('notCaptured')}</span>;
  const tabs: [Tab, string][] = [
    ['regions', t('tabRegions')],
    ['points', t('tabPoints')],
    ['exercises', t('tabExercises')],
    ['tools', t('tabTools')],
  ];
  const regionId = Number(sp.region) || null;
  const region = c.regions.find((r) => r.id === regionId) ?? null;
  const code = (regionId: number) => c.regions.find((r) => r.id === regionId)?.code ?? String(regionId);
  const regionsOfPoint = (id: string) =>
    c.regionPoints
      .filter((x) => x.pointId === id)
      .map((x) => code(x.regionId))
      .join(', ');
  const areaName = (g: number) => {
    const a = c.areas.find((x) => x.id === g);
    return a ? `${a.id} ${localName(a, locale)}` : String(g);
  };
  const points = region
    ? c.regionPoints
        .filter((x) => x.regionId === region.id)
        .map((x) => ({ ...c.points.find((p) => p.id === x.pointId)!, emphasis: x.emphasis }))
        .filter((p) => p.id)
    : c.points.map((p) => ({ ...p, emphasis: 'standard' as const }));
  const tc = await getTranslations('consultation');
  const te = await getTranslations('exercise');

  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{t('subtitle')}</div>
        </div>
      </div>
      <nav className="tabs" aria-label={t('title')}>
        {tabs.map(([k, label]) => (
          <Link
            key={k}
            href={`/catalog${k === 'regions' ? '' : `?tab=${k}`}`}
            aria-current={tab === k ? 'page' : undefined}
            replace
            scroll={false}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'regions' ? (
        <section className="card" aria-label={t('tabRegions')}>
          <div className="sheetwrap">
            <table className="list catalog">
              <thead>
                <tr>
                  <th scope="col">{t('colNo')}</th>
                  <th scope="col">{t('colRegion')}</th>
                  <th scope="col" className="hide-sm">
                    {t('colOtherLanguage')}
                  </th>
                  <th scope="col">{t('colPoints')}</th>
                  <th scope="col">{t('colMain')}</th>
                  <th scope="col">{t('colExercises')}</th>
                </tr>
              </thead>
              {c.areas.map((a) => (
                <tbody key={a.id}>
                  <tr className="grouprow">
                    <th scope="rowgroup" colSpan={6}>
                      {areaName(a.id)}
                      <small className="muted"> · {other(a)}</small>
                    </th>
                  </tr>
                  {c.regions
                    .filter((r) => r.bodyAreaId === a.id)
                    .map((r) => {
                      const rp = c.regionPoints.filter((x) => x.regionId === r.id);
                      return (
                        <tr key={r.id}>
                          <td className="pid num">{r.code}</td>
                          <td>
                            <Link href={`/catalog?tab=points&region=${r.id}`}>{localName(r, locale)}</Link>
                          </td>
                          <td className="hide-sm">{other(r)}</td>
                          <td className="num">{rp.length}</td>
                          <td className="num">
                            {rp
                              .filter((x) => x.emphasis === 'main')
                              .map((x) => x.pointId)
                              .join(', ')}
                          </td>
                          <td>
                            {c.regionExercises
                              .filter((x) => x.regionId === r.id)
                              .map((x) => x.exerciseCode)
                              .join(', ')}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              ))}
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'points' ? (
        <section className="card" aria-label={t('tabPoints')}>
          <header>
            <form className="filter" method="get" action="/catalog">
              <input type="hidden" name="tab" value="points" />
              <label htmlFor="c_region">{t('filterRegion')}</label>
              <select id="c_region" name="region" className="inp" defaultValue={region ? String(region.id) : ''}>
                <option value="">{t('allRegions')}</option>
                {c.areas.map((a) => (
                  <optgroup key={a.id} label={areaName(a.id)}>
                    {c.regions
                      .filter((r) => r.bodyAreaId === a.id)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.code} · {localName(r, locale)}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
              <button className="btn btn--ghost">{t('show')}</button>
            </form>
            <div className="legend">
              <span className="m">■ {tc('legendMain')}</span>
              <span className="r">■ {tc('legendRelevant')}</span>
              <span>■ {tc('legendStandard')}</span>
            </div>
          </header>
          <div className="sheetwrap">
            <table className="list catalog sheettab">
              <thead>
                <tr>
                  <th scope="col">{t('colPoint')}</th>
                  <th scope="col">{t('colMuscle')}</th>
                  <th scope="col">{t('colGroup')}</th>
                  <th scope="col">{t('colRegions')}</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.id} className={`e-${p.emphasis}`}>
                    <td className="pid num">{p.id}</td>
                    <td className="pname">
                      {p.muscleAttachmentLatin}
                      {p.emphasis === 'main' ? <span className="sr-only"> ({tc('legendMain')})</span> : null}
                      {p.emphasis === 'relevant' ? <span className="sr-only"> ({tc('legendRelevant')})</span> : null}
                      <small>{p.attachmentDe}</small>
                    </td>
                    <td>{areaName(p.group)}</td>
                    <td className="num">{regionsOfPoint(p.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'exercises' ? (
        <section className="card" aria-label={t('tabExercises')}>
          <div className="sheetwrap">
            <table className="list catalog">
              <thead>
                <tr>
                  <th scope="col">{t('colCode')}</th>
                  <th scope="col">{t('colExercise')}</th>
                  <th scope="col">{te('media')}</th>
                  <th scope="col">{t('colGroup')}</th>
                  <th scope="col">{t('colRegions')}</th>
                  <th scope="col">{t('colTiming')}</th>
                  <th scope="col">{t('colRolling')}</th>
                  <th scope="col">{t('colVariants')}</th>
                </tr>
              </thead>
              <tbody>
                {c.exercises.map((x) => {
                  const timing = timingOf(x.sheet);
                  const e = executionTime(timing);
                  return (
                    <tr key={x.code}>
                      <td className="pid">
                        <Link href={`/catalog/exercises/${x.code}`}>{x.code}</Link>
                      </td>
                      <td>
                        {localName(x, locale)}
                        <small className="muted"> · {other(x)}</small>
                      </td>
                      <td className="exmedia">
                        {x.sheet ? (
                          <>
                            <ExercisePreview code={x.code} name={localName(x, locale)} />
                            <ExerciseAudio code={x.code} />
                          </>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td>{areaName(x.group)}</td>
                      <td className="num">
                        {c.regionExercises
                          .filter((r) => r.exerciseCode === x.code)
                          .map((r) => code(r.regionId))
                          .join(', ')}
                      </td>
                      <td className="num">
                        {timing ? formatMinutes(e.seconds / 60, locale) : '–'}
                        {timing && e.stretchMissing ? <small className="todo"> · {te('stretchNotSet')}</small> : null}
                      </td>
                      <td>
                        {x.sheet?.rollingTools.length
                          ? x.sheet.rollingTools.map((code, i) => (
                              <span key={code}>
                                {i ? ', ' : ''}
                                <Link href="/catalog?tab=tools">{code}</Link>
                              </span>
                            ))
                          : todo}
                      </td>
                      <td className="num">
                        {x.epdVariants.length ? t('variantCount', { count: x.epdVariants.length }) : '–'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {tab === 'tools' ? (
        <section className="card" aria-label={t('tabTools')}>
          <div className="sheetwrap">
            <table className="list catalog">
              <thead>
                <tr>
                  <th scope="col">{t('colShort')}</th>
                  <th scope="col">{t('colTool')}</th>
                  <th scope="col">{t('colOtherLanguage')}</th>
                </tr>
              </thead>
              <tbody>
                {c.tools.map((x) => (
                  <tr key={x.code}>
                    <td className="pid">{x.code}</td>
                    <td>{localName(x, locale)}</td>
                    <td>{other(x)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
