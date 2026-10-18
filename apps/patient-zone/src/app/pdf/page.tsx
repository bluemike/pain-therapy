import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { backPath, pdfSource } from '@pain-therapy/shared/pdf-view';
import { PdfViewer } from '@/components/PdfViewer';
import { recordSession } from '@/lib/record-session';

export const dynamic = 'force-dynamic';

/** app-navigation (iteration 9, design D3): a document of the patient in the zone with "Zurück" */
export default async function PdfPage({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; back?: string; title?: string }>;
}) {
  await recordSession();
  const sp = await searchParams;
  const src = pdfSource(sp.src, ['/dokumente/']);
  if (!src) notFound();
  const t = await getTranslations('pdfView');
  return (
    <PdfViewer
      src={src}
      title={sp.title?.slice(0, 120) || t('title')}
      backHref={backPath(sp.back, '/dokumente')}
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
