import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { catalogView, localName, type RollingStep, type Variant } from '@/lib/catalog';

export const dynamic = 'force-dynamic';

type Tab = 'regions' | 'points' | 'exercises' | 'tools';

/**
 * therapy-catalog: Katalog ansehen. Read-only for both roles (design D8): no form posts anything here; the region
 * filter is a plain GET form. Retired entries are not shown.
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
  const regionsOfPoint = (id: string) =>
    c.regionPoints
      .filter((x) => x.pointId === id)
      .map((x) => x.regionId)
      .join(', ');
  const groupName = (g: number) => (g >= 1 && g <= 4 ? t(`group${g}` as 'group1') : String(g));
  const points = region
    ? c.regionPoints
        .filter((x) => x.regionId === region.id)
        .map((x) => ({ ...c.points.find((p) => p.id === x.pointId)!, emphasis: x.emphasis }))
        .filter((p) => p.id)
    : c.points.map((p) => ({ ...p, emphasis: 'standard' as const }));
  const tc = await getTranslations('consultation');

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
              <tbody>
                {c.regions.map((r) => {
                  const rp = c.regionPoints.filter((x) => x.regionId === r.id);
                  return (
                    <tr key={r.id}>
                      <td className="pid num">{r.id}</td>
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
                {c.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id} · {localName(r, locale)}
                  </option>
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
                    <td>{groupName(p.group)}</td>
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
                  <th scope="col">{t('colRegions')}</th>
                  <th scope="col">{t('colRolling')}</th>
                  <th scope="col">{t('colVariants')}</th>
                </tr>
              </thead>
              <tbody>
                {c.exercises.map((x) => {
                  const rolling = x.rolling as RollingStep[] | null;
                  const variants = x.variants as Variant[] | null;
                  return (
                    <tr key={x.code}>
                      <td className="pid">{x.code}</td>
                      <td>
                        {localName(x, locale)}
                        <small className="muted"> · {other(x)}</small>
                      </td>
                      <td className="num">
                        {c.regionExercises
                          .filter((r) => r.exerciseCode === x.code)
                          .map((r) => r.regionId)
                          .join(', ')}
                      </td>
                      <td>
                        {rolling
                          ? rolling.map((r) => (
                              <div key={r.order}>
                                <b>{r.toolCode}</b>: {r.areaDe}
                              </div>
                            ))
                          : todo}
                      </td>
                      <td>{variants ? variants.map((v) => <div key={v.order}>{v.de}</div>) : todo}</td>
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
