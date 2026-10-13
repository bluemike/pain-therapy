import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { INITIAL_TEXTS, listVersions } from '@/lib/consent-texts';
import { dashboardData } from '@/lib/patients';
import { formatDateTime } from '@/lib/format';
import { ConsentTextForm } from '@/components/ConsentTextForm';

export const dynamic = 'force-dynamic';

/** consent-signing: Versionierte Formulartexte (Administration only) */
export default async function ConsentTextsPage() {
  await requireUser('manageConsentTexts');
  const t = await getTranslations('admin');
  const versions = await listVersions();
  const latest = versions[0]?.version ?? 0;
  const de = versions.find((v) => v.version === latest && v.language === 'de');
  const en = versions.find((v) => v.version === latest && v.language === 'en');
  const resign = (await dashboardData()).pending.filter((p) => p.consent === 'resign').length;
  const grouped = [...new Set(versions.map((v) => v.version))].map((n) => versions.filter((v) => v.version === n));
  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{t('subtitle')}</div>
        </div>
      </div>
      {latest ? (
        <div className="banner info">
          <p>{t('resignCount', { count: resign })}</p>
        </div>
      ) : null}
      <div className="two">
        <section className="card">
          <h2>{t('newVersion')}</h2>
          <div className="body">
            <ConsentTextForm
              nextVersion={latest + 1}
              initial={{
                titleDe: de?.title ?? INITIAL_TEXTS.de.title,
                bodyDe: de?.body ?? INITIAL_TEXTS.de.body,
                titleEn: en?.title ?? INITIAL_TEXTS.en.title,
                bodyEn: en?.body ?? INITIAL_TEXTS.en.body,
              }}
            />
          </div>
        </section>
        <section className="card">
          <h2>{t('version', { version: '' }).trim()}</h2>
          {grouped.length ? (
            <ul className="rows">
              {grouped.map((g) => (
                <li key={g[0].version} style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <b>{t('version', { version: g[0].version })}</b>
                    {g[0].version === latest ? <span className="pill ok">{t('current')}</span> : null}
                  </div>
                  <small>{t('publishedOn', { at: formatDateTime(g[0].publishedAt), by: g[0].publishedBy })}</small>
                  {g.map((v) => (
                    <details key={v.id} style={{ width: '100%' }}>
                      <summary style={{ cursor: 'pointer', minHeight: 32 }}>
                        {v.language.toUpperCase()} · {v.title}
                      </summary>
                      <div className="admin-text">{v.body}</div>
                    </details>
                  ))}
                </li>
              ))}
            </ul>
          ) : (
            <div className="body muted">{t('noVersions')}</div>
          )}
        </section>
      </div>
    </>
  );
}
