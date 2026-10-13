import path from 'node:path';
import React from 'react';
import { Document, Font, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { Language } from '@prisma/client';
import { config } from './config';
import { parseBlocks } from './consent-texts';
import { formatDate } from './format';
import { translator } from './i18n-server';

/** consent-documents: PDF of the signed form, in the patient's language (design D7). */

const fontDir = path.join(process.cwd(), 'assets', 'fonts');
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: 'Inter',
    fonts: [
      { src: path.join(fontDir, 'inter-latin-400-normal.woff'), fontWeight: 400 },
      { src: path.join(fontDir, 'inter-latin-600-normal.woff'), fontWeight: 600 },
      { src: path.join(fontDir, 'inter-latin-700-normal.woff'), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const GOLD = '#B99438';
const INK = '#1C1A14';
const MID = '#5C5040';
const BORDER = '#E2D9C4';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Inter',
    fontSize: 9.5,
    lineHeight: 1.5,
    color: INK,
    paddingTop: 42,
    paddingBottom: 56,
    paddingHorizontal: 50,
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
  mark: { fontSize: 18, fontWeight: 700 },
  dot: { color: GOLD },
  muted: { color: MID },
  title: { fontSize: 14, fontWeight: 700, marginBottom: 10 },
  box: { borderWidth: 1, borderColor: BORDER, borderRadius: 3, padding: 8, marginBottom: 12 },
  row: { flexDirection: 'row', marginBottom: 1.5 },
  label: { width: '34%', color: MID },
  value: { width: '66%' },
  h: { fontSize: 10.5, fontWeight: 600, marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 5 },
  li: { flexDirection: 'row', marginBottom: 2, paddingLeft: 4 },
  bullet: { width: 10 },
  consent: { flexDirection: 'row', marginBottom: 3 },
  check: { width: 14, fontWeight: 700 },
  sigRow: { flexDirection: 'row', gap: 24, marginTop: 14 },
  sigCol: { flex: 1 },
  sigLine: { height: 70, borderBottomWidth: 1, borderBottomColor: INK, justifyContent: 'flex-end' },
  footer: {
    position: 'absolute',
    bottom: 26,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: MID,
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 5,
  },
});

export interface PdfInput {
  language: Language;
  documentNumber: string;
  textVersion: number;
  title: string;
  body: string;
  patient: {
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    phone?: string | null;
    mobile?: string | null;
    email?: string | null;
    insurer?: string | null;
    insuranceNumber?: string | null;
  };
  consents: { liability: boolean; dataProcessing: boolean; unencryptedEmail: boolean };
  note: string | null;
  place: string;
  signedAtText: string;
  signature: { paths: string[]; width: number; height: number };
}

export function SignedFormPdf({ input }: { input: PdfInput }) {
  const t = translator(input.language, 'pdf');
  const ts = translator(input.language, 'signing');
  const p = input.patient;
  const name = `${p.firstName} ${p.lastName}`;
  const details: [string, string][] = [
    [ts('name'), name],
    [ts('dateOfBirth'), formatDate(p.dateOfBirth)],
    [ts('address'), [p.street, [p.zip, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || '–'],
    [ts('phone'), [p.phone, p.mobile].filter(Boolean).join(' · ') || '–'],
    [ts('email'), p.email || '–'],
    [ts('insurance'), [p.insurer, p.insuranceNumber].filter(Boolean).join(' · ') || '–'],
  ];
  const consents: [string, boolean][] = [
    [ts('consentLiability'), input.consents.liability],
    [ts('consentData'), input.consents.dataProcessing],
    [ts('consentEmail'), input.consents.unencryptedEmail],
  ];
  const sigW = 220;
  const sigH = Math.min(66, (sigW * input.signature.height) / input.signature.width);
  return (
    <Document
      title={`${input.title} – ${name}`}
      author="Ayanta"
      subject={input.documentNumber}
      language={input.language}
    >
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.mark}>
              ayanta<Text style={s.dot}>.</Text>
            </Text>
            <Text style={s.muted}>{t('practice')}</Text>
            <Text style={s.muted}>{config.practiceAddress}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.muted}>{t('version', { version: input.textVersion })}</Text>
            <Text style={s.muted}>{input.documentNumber}</Text>
          </View>
        </View>
        <Text style={s.title}>{input.title}</Text>
        <View style={s.box}>
          {details.map(([k, v]) => (
            <View style={s.row} key={k}>
              <Text style={s.label}>{k}</Text>
              <Text style={s.value}>{v}</Text>
            </View>
          ))}
        </View>
        {parseBlocks(input.body).map((b, i) =>
          b.type === 'h' ? (
            <Text style={s.h} key={i} minPresenceAhead={40}>
              {b.text}
            </Text>
          ) : b.type === 'p' ? (
            <Text style={s.p} key={i}>
              {b.text}
            </Text>
          ) : (
            <View key={i} style={{ marginBottom: 5 }}>
              {b.items.map((it, j) => (
                <View style={s.li} key={j}>
                  <Text style={s.bullet}>•</Text>
                  <Text style={{ flex: 1 }}>{it}</Text>
                </View>
              ))}
            </View>
          ),
        )}
        <View wrap={false}>
          <Text style={s.h}>{t('consents')}</Text>
          {consents.map(([label, ok]) => (
            <View style={s.consent} key={label}>
              <Text style={s.check}>{ok ? '[x]' : '[ ]'}</Text>
              <Text style={{ flex: 1 }}>
                {label} <Text style={s.muted}>({ok ? t('granted') : t('denied')})</Text>
              </Text>
            </View>
          ))}
          {input.note ? (
            <>
              <Text style={s.h}>{t('patientNote')}</Text>
              <Text style={s.p}>«{input.note}»</Text>
            </>
          ) : null}
          <View style={s.sigRow}>
            <View style={s.sigCol}>
              <View style={s.sigLine}>
                <Svg width={sigW} height={sigH} viewBox={`0 0 ${input.signature.width} ${input.signature.height}`}>
                  {input.signature.paths.map((d, i) => (
                    <Path key={i} d={d} fill="#1b2a5c" />
                  ))}
                </Svg>
              </View>
              <Text style={[s.muted, { marginTop: 3 }]}>{t('signature', { name })}</Text>
            </View>
            <View style={s.sigCol}>
              <View style={s.sigLine}>
                <Text style={{ fontSize: 11, marginBottom: 4 }}>
                  {input.place}, {input.signedAtText}
                </Text>
              </View>
              <Text style={[s.muted, { marginTop: 3 }]}>{t('placeDate')}</Text>
            </View>
          </View>
        </View>
        <View style={s.footer} fixed>
          <Text
            render={({ pageNumber, totalPages }) =>
              t('footer', { number: input.documentNumber, page: pageNumber, pages: totalPages })
            }
          />
          <Text>{t('signedAt', { at: input.signedAtText })}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderSignedFormPdf(input: PdfInput): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<SignedFormPdf input={input} />);
}
