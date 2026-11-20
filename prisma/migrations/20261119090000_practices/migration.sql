-- Iteration 12 (design D1, D5, migration plan step 1): practices. All existing rows go to "Pain Therapy Falera".
-- The column practiceId is added with the constant default 'prc_falera' so existing rows are filled without an UPDATE
-- (several tables reject updates by trigger); afterwards the default becomes the request setting app.practice_id.

-- CreateEnum
CREATE TYPE "PracticeStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PracticeRole" AS ENUM ('PRACTICE_ADMIN', 'THERAPIST');

-- CreateTable
CREATE TABLE "Practice" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PracticeStatus" NOT NULL DEFAULT 'ACTIVE',
    "addressLine" TEXT NOT NULL,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "defaultPlace" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "phone" TEXT,
    "logoPath" TEXT,
    "documentPrefix" TEXT NOT NULL DEFAULT 'PT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Practice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "roles" "PracticeRole"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Practice_slug_key" ON "Practice"("slug");

-- CreateIndex
CREATE INDEX "PracticeMembership_practiceId_idx" ON "PracticeMembership"("practiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeMembership_userId_practiceId_key" ON "PracticeMembership"("userId", "practiceId");

-- Practice of all existing data
INSERT INTO "Practice" ("id", "slug", "name", "addressLine", "street", "zip", "city", "defaultPlace", "contactEmail", "documentPrefix", "updatedAt")
VALUES ('prc_falera', 'falera', 'Pain Therapy Falera', 'Pain Therapy | Via Prau da Cuort 5 | 7153 Falera', 'Via Prau da Cuort 5', '7153', 'Falera',
        'Falera', 'christina.franz@pain-therapy.online', 'PT', CURRENT_TIMESTAMP);

-- DropIndex
DROP INDEX "ConsentTextVersion_version_language_key";

-- DropIndex
DROP INDEX "ExerciseHandout_documentNumber_key";

-- DropIndex
DROP INDEX "SignedDocument_documentNumber_key";

-- AlterTable
ALTER TABLE "AccessLinkDelivery" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "Anamnesis" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "practiceId" TEXT DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "ClinicalPhoto" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "Consent" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "ConsentTextVersion" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "ConsultationExercise" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "ConsultationPoint" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "DocumentCounter" DROP CONSTRAINT "DocumentCounter_pkey",
ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera',
ADD CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("practiceId", "year");

-- AlterTable
ALTER TABLE "EmailDelivery" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "ExerciseHandout" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "ExerciseLogEntry" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "HandoutDelivery" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "HomePrescription" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "PatientAccessLink" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "PatientZoneSession" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "SignatureSession" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "SignedDocument" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN     "practiceId" TEXT NOT NULL DEFAULT 'prc_falera';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTextVersion_practiceId_version_language_key" ON "ConsentTextVersion"("practiceId", "version", "language");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseHandout_practiceId_documentNumber_key" ON "ExerciseHandout"("practiceId", "documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SignedDocument_practiceId_documentNumber_key" ON "SignedDocument"("practiceId", "documentNumber");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anamnesis" ADD CONSTRAINT "Anamnesis_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTextVersion" ADD CONSTRAINT "ConsentTextVersion_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureSession" ADD CONSTRAINT "SignatureSession_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignedDocument" ADD CONSTRAINT "SignedDocument_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCounter" ADD CONSTRAINT "DocumentCounter_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationPoint" ADD CONSTRAINT "ConsultationPoint_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationExercise" ADD CONSTRAINT "ConsultationExercise_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePrescription" ADD CONSTRAINT "HomePrescription_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseHandout" ADD CONSTRAINT "ExerciseHandout_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoutDelivery" ADD CONSTRAINT "HandoutDelivery_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientAccessLink" ADD CONSTRAINT "PatientAccessLink_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLinkDelivery" ADD CONSTRAINT "AccessLinkDelivery_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientZoneSession" ADD CONSTRAINT "PatientZoneSession_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLogEntry" ADD CONSTRAINT "ExerciseLogEntry_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeMembership" ADD CONSTRAINT "PracticeMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeMembership" ADD CONSTRAINT "PracticeMembership_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Default for new rows: the practice of the current request
ALTER TABLE "AccessLinkDelivery" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "Anamnesis" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "AuditEvent" ALTER COLUMN "practiceId" SET DEFAULT NULLIF(current_setting('app.practice_id'::text, true), ''::text);
ALTER TABLE "ClinicalPhoto" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "Consent" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "ConsentTextVersion" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "Consultation" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "ConsultationExercise" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "ConsultationPoint" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "DocumentCounter" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "EmailDelivery" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "ExerciseHandout" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "ExerciseLogEntry" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "HandoutDelivery" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "HomePrescription" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "Patient" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "PatientAccessLink" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "PatientZoneSession" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "SignatureSession" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "SignedDocument" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);
ALTER TABLE "Treatment" ALTER COLUMN "practiceId" SET DEFAULT current_setting('app.practice_id'::text, true);

-- Existing users become members of Falera (ADMIN -> PRACTICE_ADMIN, THERAPIST -> THERAPIST)
INSERT INTO "PracticeMembership" ("id", "userId", "practiceId", "roles")
SELECT 'pm_' || u."id", u."id", 'prc_falera',
       ARRAY(SELECT (CASE r WHEN 'ADMIN' THEN 'PRACTICE_ADMIN' ELSE 'THERAPIST' END)::"PracticeRole" FROM unnest(u."roles") AS r)
FROM "User" u;
