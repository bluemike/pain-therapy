-- Iteration 5 (design D6): signature in the patient zone. Additive, defaults keep existing rows as before.
-- CreateEnum
CREATE TYPE "SignatureChannel" AS ENUM ('IPAD', 'PATIENT_ZONE');

-- CreateEnum
CREATE TYPE "AccessLinkPurpose" AS ENUM ('EXERCISES', 'SIGNATURE');

-- AlterTable
ALTER TABLE "AccessLinkDelivery" ADD COLUMN     "purpose" "AccessLinkPurpose" NOT NULL DEFAULT 'EXERCISES';

-- AlterTable
ALTER TABLE "SignatureSession" ADD COLUMN     "channel" "SignatureChannel" NOT NULL DEFAULT 'IPAD',
ADD COLUMN     "noteResolvedAt" TIMESTAMP(3),
ADD COLUMN     "noteResolvedBy" TEXT,
ADD COLUMN     "zoneSessionId" TEXT;

-- CreateIndex
CREATE INDEX "SignatureSession_status_completedAt_idx" ON "SignatureSession"("status", "completedAt");

-- AddForeignKey
ALTER TABLE "SignatureSession" ADD CONSTRAINT "SignatureSession_zoneSessionId_fkey" FOREIGN KEY ("zoneSessionId") REFERENCES "PatientZoneSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
