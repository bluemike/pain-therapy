-- Iteration 12, phase 3 (design D5): logo in the database instead of a blob (small, read by app, zone and PDFs),
-- own privacy notice of the zone per practice.
ALTER TABLE "Practice" DROP COLUMN "logoPath",
ADD COLUMN "logo" BYTEA,
ADD COLUMN "logoType" TEXT,
ADD COLUMN "privacyNotice" TEXT;

-- Falera with its address in fields, so the page «Praxis» keeps it when saving
UPDATE "Practice" SET "street" = 'Via Prau da Cuort 5', "zip" = '7153', "city" = 'Falera'
WHERE "id" = 'prc_falera' AND "street" IS NULL;
