-- Iteration 10 (design D3, D5): input mode per user and remark fields stored as handwriting.
CREATE TYPE "NoteInputMode" AS ENUM ('KEYBOARD', 'HANDWRITING_TEXT', 'HANDWRITING_IMAGE');

ALTER TABLE "User" ADD COLUMN "noteInputMode" "NoteInputMode" NOT NULL DEFAULT 'KEYBOARD';

ALTER TABLE "Treatment" ADD COLUMN "diagnosisInk" JSONB;
ALTER TABLE "Consultation" ADD COLUMN "diagnosisInk" JSONB;
ALTER TABLE "Consultation" ADD COLUMN "comparisonInk" JSONB;
ALTER TABLE "Anamnesis" ADD COLUMN "furtherDiagnosesInk" JSONB;
