import { PrismaClient } from '@prisma/client';
import { inject } from 'vitest';
import { linkExpiry } from '@pain-therapy/shared/access';
import type { Repetition } from '@pain-therapy/shared/home-program';
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
  await admin.region.create({ data: { id: 6, nameDe: 'Lendenwirbelsäule', nameEn: 'Lumbar spine', sheetTitle: 'x' } });
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

/** A consultation (in a new treatment unless given) with the given prescriptions */
export async function consultation(patientId: string, at: Date, home: [string, Repetition][], treatmentId?: string) {
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
        create: home.map(([exerciseCode, repetition]) => ({ exerciseCode, repetition, note: 'Notiz Therapeutin' })),
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

/** Patient with 2A täglich 2x, 2D wöchentlich 5x and 1F täglich 1x from 10 days ago, and a link */
export async function setup(opts: { language?: 'de' | 'en'; at?: Date } = {}) {
  const p = await patient(opts);
  const c = await consultation(p.id, opts.at ?? ago(10), [
    ['2A', 'DAILY_2'],
    ['2D', 'WEEKLY_5'],
    ['1F', 'DAILY_1'],
  ]);
  const l = await link(p.id);
  return { patient: p, consultation: c, ...l };
}

export const DOB = { day: '05', month: '03', year: '1980' };
