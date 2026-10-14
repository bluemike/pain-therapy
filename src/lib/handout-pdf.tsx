import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { Language } from '@prisma/client';
import { config } from './config';
import { formatDate, formatDateZurich } from './format';
import { formatMinutes, repetitionParts, sheetFields, stepsLabel, type Repetition } from './home-program';
import { translator } from './i18n-server';
import { BORDER, GOLD, INK, MID, registerFonts } from './pdf';
import type { SheetContent } from './exercise-sheets';
import { AccessSheetPage, type AccessSheetInput } from './access-sheet-pdf';

/**
 * exercise-handout: Inhalt des Übungsblatts (design D5). Cover page with the programme and the total time, then the
 * sheet of every prescribed exercise with the prescription in the fields of the paper sheet. Missing media never
 * stop the PDF: the page then shows the texts, or "Blatt nicht verfügbar".
 */

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.45,
    color: INK,
    paddingTop: 36,
    paddingBottom: 50,
    paddingHorizontal: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 1.5,
    borderBottomColor: GOLD,
    paddingBottom: 8,
    marginBottom: 14,
  },
  mark: { fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 },
  dot: { color: GOLD },
  muted: { color: MID },
  title: { fontSize: 15, fontWeight: 700, marginBottom: 4 },
  table: { marginTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  tr: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.75, borderBottomColor: BORDER, minHeight: 40 },
  th: { fontSize: 7.5, color: MID, fontWeight: 600, textTransform: 'uppercase', paddingVertical: 4 },
  cImg: { width: 56, paddingVertical: 4 },
  cName: { flex: 1, paddingRight: 6 },
  cRep: { width: 92 },
  cNum: { width: 52 },
  cDur: { width: 60, textAlign: 'right' },
  thumb: { width: 48, height: 36, objectFit: 'cover', borderRadius: 2 },
  thumbMissing: {
    width: 48,
    height: 36,
    borderWidth: 0.75,
    borderColor: BORDER,
    justifyContent: 'center',
    padding: 2,
  },
  thumbMissingText: { fontSize: 6, lineHeight: 1.2, color: MID, textAlign: 'center' },
  total: { marginTop: 12, fontWeight: 600, fontSize: 10.5 },
  safety: { marginTop: 14, backgroundColor: '#FDF3D8', color: '#7A5500', padding: 8, borderRadius: 3 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 8 },
  field: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  fieldValue: { color: '#C0262D', fontWeight: 700, marginLeft: 4 },
  sheet: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start' },
  sheetImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  h: { fontSize: 10.5, fontWeight: 600, marginTop: 8, marginBottom: 2 },
  missing: { marginTop: 30, textAlign: 'center', color: MID },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: MID,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 5,
  },
});

export type HandoutItem = {
  code: string;
  name: string;
  repetition: Repetition;
  intensity: number | null;
  steps: number | null;
  note: string | null;
  /** Duration of one execution; stretchMissing: only the rolling is counted */
  seconds: number;
  stretchMissing: boolean;
  timingMissing: boolean;
  mainImage: Buffer | null;
  sheetImage: Buffer | null;
  content: SheetContent | null;
};

export interface HandoutPdfInput {
  language: Language;
  documentNumber: string;
  version: number;
  createdAt: Date;
  patient: { firstName: string; lastName: string; dateOfBirth: Date };
  consultationAt: Date;
  therapist: string;
  items: HandoutItem[];
  total: { weekMinutes: number; dayMinutes: number; incomplete: string[] };
  /**
   * Printed copy with the link to the patient zone (iteration 4, design D4): the access sheet as last page with its QR
   * code (PNG data URL). Never set for the archived PDF.
   */
  accessSheet?: AccessSheetInput & { qr: string };
}

/** react-pdf reads PNG and JPEG; anything else counts as missing */
function imageSource(data: Buffer | null) {
  if (!data || data.length < 4) return null;
  if (data[0] === 0x89 && data[1] === 0x50) return { data, format: 'png' as const };
  if (data[0] === 0xff && data[1] === 0xd8) return { data, format: 'jpg' as const };
  return null;
}

