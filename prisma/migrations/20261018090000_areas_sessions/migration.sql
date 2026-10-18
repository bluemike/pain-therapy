-- Iteration 8 (openspec/changes/iteration-8-bereiche-sitzungen, design D11): Bereiche, Sitzungen, Verordnung mit FRM
-- und EPD. The practice deletes the patient data before this deployment; columns of the consultation form are
-- dropped without carrying values over, so the migration refuses to run while treatments exist.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Treatment") THEN
    RAISE EXCEPTION 'Iteration 8: patient data must be deleted before this migration (design D11)';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "ProfessionalTitle" AS ENUM ('THERAPIST_F', 'THERAPIST_M');
CREATE TYPE "Side" AS ENUM ('UNSPECIFIED', 'LEFT', 'RIGHT');

-- Bereiche (design D1); catalog:sync keeps the names in step with prisma/catalog/body-areas.json
CREATE TABLE "BodyArea" (
    "id" INTEGER NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "BodyArea_pkey" PRIMARY KEY ("id")
);
INSERT INTO "BodyArea" ("id", "nameDe", "nameEn") VALUES
  (1, 'Kopf', 'Head'),
  (2, 'Rumpf', 'Trunk'),
  (3, 'Schulter/Arm', 'Shoulder/arm'),
  (4, 'Becken/Beine', 'Pelvis/legs');

-- Schmerzbereiche 1.1 to 4.3: the 12 sheets in order, three per Bereich
ALTER TABLE "Region" ADD COLUMN "bodyAreaId" INTEGER, ADD COLUMN "code" TEXT;
UPDATE "Region" SET "bodyAreaId" = ("id" + 2) / 3, "code" = (("id" + 2) / 3)::text || '.' || ((("id" - 1) % 3) + 1)::text;
ALTER TABLE "Region" ALTER COLUMN "bodyAreaId" SET NOT NULL, ALTER COLUMN "code" SET NOT NULL;

-- The consultation form (design D3, D6, D7)
DROP TABLE "ConsultationRolling";
ALTER TABLE "ConsultationExercise" DROP COLUMN "variants", ADD COLUMN "variant" INTEGER;
ALTER TABLE "HomePrescription" DROP COLUMN "intensity",
DROP COLUMN "repetition",
DROP COLUMN "steps",
ADD COLUMN     "timesPerDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "variant" INTEGER,
ADD COLUMN     "weekdays" INTEGER NOT NULL DEFAULT 127;
DROP TYPE "Repetition";
ALTER TABLE "HomePrescription" ADD CONSTRAINT "HomePrescription_timesPerDay_check" CHECK ("timesPerDay" BETWEEN 1 AND 3),
ADD CONSTRAINT "HomePrescription_weekdays_check" CHECK ("weekdays" BETWEEN 1 AND 127);

-- Körperseite (design D4)
ALTER TABLE "Treatment" ADD COLUMN "side" "Side" NOT NULL DEFAULT 'UNSPECIFIED';

-- Übungsteile (design D2)
ALTER TABLE "ExerciseSheet" ADD COLUMN     "rollingTools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "segments" JSONB,
ADD COLUMN     "standardAids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "ExerciseVariant" (
    "exerciseCode" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "images" INTEGER[],
    "aids" TEXT[],
    "seconds" INTEGER,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "ExerciseVariant_pkey" PRIMARY KEY ("exerciseCode","number")
);

-- Profil (design D9)
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "title" "ProfessionalTitle" NOT NULL DEFAULT 'THERAPIST_F';
UPDATE "User" SET "displayName" = 'Chrissie', "title" = 'THERAPIST_F' WHERE lower("email") = 'christina.franz@ayanta.ch';
UPDATE "User" SET "displayName" = 'Mike', "title" = 'THERAPIST_M' WHERE lower("email") = 'mike.franz@ayanta.ch';

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_bodyAreaId_fkey" FOREIGN KEY ("bodyAreaId") REFERENCES "BodyArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OsteopressurePoint" ADD CONSTRAINT "OsteopressurePoint_group_fkey" FOREIGN KEY ("group") REFERENCES "BodyArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_group_fkey" FOREIGN KEY ("group") REFERENCES "BodyArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExerciseVariant" ADD CONSTRAINT "ExerciseVariant_exerciseCode_fkey" FOREIGN KEY ("exerciseCode") REFERENCES "Exercise"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
