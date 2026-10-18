import { PrismaClient } from '@prisma/client';
import { inject } from 'vitest';
import { linkExpiry } from '@pain-therapy/shared/access';
import { DAY_MS } from '@pain-therapy/shared/time';
import { hashToken, newToken } from '@pain-therapy/shared/tokens';

/**
 * Test data written with the test user, as the practice app would: catalog rows, a patient with a treatment, a
 * consultation with prescriptions and an access link. No L&B content, only codes and placeholder names.
 */
export const admin = new PrismaClient({ datasourceUrl: inject('adminUrl') });

export async function resetDatabase() {
  const tables = await admin.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await admin.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  for (const id of [1, 2, 3, 4])
    await admin.bodyArea.create({ data: { id, nameDe: `Bereich ${id}`, nameEn: `Area ${id}` } });
  await admin.region.create({
    data: { id: 6, code: '2.3', bodyAreaId: 2, nameDe: 'Lendenwirbelsäule', nameEn: 'Lumbar spine', sheetTitle: 'x' },
  });
  for (const [i, code] of ['1F', '2A', '2D', '4B'].entries()) {
    await admin.exercise.create({
      data: { code, group: Number(code[0]), nameDe: `Übung ${code}`, nameEn: `Exercise ${code}`, sort: i },
    });
    await admin.exerciseSheet.create({
      data: {
        exerciseCode: code,
        sheetPage: i + 1,
        title: code,
        mainImage: `${code}.jpg`,
        sheetImage: `${code}-blatt.png`,
        stepLabels: [],
        stretchSecondsPerSide: 120,
        sides: 1,
        rollingSeconds: 120,
      },
    });
  }
}

export const now = new Date('2026-10-14T10:00:00Z');
export const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY_MS - hours * 3600_000);

let n = 0;
export async function patient(opts: { language?: 'de' | 'en'; status?: 'ACTIVE' | 'INACTIVE' } = {}) {
  n++;
  return admin.patient.create({
    data: {
      firstName: 'Anna',
      lastName: `Zone${n}`,
      dateOfBirth: new Date(Date.UTC(1980, 2, 5)),
      preferredLanguage: opts.language ?? 'de',
      status: opts.status ?? 'ACTIVE',
      email: 'anna@example.ch',
      createdBy: 'Test',
      updatedBy: 'Test',
    },
  });
}

/** Weekdays Monday to Friday (bit mask, iteration 8 design D7) */
export const MO_FR = 31;
/** Prescription: exercise code, executions per day and weekdays (default: every day) */
export type Rx = [code: string, timesPerDay: number, weekdays?: number, variant?: number];

/** A session (in a new treatment unless given) with the given prescriptions */
export async function consultation(patientId: string, at: Date, home: Rx[], treatmentId?: string) {
  const t =
    treatmentId ??
    (
      await admin.treatment.create({
        data: {
          patientId,
          startedAt: at,
          regionId: 6,
          diagnosis: 'Geheime Diagnose',
          painStart: 60,
          createdBy: 'Test',
          updatedBy: 'Test',
        },
      })
    ).id;
  const count = await admin.consultation.count({ where: { treatmentId: t } });
  return admin.consultation.create({
    data: {
      treatmentId: t,
      number: count + 1,
      at,
      diagnosis: 'Geheime Diagnose',
      painBefore: 60,
      createdBy: 'Test',
      updatedBy: 'Test',
      home: {
        create: home.map(([exerciseCode, timesPerDay, weekdays = 127, variant = null]) => ({
          exerciseCode,
          timesPerDay,
          weekdays,
          variant,
          note: 'Notiz Therapeutin',
        })),
      },
    },
  });
}

/** Issues a link like the practice app (only the hash is stored) and returns the token */
export async function link(patientId: string, issuedAt = ago(1), extra: Record<string, unknown> = {}) {
  const token = newToken();
  const row = await admin.patientAccessLink.create({
    data: {
      patientId,
      tokenHash: hashToken(token),
      createdBy: 'Christina Franz',
      createdAt: issuedAt,
      expiresAt: linkExpiry(issuedAt),
      ...extra,
    },
  });
  return { token, link: row };
}

/** Patient with 2A 2× every day, 2D 1× Mo to Fr and 1F 1× every day from 10 days ago, and a link */
export async function setup(opts: { language?: 'de' | 'en'; at?: Date } = {}) {
  const p = await patient(opts);
  const c = await consultation(p.id, opts.at ?? ago(10), [
    ['2A', 2],
    ['2D', 1, MO_FR],
    ['1F', 1],
  ]);
  const l = await link(p.id);
  return { patient: p, consultation: c, ...l };
}

export const DOB = { day: '05', month: '03', year: '1980' };
