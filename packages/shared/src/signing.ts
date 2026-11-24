import type { Prisma, PrismaClient, SignatureChannel } from '@prisma/client';
import { z } from 'zod';
import { signatureSvg } from './signature';

/**
 * consent-signing and zone-consent-signing: the signature itself, shared by the iPad (practice app) and the patient
 * zone (iteration 5, design D2, D7, D10). Every query selects only columns the role patient_zone may read
 * (prisma/patient-zone-role.sql), and inserts go without RETURNING (createMany).
 */

export const signingSchema = z.object({
  note: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => (v === '' ? null : v)),
  place: z.string().trim().min(1).max(100),
  readToEnd: z.literal(true),
  liability: z.literal(true),
  dataProcessing: z.literal(true),
  unencryptedEmail: z.boolean(),
  strokes: z
    .array(
      z
        .array(z.tuple([z.number(), z.number(), z.number()]))
        .min(1)
        .max(5000),
    )
    .min(1)
    .max(200),
  width: z.number().positive().max(4000),
  height: z.number().positive().max(4000),
});
export type SigningInput = z.infer<typeof signingSchema>;

/**
 * Verlangte Version (iteration 18, design D1): who never signed needs the current version. Who signed needs the
 * newest version published with «Sofort von allen» (resignRequired) or the version the practice asked for at a new
 * treatment or session (Patient.signatureRequiredVersion), whichever is higher.
 */
export function requiredVersionOf(
  latestSignedVersion: number | null | undefined,
  currentVersion: number,
  mandatoryVersion: number | null | undefined,
  requestedVersion: number | null | undefined,
): number {
  if (!latestSignedVersion) return currentVersion;
  return Math.min(currentVersion, Math.max(mandatoryVersion ?? 0, requestedVersion ?? 0));
}

/**
 * Ausstehende Unterschrift (design D2): no signature yet, or the latest one is of an older text version than the
 * required one (iteration 18: by default the current one). Without any published text (version 0) nothing can be
 * signed, so nothing is pending.
 */
export function signaturePending(
  latestSignedVersion: number | null | undefined,
  currentVersion: number,
  requiredVersion: number = currentVersion,
): boolean {
  if (currentVersion <= 0) return false;
  return !latestSignedVersion || latestSignedVersion < requiredVersion;
}

type Reader = Pick<PrismaClient, 'signatureSession' | 'consentTextVersion' | 'patient'>;

/** Text version of the patient's most recent completed signature, from the session, not the PDF (design D2) */
export async function latestSignedVersion(db: Pick<PrismaClient, 'signatureSession'>, patientId: string) {
  const s = await db.signatureSession.findFirst({
    where: { patientId, status: 'SIGNED' },
    orderBy: { completedAt: 'desc' },
    select: { textVersion: { select: { version: true } } },
  });
  return s?.textVersion.version ?? null;
}

/** Version number of the current text; both languages are published under one number */
export async function currentConsentVersion(db: Pick<PrismaClient, 'consentTextVersion'>): Promise<number> {
  const v = await db.consentTextVersion.aggregate({ _max: { version: true } });
  return v._max.version ?? 0;
}

/** Newest version published with «Sofort von allen» (iteration 18, design D1); 0 if none */
export async function mandatoryConsentVersion(db: Pick<PrismaClient, 'consentTextVersion'>): Promise<number> {
  const v = await db.consentTextVersion.aggregate({ where: { resignRequired: true }, _max: { version: true } });
  return v._max.version ?? 0;
}

export async function signatureStateOf(db: Reader, patientId: string) {
  const [latest, current, mandatory, patient] = await Promise.all([
    latestSignedVersion(db, patientId),
    currentConsentVersion(db),
    mandatoryConsentVersion(db),
    db.patient.findUnique({ where: { id: patientId }, select: { signatureRequiredVersion: true } }),
  ]);
  const required = requiredVersionOf(latest, current, mandatory, patient?.signatureRequiredVersion);
  return {
    latestSignedVersion: latest,
    currentVersion: current,
    requiredVersion: required,
    pending: signaturePending(latest, current, required),
  };
}

