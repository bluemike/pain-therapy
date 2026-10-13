import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireUser } from '@/lib/session';
import { listPatients } from '@/lib/patients';
import { formatDate } from '@/lib/format';
import { ConsentPill, StatusPill } from '@/components/Pills';
import { SearchBox } from '@/components/SearchBox';
import { PlusIcon } from '@/components/Icons';

export const dynamic = 'force-dynamic';

type Filter = 'active' | 'inactive' | 'all';

/** patient-records: Patientenliste und Suche */
export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  await requireUser();
  const t = await getTranslations('patients');
  const td = await getTranslations('dashboard');
  const sp = await searchParams;
  const filter: Filter = sp.filter === 'inactive' || sp.filter === 'all' ? sp.filter : 'active';
  const q = sp.q ?? '';
  const rows = await listPatients({ q, filter });
  const href = (f: Filter) =>
    `/patients?${new URLSearchParams({ ...(q ? { q } : {}), ...(f !== 'active' ? { filter: f } : {}) })}`;

  return (
    <>
      <div className="ptitle">
        <div>
          <h1>{t('title')}</h1>
          <div className="sub">{t('count', { count: rows.length })}</div>
        </div>
        <Link className="btn btn--gold" href="/patients/new">
          <PlusIcon />
          {td('newPatient')}
        </Link>
      </div>
      <div className="toolbar">
        <SearchBox placeholder={td('searchPlaceholder')} id="lq" />
        <div className="chips" role="group" aria-label="Filter">
          {(['active', 'inactive', 'all'] as const).map((f) => (
            <Link key={f} href={href(f)} aria-current={filter === f ? 'true' : undefined} replace>
              {t(f === 'active' ? 'filterActive' : f === 'inactive' ? 'filterInactive' : 'filterAll')}
            </Link>
          ))}
        </div>
      </div>
      <div className="card">
        {rows.length ? (
          <>
            <div className="tablewrap">
              <table className="list">
                <thead>
                  <tr>
                    <th scope="col">{t('colName')}</th>
                    <th scope="col">{t('colDob')}</th>
                    <th scope="col">{t('colInsurance')}</th>
                    <th scope="col">{t('colConsent')}</th>
                    <th scope="col">{t('colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className={`click ${p.status === 'INACTIVE' ? 'inactive' : ''}`}>
                      <td>
                        <Link href={`/patients/${p.id}`}>
                          <b>{p.lastName}</b>, {p.firstName}
                        </Link>
                      </td>
                      <td className="num">{formatDate(p.dateOfBirth)}</td>
                      <td className="num">{p.insuranceNumber}</td>
                      <td>
                        <ConsentPill status={p.consent} />
                      </td>
                      <td>
                        <StatusPill active={p.status === 'ACTIVE'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="cards-m">
              {rows.map((p) => (
                <Link key={p.id} href={`/patients/${p.id}`}>
                  <span>
                    <b>{p.lastName}</b>, {p.firstName}
                    <small className="num">{formatDate(p.dateOfBirth)}</small>
                  </span>
                  {p.status === 'ACTIVE' ? <ConsentPill status={p.consent} /> : <StatusPill active={false} />}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="empty">
            <p className="muted" style={{ margin: 0 }}>
              {q ? t('noResults', { q }) : t('empty')}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
