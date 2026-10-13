import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { Patient, Region, Treatment } from '@prisma/client';
import { allPoints, localName, regionLabel, regionSheet, rollingTools } from '@/lib/catalog';
import { exerciseChoices } from '@/lib/exercise-sheets';
import { formatDateZurich, formatPercent } from '@/lib/format';
import { ConsultationForm, type ConsultationValues } from '@/components/ConsultationForm';
import type { SavedPhoto } from '@/components/PhotoField';

/** Page frame of a new or existing consultation: the treatment form of the area built from the catalog (design D3) */
export async function ConsultationPage({
  treatment,
  number,
  id,
  initial,
  saved,
  blocked,
  handoutHref,
}: {
  treatment: Treatment & { region: Region; patient: Patient };
  number: number;
  id?: string;
  initial: ConsultationValues;
  saved?: SavedPhoto[];
  blocked?: React.ReactNode;
  /** exercise-handout: shown once the saved consultation has home exercises */
  handoutHref?: string;
}) {
  const [t, locale] = await Promise.all([getTranslations('consultation'), getLocale()]);
  const p = treatment.patient;
  const base = `/patients/${p.id}`;
  const label = regionLabel(treatment.region, locale);
  const recorded = {
    pointIds: initial.sheet.points.map((x) => x.pointId),
    exerciseCodes: initial.sheet.exercises.map((x) => x.code),
  };
  const [sheet, points, tools, choices] = blocked
    ? [null, [], [], []]
    : await Promise.all([
        regionSheet(treatment.regionId, recorded),
        allPoints(),
        rollingTools(initial.sheet.rolling.map((r) => r.toolCode).filter((c): c is string => !!c)),
        exerciseChoices(recorded.exerciseCodes),
      ]);
  return (
    <>
      <div className="crumb">
        <Link href={`${base}#t-${treatment.id}`}>
          ← {p.firstName} {p.lastName} · {label}
        </Link>
      </div>
      <div className="ptitle">
        <div>
          <h1>{t('title', { n: number })}</h1>
          <div className="sub">{t('sheet', { region: label })}</div>
        </div>
        {handoutHref ? (
          <div className="actions">
            <Link className="btn btn--ghost" href={handoutHref}>
              {(await getTranslations('handout'))('create')}
            </Link>
          </div>
        ) : null}
      </div>
      {blocked ??
        (sheet ? (
          <ConsultationForm
            patientId={p.id}
            treatmentId={treatment.id}
            id={id}
            regionLabel={label}
            treatmentInfo={t('treatmentValue', {
              date: formatDateZurich(treatment.startedAt),
              pain: formatPercent(treatment.painStart),
            })}
            initial={initial}
            points={sheet.points}
            exercises={sheet.exercises}
            catalogPoints={points.map((x) => ({
              id: x.id,
              latin: x.muscleAttachmentLatin,
              de: x.attachmentDe,
              group: x.group,
            }))}
            catalogExercises={choices}
            tools={tools.map((x) => ({ code: x.code, name: localName(x, locale) }))}
            saved={saved}
            cancelHref={`${base}#t-${treatment.id}`}
          />
        ) : null)}
    </>
  );
}