const ZONE_PLACE = { de: 'Online (Patienten-Zone)', en: 'Online (patient zone)' } as const;
/** Place written for a signature in the patient zone (design D6) */
export const zonePlace = (language: 'de' | 'en') => ZONE_PLACE[language];

export class SignatureRecordError extends Error {
  constructor(public code: 'notFound' | 'notOpen' | 'outdated') {
    super(code);
  }
}

/**
 * Abschluss der Unterschrift, step 1 of 2 (design D7): stores signature, consents, remark, place and time in one
 * transaction and logs "signing.completed". The PDF follows in finalizeSignature() of the practice app.
 *
 * `updateMany` on status OPEN makes a second submit fail with `notOpen`, so a double tap gives exactly one
 * signature. With `zoneSessionId` the session must belong to that device session (the zone writes only for the
 * patient it confirmed); with `requireCurrentVersion` a session of an older text is refused with `outdated`.
 */
export async function recordSignature(
  db: PrismaClient,
  args: {
    sid: string;
    input: SigningInput;
    actor: { id: string; name: string };
    patientId?: string;
    zoneSessionId?: string;
    requireCurrentVersion?: boolean;
    now?: Date;
  },
): Promise<{ patientId: string; version: number; channel: SignatureChannel; signedAt: Date }> {
  const { sid, input } = args;
  const signedAt = args.now ?? new Date();
  const { svg } = signatureSvg(input.strokes, input.width, input.height);
  return db.$transaction(async (tx) => {
    const s = await tx.signatureSession.findUnique({
      where: { id: sid },
      select: {
        patientId: true,
        status: true,
        channel: true,
        zoneSessionId: true,
        textVersion: { select: { version: true } },
      },
    });
    if (!s) throw new SignatureRecordError('notFound');
    if (args.patientId && s.patientId !== args.patientId) throw new SignatureRecordError('notFound');
    if (args.zoneSessionId && s.zoneSessionId !== args.zoneSessionId) throw new SignatureRecordError('notFound');
    if (s.status !== 'OPEN') throw new SignatureRecordError('notOpen');
    if (args.requireCurrentVersion && s.textVersion.version < (await currentConsentVersion(tx)))
      throw new SignatureRecordError('outdated');
    const updated = await tx.signatureSession.updateMany({
      where: { id: sid, status: 'OPEN' },
      data: {
        status: 'SIGNED',
        completedAt: signedAt,
        patientNote: input.note,
        place: input.place,
        signaturePoints: input.strokes as Prisma.InputJsonValue,
        signatureSvg: svg,
      },
    });
    if (updated.count !== 1) throw new SignatureRecordError('notOpen');
    await tx.consent.createMany({
      data: [
        { sessionId: sid, kind: 'LIABILITY_WAIVER', granted: true },
        { sessionId: sid, kind: 'DATA_PROCESSING', granted: true },
        { sessionId: sid, kind: 'UNENCRYPTED_EMAIL', granted: input.unencryptedEmail },
      ],
    });
    await tx.auditEvent.createMany({
      data: [
        {
          userId: args.actor.id,
          userName: args.actor.name,
          action: 'signing.completed',
          patientId: s.patientId,
          details: {
            sessionId: sid,
            version: s.textVersion.version,
            unencryptedEmail: input.unencryptedEmail,
            channel: s.channel,
          },
        },
      ],
    });
    return { patientId: s.patientId, version: s.textVersion.version, channel: s.channel, signedAt };
  });
}

/** Width and height of a stored signature, from the viewBox that signatureSvg() wrote */
export function signatureSize(svg: string | null | undefined): { width: number; height: number } {
  const m = svg?.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 600, height: 220 };
}
