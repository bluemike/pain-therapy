import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { Language } from '@prisma/client';
import { config } from './config';
import { formatDate, formatDateZurich } from './format';
import { formatMinutes, scheduleText } from './home-program';
import { translator } from './i18n-server';
import { BORDER, GOLD, INK, MID, registerFonts } from './pdf';
import type { SheetContent, SheetSegments } from './exercise-sheets';
import { AccessSheetPage, type AccessSheetInput } from './access-sheet-pdf';

/**
 * exercise-handout: Inhalt des Übungsblatts (design D5). Cover page with the programme and the total time, then one
 * page per prescribed exercise. Since iteration 8 (design D7) the page shows the FRM band with its text and tools and
 * the band of the chosen EPD (Standardübung with its steps, or the variant band with the chosen variant
 * highlighted), executions per day, weekdays and note. Missing media never stop the PDF: without bands the page
 * shows the whole sheet, the texts, or "Blatt nicht verfügbar".
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
  cRep: { width: 70 },
  cDays: { width: 100 },
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
  band: { maxWidth: '100%', maxHeight: 210, objectFit: 'contain', marginVertical: 4 },
  chosen: { backgroundColor: '#FDF3D8', fontWeight: 600 },
  item: { marginBottom: 3 },
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
  /** EPD: null = Standardübung, otherwise the variant */
  variant: number | null;
  timesPerDay: number;
  weekdays: number;
  note: string | null;
  /** Duration of one execution; stretchMissing: only the rolling is counted */
  seconds: number;
  stretchMissing: boolean;
  timingMissing: boolean;
  /** FRM tools and aids of the chosen EPD */
  tools: string[];
  aids: string[];
  mainImage: Buffer | null;
  sheetImage: Buffer | null;
  frmImage: Buffer | null;
  epdImage: Buffer | null;
  segments: SheetSegments | null;
  /** Texts of iteration 3, shown while the segments are not uploaded */
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
  const epd = (v: number | null) => (v ? t('epdVariant', { n: v }) : t('epdStandard'));
  // "1× pro Tag · Mo Di Mi" → the weekdays part
  const days = (it: HandoutItem) =>
    scheduleText({ timesPerDay: it.timesPerDay, weekdays: it.weekdays }, th).split(' · ')[1] ?? '';
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
            <Text style={[s.th, s.cRep]}>{t('colPerDay')}</Text>
            <Text style={[s.th, s.cDays]}>{t('colWeekdays')}</Text>
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
                  <Text style={s.muted}>{t('parts', { epd: epd(it.variant) })}</Text>
                  {it.note ? <Text style={s.muted}>{it.note}</Text> : null}
                </View>
                <Text style={s.cRep}>{th('timesPerDayN', { n: it.timesPerDay })}</Text>
                <Text style={s.cDays}>{days(it)}</Text>
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
        const sheet = imageSource(it.sheetImage);
        const frm = imageSource(it.frmImage);
        const band = imageSource(it.epdImage);
        const seg = it.segments;
        const parts = !!(frm || band || seg);
        return (
          <Page size="A4" style={s.page} key={it.code}>
            {header}
            <Text style={[s.title, { fontSize: 13 }]}>
              {it.code} {it.name}
            </Text>
            <View style={s.fields}>
              {(
                [
                  [t('fieldPerDay'), th('timesPerDayN', { n: it.timesPerDay })],
                  [t('fieldWeekdays'), days(it)],
                  [t('fieldEpd'), epd(it.variant)],
                ] as [string, string][]
              ).map(([k, v]) => (
                <View style={s.field} key={k}>
                  <Text>{k}</Text>
                  <Text style={s.fieldValue}>{v}</Text>
                </View>
              ))}
            </View>
            {it.note ? <Text style={[s.muted, { marginBottom: 6 }]}>{it.note}</Text> : null}
            {parts ? (
              <View>
                <Text style={s.h}>
                  {t('rolling')}
                  {it.tools.length ? ` · ${it.tools.join(', ')}` : ''}
                </Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf image, no alt attribute */}
                {frm ? <Image style={s.band} src={frm} /> : null}
                {seg?.frm.items.map((x, i) => (
                  <Text key={i} style={s.item}>
                    {x.n.length ? <Text style={{ fontWeight: 600 }}>({x.n.join('/')}) </Text> : null}
                    {x.text}
                  </Text>
                ))}
                <Text style={s.h} break={!!frm && !!band}>
                  {t('stretch')} · {epd(it.variant)}
                  {it.aids.length ? ` · ${it.aids.join(', ')}` : ''}
                </Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf image, no alt attribute */}
                {band ? <Image style={s.band} src={band} /> : null}
                {seg && !it.variant ? (
                  <>
                    {seg.standard.intro ? <Text style={s.item}>{seg.standard.intro}</Text> : null}
                    {seg.standard.steps.map((st, i) => (
                      <Text key={i} style={s.item}>
                        {st.label ? <Text style={{ fontWeight: 600 }}>{st.label}: </Text> : null}
                        {st.text}
                      </Text>
                    ))}
                    {seg.standard.note ? <Text style={s.muted}>{seg.standard.note}</Text> : null}
                  </>
                ) : null}
                {seg && it.variant ? (
                  <>
                    {seg.variants.intro ? <Text style={s.item}>{seg.variants.intro}</Text> : null}
                    {seg.variants.items.map((v) => (
                      <Text key={v.number} style={v.number === it.variant ? [s.item, s.chosen] : [s.item, s.muted]}>
                        <Text style={{ fontWeight: 600 }}>{t('epdVariant', { n: v.number })}: </Text>
                        {v.text}
                      </Text>
                    ))}
                  </>
                ) : null}
              </View>
            ) : sheet ? (
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
                      <Text key={i} style={s.item}>
                        {st.label ? <Text style={{ fontWeight: 600 }}>{st.label}: </Text> : null}
                        {st.text}
                      </Text>
                    ))}
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
