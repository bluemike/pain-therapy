import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { backPath, pdfSource } from '@pain-therapy/shared/pdf-view';
import { PdfViewer } from '@/components/PdfViewer';

export const dynamic = 'force-dynamic';

/** Sources of PDFs in the practice app: archived documents and the handout preview */
const SOURCES = ['/documents/', '/patients/'] as const;

/** app-navigation (iteration 9, design D3): PDF in the app with "Zurück" */
export default async function PdfPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; back?: string; title?: string }>;
}) {
  const sp = await searchParams;
  const src = pdfSource(sp.src, SOURCES);
  if (!src) notFound();
  const t = await getTranslations('pdfView');
  return (
    <PdfViewer
      src={src}
      title={sp.title?.slice(0, 120) || t('title')}
      backHref={backPath(sp.back, '/')}
      labels={{
        back: t('back'),
        download: t('download'),
        loading: t('loading'),
        error: t('error'),
        page: t.raw('page') as string,
      }}
    />
  );
}
