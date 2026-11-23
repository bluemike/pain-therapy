/**
 * The practice of the test database (iteration 12): the database default of app.practice_id, set by the global setup,
 * so every test connection works in it; recreated after each TRUNCATE.
 */
export const TEST_PRACTICE_ID = 'prc_test';

/**
 * Iteration 17: the table Plan survives the TRUNCATE (it holds the seed of the migration), so this statement also puts
 * the two plans back as the migration made them and drops plans a test added.
 */
export const TEST_PRACTICE_SQL = `WITH dropped AS (DELETE FROM "Plan" WHERE "id" NOT IN ('freemium', 'unlimited')), seeded AS (INSERT INTO "Plan" ("id", "name", "patientLimit", "sortOrder") VALUES ('freemium', 'Freemium', 20, 10), ('unlimited', 'Unlimited', NULL, 20) ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "patientLimit" = EXCLUDED."patientLimit", "sortOrder" = EXCLUDED."sortOrder", "active" = true) INSERT INTO "Practice" ("id", "slug", "name", "addressLine", "defaultPlace", "contactEmail", "updatedAt") VALUES ('prc_test', 'test', 'Pain Therapy Test', 'Pain Therapy | Via Prau da Cuort 5 | 7153 Falera', 'Falera', 'praxis@example.test', now()) ON CONFLICT DO NOTHING`;
