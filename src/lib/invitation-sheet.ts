import 'server-only';
import QRCode from 'qrcode';
import type { PrintedInvitation } from './auth/accounts';

/** Iteration 19 (design D3): what the printed invitation shows, with the QR code of its short link as SVG */
export type InvitationSheet = Omit<PrintedInvitation, 'expiresAt'> & { expiresAt: string; qrSvg: string };

export async function invitationSheet(p: PrintedInvitation): Promise<InvitationSheet> {
  const qrSvg = await QRCode.toString(p.shortUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
  return { ...p, expiresAt: p.expiresAt.toISOString(), qrSvg };
}