export function HandoutPdf({ input }: { input: HandoutPdfInput }) {
  const t = translator(input.language, 'handoutPdf');
  const th = translator(input.language, 'home');
  const name = `${input.patient.firstName} ${input.patient.lastName}`;
  const min = (m: number) => formatMinutes(m, input.language);
  const rep = (r: Repetition) => {
    const { daily, times } = repetitionParts(r);
    return th(daily ? 'repDaily' : 'repWeekly', { n: times });
  };
  const header = (
    <View style={s.header} fixed>
      <View>
        <Text style={s.mark}>
          ayanta<Text style={s.dot}>.</Text>
        </Text>
        <Text style={s.muted}>{config.practiceAddress}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.muted}>{input.documentNumber}</Text>
        <Text style={s.muted}>
          {formatDateZurich(input.createdAt)} · {t('version', { version: input.version })}
        </Text>
      </View>
    </View>
  );
  const footer = (
    <View style={s.footer} fixed>
      <Text
        render={({ pageNumber, totalPages }) =>
          t('footer', { number: input.documentNumber, page: pageNumber, pages: totalPages })
        }
      />
      <Text>{name}</Text>
    </View>
  );
  return (
    <Document
      title={`${t('title')} – ${name}`}
      author="Ayanta"
      subject={input.documentNumber}
      language={input.language}
    >
      <Page size="A4" style={s.page}>
        {header}
        <Text style={s.title}>{t('title')}</Text>
        <Text>
          {t('intro', {
            name,
            dob: formatDate(input.patient.dateOfBirth),
            date: formatDateZurich(input.consultationAt),
            therapist: input.therapist,
          })}
        </Text>
        <View style={s.table}>
          <View style={s.tr}>
            <Text style={[s.th, s.cImg]} />
            <Text style={[s.th, s.cName]}>{t('colExercise')}</Text>
            <Text style={[s.th, s.cRep]}>{t('colRepetition')}</Text>
            <Text style={[s.th, s.cNum]}>{t('colIntensity')}</Text>
            <Text style={[s.th, s.cNum]}>{t('colSteps')}</Text>
            <Text style={[s.th, s.cDur]}>{t('colDuration')}</Text>
          </View>
          {input.items.map((it) => {
            const img = imageSource(it.mainImage);
            return (
              <View style={s.tr} key={it.code} wrap={false}>
                <View style={s.cImg}>
                  {img ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf image, no alt attribute
                    <Image style={s.thumb} src={img} />
                  ) : (
                    <View style={s.thumbMissing}>
                      <Text style={s.thumbMissingText}>{t('imageMissing')}</Text>
                    </View>
                  )}
                </View>
                <View style={s.cName}>
                  <Text>
                    <Text style={{ fontWeight: 700 }}>{it.code}</Text> {it.name}
                  </Text>
                  {it.note ? <Text style={s.muted}>{it.note}</Text> : null}
                </View>
                <Text style={s.cRep}>{rep(it.repetition)}</Text>
                <Text style={s.cNum}>{it.intensity ?? '–'}</Text>
                <Text style={s.cNum}>{stepsLabel(it.steps) ?? '–'}</Text>
                <Text style={s.cDur}>
                  {it.timingMissing ? '–' : min(it.seconds / 60)}
                  {it.stretchMissing && !it.timingMissing ? ' *' : ''}
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={s.total}>
          {t('total', { day: min(input.total.dayMinutes), week: min(input.total.weekMinutes) })}
        </Text>
        {input.total.incomplete.length ? (
          <Text style={s.muted}>* {t('incomplete', { codes: input.total.incomplete.join(', ') })}</Text>
        ) : null}
        <Text style={s.safety}>{t('safety')}</Text>
        {footer}
      </Page>
      {input.items.map((it) => {
        const fields = sheetFields(it.repetition);
        const sheet = imageSource(it.sheetImage);
        return (
          <Page size="A4" style={s.page} key={it.code}>
            {header}
            <Text style={[s.title, { fontSize: 13 }]}>
              {it.code} {it.name}
            </Text>
            <View style={s.fields}>
              {(
                [
                  [t('fieldPerWeek'), String(fields.perWeek)],
                  [t('fieldDaily'), t('times', { n: fields.perDay })],
                  [t('fieldIntensity'), it.intensity ? String(it.intensity) : '–'],
                  [t('fieldSteps'), stepsLabel(it.steps) ?? '–'],
                ] as [string, string][]
              ).map(([k, v]) => (
                <View style={s.field} key={k}>
                  <Text>{k}</Text>
                  <Text style={s.fieldValue}>{v}</Text>
                </View>
              ))}
            </View>
            {it.note ? <Text style={[s.muted, { marginBottom: 6 }]}>{it.note}</Text> : null}
            {sheet ? (
              <View style={s.sheet}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf image, no alt attribute */}
                <Image style={s.sheetImg} src={sheet} />
              </View>
            ) : it.content ? (
              <View>
                {it.content.rolling ? (
                  <>
                    <Text style={s.h}>{t('rolling')}</Text>
                    <Text>{it.content.rolling}</Text>
                  </>
                ) : null}
                {it.content.steps.length ? (
                  <>
                    <Text style={s.h}>{t('stretch')}</Text>
                    {it.content.steps.map((st, i) => (
                      <Text key={i} style={{ marginBottom: 3 }}>
                        {st.label ? <Text style={{ fontWeight: 600 }}>{st.label}: </Text> : null}
                        {st.text}
                      </Text>
                    ))}
                  </>
                ) : null}
                {it.content.variants ? (
                  <>
                    <Text style={s.h}>{t('variants')}</Text>
                    <Text>{it.content.variants}</Text>
                  </>
                ) : null}
              </View>
            ) : (
              <Text style={s.missing}>{t('sheetMissing')}</Text>
            )}
            {footer}
          </Page>
        );
      })}
      {input.accessSheet ? <AccessSheetPage input={input.accessSheet} qr={input.accessSheet.qr} /> : null}
    </Document>
  );
}

export async function renderHandoutPdf(input: HandoutPdfInput): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<HandoutPdf input={input} />);
}
