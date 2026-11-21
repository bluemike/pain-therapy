-- Iteration 15 (design D1): Behandlungslage per Osteopressur point
CREATE TABLE "TreatmentPosition" (
    "code" TEXT NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sort" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "TreatmentPosition_pkey" PRIMARY KEY ("code")
);
CREATE TRIGGER "TreatmentPosition_no_delete" BEFORE DELETE ON "TreatmentPosition" FOR EACH ROW EXECUTE FUNCTION reject_delete();

-- Code or combination such as "BL/HSL"; each part is checked by catalog:sync
ALTER TABLE "OsteopressurePoint" ADD COLUMN "position" TEXT;

-- Iteration 15 (design D6): parts of a prescription
CREATE TYPE "ExerciseParts" AS ENUM ('FRM_EPD', 'EPD', 'FRM');
ALTER TABLE "ConsultationExercise" ADD COLUMN "parts" "ExerciseParts" NOT NULL DEFAULT 'FRM_EPD';
ALTER TABLE "HomePrescription" ADD COLUMN "parts" "ExerciseParts" NOT NULL DEFAULT 'FRM_EPD';
