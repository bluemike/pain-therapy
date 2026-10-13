/**
 * Seeds the first form text version (task 6.1), the therapy catalog (iteration 2, same as `npm run catalog:sync`)
 * and, with SEED_DEMO=true, sample patients for local development. Safe to run repeatedly.
 */
import { PrismaClient } from '@prisma/client';
import { INITIAL_TEXTS } from '../src/lib/consent-texts';
import { syncCatalog } from './catalog/sync.mjs';

const db = new PrismaClient();

async function main() {
  if ((await db.consentTextVersion.count()) === 0) {
    await db.consentTextVersion.createMany({
      data: [
        { version: 1, language: 'de', title: INITIAL_TEXTS.de.title, body: INITIAL_TEXTS.de.body, publishedBy: 'Seed' },
        { version: 1, language: 'en', title: INITIAL_TEXTS.en.title, body: INITIAL_TEXTS.en.body, publishedBy: 'Seed' },
      ],
    });
    console.log('Form texts version 1 published');
  }
  const catalog = await syncCatalog(db);
  console.log(
    `Therapy catalog: ${Object.entries(catalog)
      .map(([table, s]) => `${table} ${s.created} new, ${s.updated} updated, ${s.retired} retired`)
      .join('; ')}`,
  );
  if (process.env.SEED_DEMO === 'true' && (await db.patient.count()) === 0) {
    const by = 'Seed';
    const demo = [
      {
        firstName: 'Anna',
        lastName: 'Müller',
        gender: 'w',
        dateOfBirth: '1980-03-05',
        preferredLanguage: 'de',
        occupation: 'Primarlehrerin',
        street: 'Dorfstrasse 12',
        zip: '7153',
        city: 'Falera',
        mobile: '079 412 56 78',
        email: 'anna.mueller@example.ch',
        insurer: 'CSS Versicherung',
        insuranceNumber: '756.1234.5678.97',
        anamnesis: { arthrosis: true, allergies: true, furtherDiagnoses: 'Bandscheibenvorfall L4/L5 (2021)' },
      },
      {
        firstName: 'Thomas',
        lastName: 'Meier',
        gender: 'm',
        dateOfBirth: '1967-11-12',
        preferredLanguage: 'de',
        occupation: 'Schreiner',
        street: 'Seefeldstrasse 81',
        zip: '8008',
        city: 'Zürich',
        mobile: '078 901 22 11',
        email: 't.meier@example.ch',
        insurer: 'Helsana',
        insuranceNumber: '756.9876.5432.10',
        anamnesis: { smoker: 'YES', smokingYears: 25, packsPerDay: 1, highBloodPressure: true },
      },
      {
        firstName: 'Sarah',
        lastName: 'Thompson',
        gender: 'w',
        dateOfBirth: '1991-07-22',
        preferredLanguage: 'en',
        occupation: 'Software engineer',
        street: 'Hottingerstrasse 5',
        zip: '8032',
        city: 'Zürich',
        mobile: '076 233 90 41',
        email: 'sarah.thompson@example.com',
        insurer: 'Swica',
        insuranceNumber: '756.5555.0101.22',
        anamnesis: { pregnancy: 'NO', furtherDiagnoses: 'Tension headaches' },
      },
      {
        firstName: 'Peter',
        lastName: 'Keller',
        gender: 'm',
        dateOfBirth: '1955-01-30',
        preferredLanguage: 'de',
        occupation: 'Pensioniert',
        street: 'Im Grund 3',
        zip: '7153',
        city: 'Falera',
        phone: '044 767 88 00',
        email: 'peter.keller@example.ch',
        insurer: 'Sanitas',
        insuranceNumber: '756.3030.2020.11',
        anamnesis: { osteoporosis: true, cardiovascular: true, diabetes: true, medication: 'Metformin' },
      },
    ] as const;
    for (const { anamnesis, dateOfBirth, ...p } of demo) {
      await db.patient.create({
        data: {
          ...p,
          dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`),
          createdBy: by,
          updatedBy: by,
          anamnesis: { create: anamnesis },
        },
      });
    }
    console.log(`${demo.length} demo patients created`);
  }
}

main().finally(() => db.$disconnect());
