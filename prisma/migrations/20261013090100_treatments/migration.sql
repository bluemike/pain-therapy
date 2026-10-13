-- Iteration 2, treatments, consultations and clinical-photos (design D1, D4, D6). Additive only.

-- CreateEnum
CREATE TYPE "Sensitivity" AS ENUM ('LOW', 'MEDIUM', 'STRONG', 'EXTREME');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'IMPOSSIBLE');

-- CreateTable
CREATE TABLE "Treatment" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "regionId" INTEGER NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "painStart" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "Treatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "painBefore" INTEGER,
    "painAfter" INTEGER,
    "comparison" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationPoint" (
    "consultationId" TEXT NOT NULL,
    "pointId" TEXT NOT NULL,
    "left" BOOLEAN NOT NULL DEFAULT false,
    "right" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity" "Sensitivity",

    CONSTRAINT "ConsultationPoint_pkey" PRIMARY KEY ("consultationId","pointId")
);

-- CreateTable
CREATE TABLE "ConsultationExercise" (
    "consultationId" TEXT NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "prescribed" BOOLEAN NOT NULL DEFAULT false,
    "difficulty" "Difficulty",
    "variants" TEXT,

    CONSTRAINT "ConsultationExercise_pkey" PRIMARY KEY ("consultationId","exerciseCode")
);

-- CreateTable
CREATE TABLE "ConsultationRolling" (
    "consultationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "area" TEXT,
    "toolCode" TEXT,

    CONSTRAINT "ConsultationRolling_pkey" PRIMARY KEY ("consultationId","position")
);

-- CreateTable
CREATE TABLE "ClinicalPhoto" (
    "id" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,
    "consultationId" TEXT,
    "blobPath" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3),
    "removedBy" TEXT,

    CONSTRAINT "ClinicalPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Treatment_patientId_startedAt_idx" ON "Treatment"("patientId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_treatmentId_number_key" ON "Consultation"("treatmentId", "number");

-- CreateIndex
CREATE INDEX "ClinicalPhoto_treatmentId_takenAt_idx" ON "ClinicalPhoto"("treatmentId", "takenAt");

-- CreateIndex
CREATE INDEX "ClinicalPhoto_consultationId_idx" ON "ClinicalPhoto"("consultationId");

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treatment" ADD CONSTRAINT "Treatment_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationPoint" ADD CONSTRAINT "ConsultationPoint_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationPoint" ADD CONSTRAINT "ConsultationPoint_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "OsteopressurePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationExercise" ADD CONSTRAINT "ConsultationExercise_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationExercise" ADD CONSTRAINT "ConsultationExercise_exerciseCode_fkey" FOREIGN KEY ("exerciseCode") REFERENCES "Exercise"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationRolling" ADD CONSTRAINT "ConsultationRolling_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationRolling" ADD CONSTRAINT "ConsultationRolling_toolCode_fkey" FOREIGN KEY ("toolCode") REFERENCES "RollingTool"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Treatments, consultations and photos are never deleted (photos are only hidden with removedAt)
CREATE TRIGGER "Treatment_no_delete" BEFORE DELETE ON "Treatment" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "Consultation_no_delete" BEFORE DELETE ON "Consultation" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "ClinicalPhoto_no_delete" BEFORE DELETE ON "ClinicalPhoto" FOR EACH ROW EXECUTE FUNCTION reject_delete();
