import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import type { Language } from '@prisma/client';
import { config } from './config';
import { formatDateZurich } from './format';
import { translator } from './i18n-server';
import { BORDER, GOLD, INK, MID, registerFonts } from './pdf';

/**
 * patient-access: Zugangsblatt (iteration 4, design D4). One page with QR code, address and a short guide. Rendered on
 * demand and never stored, so the token exists nowhere in plain text; the archived exercise sheet has no link.
 */

const s = StyleSheet.create({
  page: { fontFamily: 'Inter', fontSize: 10.5, lineHeight: 1.45, color: INK, padding: 48 },
  header: { borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 8, marginBottom: 22 },
  mark: { fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginBottom: 2 },
  dot: { color: GOLD },
  muted: { color: MID },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 6 },
  qrBox: { alignItems: 'center', marginVertical: 22 },
  qr: { width: 190, height: 190 },
  url: { fontSize: 9, color: MID, marginTop: 8, textAlign: 'center' },
  step: { flexDirection: 'row', marginBottom: 8 },
  n: { width: 22, fontWeight: 700, color: GOLD },
  box: { marginTop: 18, borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 10 },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, fontSize: 8, color: MID },
});

export interface AccessSheetInput {
  language: Language;
  patient: { firstName: string; lastName: string };
  url: string;
  expiresAt: Date;
  /** Invitation to sign (iteration 5): other intro, third step and validity */
  purpose?: 'EXERCISES' | 'SIGNATURE';
}

/** QR code of the link as PNG data URL (error correction M, quiet zone of one module) */
export async function qrPng(url: string) {
  return QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 380 });
}

/** QR code of the link as SVG markup, for the screen in the practice */
export async function qrSvg(url: string) {
  return QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
}

export function AccessSheetPage({ input, qr }: { input: AccessSheetInput; qr: string }) {
  const t = translator(input.language, 'accessSheet');
  const sign = input.purpose === 'SIGNATURE';
  return (
    <Page size="A4" style={s.page}>
      <View style={s.header}>
        <Text style={s.mark}>
          ayanta<Text style={s.dot}>.</Text>
        </Text>
        <Text style={s.muted}>{config.practiceAddress}</Text>
      </View>
      <Text style={s.title}>{t('title')}</Text>
      <Text>{t(sign ? 'introSign' : 'intro', { name: `${input.patient.firstName} ${input.patient.lastName}` })}</Text>
      <View style={s.qrBox}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf image, no alt attribute */}
        <Image src={qr} style={s.qr} />
        <Text style={s.url}>{input.url}</Text>
      </View>
      {[t('step1'), t('step2'), t(sign ? 'step3Sign' : 'step3')].map((text, i) => (
        <View style={s.step} key={i}>
          <Text style={s.n}>{i + 1}.</Text>
          <Text style={{ flex: 1 }}>{text}</Text>
        </View>
      ))}
      <View style={s.box}>
        <Text>{t(sign ? 'validitySign' : 'validity', { date: formatDateZurich(input.expiresAt) })}</Text>
        <Text style={s.muted}>{t('keep')}</Text>
      </View>
      <Text style={s.footer}>{t('footer')}</Text>
    </Page>
  );
}

export async function renderAccessSheetPdf(input: AccessSheetInput): Promise<Buffer> {
  registerFonts();
  const qr = await qrPng(input.url);
  const t = translator(input.language, 'accessSheet');
  return renderToBuffer(
    <Document title={t('title')} author="Ayanta" language={input.language}>
      <AccessSheetPage input={input} qr={qr} />
    </Document>,
  );
}
