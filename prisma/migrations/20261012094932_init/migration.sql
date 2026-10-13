-- CreateEnum
CREATE TYPE "Role" AS ENUM ('THERAPIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('de', 'en');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('m', 'w', 'd');

-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "YesNo" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "Pregnancy" AS ENUM ('YES', 'NO', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "SignatureStatus" AS ENUM ('OPEN', 'ABORTED', 'SIGNED');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('LIABILITY_WAIVER', 'DATA_PROCESSING', 'UNENCRYPTED_EMAIL');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED_NO_CONSENT', 'SKIPPED_NO_ADDRESS');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "entraOid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" "Role"[],
    "locale" "Language" NOT NULL DEFAULT 'de',
    "place" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" "Gender",
    "dateOfBirth" DATE NOT NULL,
    "preferredLanguage" "Language" NOT NULL DEFAULT 'de',
    "occupation" TEXT,
    "gp" TEXT,
    "street" TEXT,
    "zip" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "insurer" TEXT,
    "insuranceNumber" TEXT,
    "status" "PatientStatus" NOT NULL DEFAULT 'ACTIVE',
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anamnesis" (
    "patientId" TEXT NOT NULL,
    "smoker" "YesNo" NOT NULL DEFAULT 'NO',
    "smokingYears" INTEGER,
    "packsPerDay" DECIMAL(4,1),
    "highBloodPressure" BOOLEAN NOT NULL DEFAULT false,
    "highBloodLipids" BOOLEAN NOT NULL DEFAULT false,
    "dizziness" BOOLEAN NOT NULL DEFAULT false,
    "osteoporosis" BOOLEAN NOT NULL DEFAULT false,
    "arthrosis" BOOLEAN NOT NULL DEFAULT false,
    "rheumatism" BOOLEAN NOT NULL DEFAULT false,
    "orthoOther" BOOLEAN NOT NULL DEFAULT false,
    "orthoOtherText" TEXT,
    "cardiovascular" BOOLEAN NOT NULL DEFAULT false,
    "diabetes" BOOLEAN NOT NULL DEFAULT false,
    "asthma" BOOLEAN NOT NULL DEFAULT false,
    "allergies" BOOLEAN NOT NULL DEFAULT false,
    "internalOther" BOOLEAN NOT NULL DEFAULT false,
    "internalOtherText" TEXT,
    "furtherDiagnoses" TEXT,
    "medication" TEXT,
    "pregnancy" "Pregnancy" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "inTreatment" "YesNo" NOT NULL DEFAULT 'NO',
    "treatingDoctor" TEXT,

    CONSTRAINT "Anamnesis_pkey" PRIMARY KEY ("patientId")
);

-- CreateTable
CREATE TABLE "ConsentTextVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "language" "Language" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedBy" TEXT NOT NULL,

    CONSTRAINT "ConsentTextVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignatureSession" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "textVersionId" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "status" "SignatureStatus" NOT NULL DEFAULT 'OPEN',
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "abortedAt" TIMESTAMP(3),
    "patientNote" TEXT,
    "place" TEXT,
    "signaturePoints" JSONB,
    "signatureSvg" TEXT,

    CONSTRAINT "SignatureSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "ConsentKind" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignedDocument" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "textVersion" INTEGER NOT NULL,
    "language" "Language" NOT NULL,
    "blobPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDelivery" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "recipient" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "patientId" TEXT,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "before" TEXT,
    "after" TEXT,
    "details" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCounter" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("year")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_entraOid_key" ON "User"("entraOid");

-- CreateIndex
CREATE INDEX "Patient_lastName_dateOfBirth_idx" ON "Patient"("lastName", "dateOfBirth");

-- CreateIndex
CREATE INDEX "Patient_status_lastName_idx" ON "Patient"("status", "lastName");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTextVersion_version_language_key" ON "ConsentTextVersion"("version", "language");

-- CreateIndex
CREATE INDEX "SignatureSession_patientId_startedAt_idx" ON "SignatureSession"("patientId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Consent_sessionId_kind_key" ON "Consent"("sessionId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "SignedDocument_documentNumber_key" ON "SignedDocument"("documentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SignedDocument_sessionId_key" ON "SignedDocument"("sessionId");

-- CreateIndex
CREATE INDEX "SignedDocument_patientId_createdAt_idx" ON "SignedDocument"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_patientId_at_idx" ON "AuditEvent"("patientId", "at");

-- AddForeignKey
ALTER TABLE "Anamnesis" ADD CONSTRAINT "Anamnesis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureSession" ADD CONSTRAINT "SignatureSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignatureSession" ADD CONSTRAINT "SignatureSession_textVersionId_fkey" FOREIGN KEY ("textVersionId") REFERENCES "ConsentTextVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SignatureSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignedDocument" ADD CONSTRAINT "SignedDocument_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignedDocument" ADD CONSTRAINT "SignedDocument_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SignatureSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SignedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only audit log and immutable document records (access-control: Zugriffsprotokoll; consent-documents: Archiv)
CREATE OR REPLACE FUNCTION reject_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows are append-only and cannot be %', TG_TABLE_NAME, lower(TG_OP);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditEvent_append_only" BEFORE UPDATE OR DELETE ON "AuditEvent"
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
CREATE TRIGGER "SignedDocument_immutable" BEFORE UPDATE OR DELETE ON "SignedDocument"
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
CREATE TRIGGER "ConsentTextVersion_immutable" BEFORE UPDATE OR DELETE ON "ConsentTextVersion"
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
CREATE TRIGGER "Consent_immutable" BEFORE UPDATE OR DELETE ON "Consent"
  FOR EACH ROW EXECUTE FUNCTION reject_modification();
-- Patients are deactivated, never deleted
CREATE OR REPLACE FUNCTION reject_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% rows cannot be deleted', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Patient_no_delete" BEFORE DELETE ON "Patient" FOR EACH ROW EXECUTE FUNCTION reject_delete();
