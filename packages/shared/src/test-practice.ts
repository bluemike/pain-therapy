/**
 * The practice of the test database (iteration 12): the database default of app.practice_id, set by the global setup,
 * so every test connection works in it; recreated after each TRUNCATE.
 */
export const TEST_PRACTICE_ID = 'prc_test';

export const TEST_PRACTICE_SQL = `INSERT INTO "Practice" ("id", "slug", "name", "addressLine", "defaultPlace", "contactEmail", "updatedAt") VALUES ('prc_test', 'test', 'Pain Therapy Test', 'Pain Therapy | Via Prau da Cuort 5 | 7153 Falera', 'Falera', 'praxis@example.test', now()) ON CONFLICT DO NOTHING`;
