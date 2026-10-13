-- Iteration 3, home-program and exercise-handout (design D4 to D6). Additive only.

-- CreateEnum
CREATE TYPE "Repetition" AS ENUM ('DAILY_1', 'DAILY_2', 'DAILY_3', 'WEEKLY_1', 'WEEKLY_2', 'WEEKLY_3', 'WEEKLY_4', 'WEEKLY_5', 'WEEKLY_6', 'WEEKLY_7');

-- CreateEnum
CREATE TYPE "HandoutChannel" AS ENUM ('EMAIL', 'PRINT');

-- CreateTable
CREATE TABLE "HomePrescription" (
    "consultationId" TEXT NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "repetition" "Repetition" NOT NULL DEFAULT 'DAILY_1',
    "intensity" INTEGER,
    "steps" INTEGER,
    "note" TEXT,

    CONSTRAINT "HomePrescription_pkey" PRIMARY KEY ("consultationId","exerciseCode")
);

-- CreateTable
CREATE TABLE "ExerciseHandout" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "language" "Language" NOT NULL,
    "prescriptions" JSONB NOT NULL,
    "blobPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "ExerciseHandout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoutDelivery" (
    "id" TEXT NOT NULL,
    "handoutId" TEXT NOT NULL,
    "channel" "HandoutChannel" NOT NULL,
    "recipient" TEXT,
    "status" "EmailStatus",
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HandoutDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseHandout_documentNumber_key" ON "ExerciseHandout"("documentNumber");

-- CreateIndex
CREATE INDEX "ExerciseHandout_patientId_createdAt_idx" ON "ExerciseHandout"("patientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseHandout_consultationId_version_key" ON "ExerciseHandout"("consultationId", "version");

-- AddForeignKey
ALTER TABLE "HomePrescription" ADD CONSTRAINT "HomePrescription_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomePrescription" ADD CONSTRAINT "HomePrescription_exerciseCode_fkey" FOREIGN KEY ("exerciseCode") REFERENCES "Exercise"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseHandout" ADD CONSTRAINT "ExerciseHandout_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseHandout" ADD CONSTRAINT "ExerciseHandout_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoutDelivery" ADD CONSTRAINT "HandoutDelivery_handoutId_fkey" FOREIGN KEY ("handoutId") REFERENCES "ExerciseHandout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Range checks of the prescription (intensity below 10, steps 1 to 3), also for writes outside the app
ALTER TABLE "HomePrescription" ADD CONSTRAINT "HomePrescription_intensity_check" CHECK ("intensity" BETWEEN 1 AND 9);
ALTER TABLE "HomePrescription" ADD CONSTRAINT "HomePrescription_steps_check" CHECK ("steps" BETWEEN 1 AND 3);

-- Exercise sheets are archived like signed documents: never changed or deleted. Deliveries keep their status
-- updates but are never deleted. Prescriptions are replaced with the form; every change is in the audit log.
CREATE TRIGGER "ExerciseHandout_immutable" BEFORE UPDATE OR DELETE ON "ExerciseHandout"
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
CREATE TRIGGER "HandoutDelivery_no_delete" BEFORE DELETE ON "HandoutDelivery" FOR EACH ROW EXECUTE FUNCTION reject_delete();
