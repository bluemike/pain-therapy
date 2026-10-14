-- Iteration 4, patient-access and exercise-log (design D3 to D8). Additive only. The role patient_zone and its
-- grants are (re)applied after every migration by prisma/patient-zone-role.sql (design D12).

-- CreateEnum
CREATE TYPE "AccessLinkChannel" AS ENUM ('EMAIL', 'SCREEN', 'PRINT');

-- CreateTable
CREATE TABLE "PatientAccessLink" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "replacedAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "blockedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "PatientAccessLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessLinkDelivery" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "channel" "AccessLinkChannel" NOT NULL,
    "handoutId" TEXT,
    "recipient" TEXT,
    "status" "EmailStatus",
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessLinkDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientZoneSession" (
    "id" TEXT NOT NULL,
    "idHash" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "PatientZoneSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientZoneAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "linkId" TEXT,
    "success" BOOLEAN NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientZoneAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseLogEntry" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "sessionId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL,
    "rating" INTEGER,
    "note" TEXT,
    "quick" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ExerciseLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientAccessLink_tokenHash_key" ON "PatientAccessLink"("tokenHash");

-- CreateIndex
CREATE INDEX "PatientAccessLink_patientId_createdAt_idx" ON "PatientAccessLink"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AccessLinkDelivery_linkId_createdAt_idx" ON "AccessLinkDelivery"("linkId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientZoneSession_idHash_key" ON "PatientZoneSession"("idHash");

-- CreateIndex
CREATE INDEX "PatientZoneSession_patientId_idx" ON "PatientZoneSession"("patientId");

-- CreateIndex
CREATE INDEX "PatientZoneAttempt_ipHash_at_idx" ON "PatientZoneAttempt"("ipHash", "at");

-- CreateIndex
CREATE INDEX "ExerciseLogEntry_patientId_performedAt_idx" ON "ExerciseLogEntry"("patientId", "performedAt");

-- CreateIndex
CREATE INDEX "ExerciseLogEntry_consultationId_exerciseCode_idx" ON "ExerciseLogEntry"("consultationId", "exerciseCode");

-- AddForeignKey
ALTER TABLE "PatientAccessLink" ADD CONSTRAINT "PatientAccessLink_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLinkDelivery" ADD CONSTRAINT "AccessLinkDelivery_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PatientAccessLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientZoneSession" ADD CONSTRAINT "PatientZoneSession_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PatientAccessLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientZoneSession" ADD CONSTRAINT "PatientZoneSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientZoneAttempt" ADD CONSTRAINT "PatientZoneAttempt_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "PatientAccessLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLogEntry" ADD CONSTRAINT "ExerciseLogEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLogEntry" ADD CONSTRAINT "ExerciseLogEntry_consultationId_exerciseCode_fkey" FOREIGN KEY ("consultationId", "exerciseCode") REFERENCES "HomePrescription"("consultationId", "exerciseCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseLogEntry" ADD CONSTRAINT "ExerciseLogEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatientZoneSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- exercise-log: Bewertung 1 bis 10, nur bei "gemacht", Bemerkung höchstens 500 Zeichen, also for writes outside the app
ALTER TABLE "ExerciseLogEntry" ADD CONSTRAINT "ExerciseLogEntry_rating_check" CHECK ("rating" BETWEEN 1 AND 10);
ALTER TABLE "ExerciseLogEntry" ADD CONSTRAINT "ExerciseLogEntry_rating_done_check" CHECK ("rating" IS NULL OR "done");
ALTER TABLE "ExerciseLogEntry" ADD CONSTRAINT "ExerciseLogEntry_note_check" CHECK (char_length("note") <= 500);
ALTER TABLE "PatientAccessLink" ADD CONSTRAINT "PatientAccessLink_failedAttempts_check" CHECK ("failedAttempts" >= 0);

-- Links, deliveries, sessions and log entries are never deleted: deleting an entry only sets "deletedAt", every
-- correction and deletion is in the audit log. Confirmation attempts are deleted after 30 days by the migration job.
CREATE TRIGGER "PatientAccessLink_no_delete" BEFORE DELETE ON "PatientAccessLink" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "AccessLinkDelivery_no_delete" BEFORE DELETE ON "AccessLinkDelivery" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "PatientZoneSession_no_delete" BEFORE DELETE ON "PatientZoneSession" FOR EACH ROW EXECUTE FUNCTION reject_delete();
CREATE TRIGGER "ExerciseLogEntry_no_delete" BEFORE DELETE ON "ExerciseLogEntry" FOR EACH ROW EXECUTE FUNCTION reject_delete();
