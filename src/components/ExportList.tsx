import { getTranslations } from 'next-intl/server';
import { formatDateTime } from '@/lib/format';

type Row = {
  id: string;
  status: 'PENDING' | 'DONE' | 'FAILED';
  requestedBy: string;
  sizeBytes: number | null;
  createdAt: Date;
  expiresAt: Date | null;
};

const size = (b: number | null) =>
  !b ? '0 KB' : b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;

/** practice-export (iteration 12, design D9): the newest exports with their state and the download while valid */
export async function ExportList({ exports }: { exports: Row[] }) {
  const t = await getTranslations('exports');
  if (!exports.length) return null;
  const now = Date.now();
  return (
    <ul className="team" data-testid="exports">
      {exports.map((e) => {
        const valid = e.status === 'DONE' && e.expiresAt && e.expiresAt.getTime() > now;
        return (
          <li key={e.id}>
            <div className="who">
              <span>{t('by', { date: formatDateTime(e.createdAt), name: e.requestedBy })}</span>
              <span className="muted">{e.status === 'DONE' && !valid ? t('expired') : t(`status_${e.status}`)}</span>
            </div>
            {valid ? (
              <a className="btn btn--ghost" href={`/api/exports/${e.id}`} download>
                {t('download', { size: size(e.sizeBytes) })}
              </a>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
