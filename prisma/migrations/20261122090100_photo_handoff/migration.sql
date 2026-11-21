-- Iteration 15 (design D5): Fotos mit dem Smartphone
CREATE TABLE "PhotoHandoff" (
    "practiceId" TEXT NOT NULL DEFAULT current_setting('app.practice_id'::text, true),
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "checkCode" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "treatmentId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "maxPhotos" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "PhotoHandoff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PhotoHandoff_tokenHash_key" ON "PhotoHandoff"("tokenHash");
ALTER TABLE "PhotoHandoff" ADD CONSTRAINT "PhotoHandoff_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhotoHandoff" ADD CONSTRAINT "PhotoHandoff_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PhotoHandoffUpload" (
    "practiceId" TEXT NOT NULL DEFAULT current_setting('app.practice_id'::text, true),
    "id" TEXT NOT NULL,
    "handoffId" TEXT NOT NULL,
    "blobPath" TEXT NOT NULL,
    "thumbPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "PhotoHandoffUpload_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PhotoHandoffUpload_handoffId_idx" ON "PhotoHandoffUpload"("handoffId");
ALTER TABLE "PhotoHandoffUpload" ADD CONSTRAINT "PhotoHandoffUpload_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PhotoHandoffUpload" ADD CONSTRAINT "PhotoHandoffUpload_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "PhotoHandoff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PhotoHandoffAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoHandoffAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PhotoHandoffAttempt_ipHash_at_idx" ON "PhotoHandoffAttempt"("ipHash", "at");

-- Row-level security like every table with practice data (migration 20261119090100)
ALTER TABLE "PhotoHandoff" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "PhotoHandoff"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));
ALTER TABLE "PhotoHandoffUpload" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "PhotoHandoffUpload"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

-- The public page /foto/<token> finds the practice of its link before any practice is set (like the zone)
CREATE OR REPLACE FUNCTION photo_handoff_practice(token_hash text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT "practiceId" FROM "PhotoHandoff" WHERE "tokenHash" = token_hash $$;
REVOKE ALL ON FUNCTION photo_handoff_practice(text) FROM PUBLIC;

-- Iteration 15: the purge of a practice also removes its photo handoffs (same function as in 20261120110000)
-- Deletes all rows of a practice, including those the triggers keep from deletion (patients, signed documents, audit
-- log). Runs as the table owner; only the owner may call it (platform functions with DATABASE_ADMIN_URL). The triggers
-- are off only inside this transaction; ALTER TABLE locks the tables until it ends.
CREATE OR REPLACE FUNCTION platform_purge_practice(p text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t text;
  protected text[] := ARRAY['Patient', 'SignatureSession', 'SignedDocument', 'Consent', 'ConsentTextVersion',
    'Treatment', 'Consultation', 'ClinicalPhoto', 'ExerciseHandout', 'HandoutDelivery', 'PatientAccessLink',
    'AccessLinkDelivery', 'PatientZoneSession', 'ExerciseLogEntry', 'AuditEvent'];
  ordered text[] := ARRAY['EmailDelivery', 'HandoutDelivery', 'AccessLinkDelivery', 'Consent', 'ExerciseLogEntry',
    'ConsultationExercise', 'ConsultationPoint', 'ClinicalPhoto', 'PhotoHandoffUpload', 'PhotoHandoff', 'AuditEvent', 'Anamnesis', 'SignedDocument',
    'ExerciseHandout', 'HomePrescription', 'SignatureSession', 'PatientZoneSession', 'PatientAccessLink',
    'Consultation', 'Treatment', 'Patient', 'ConsentTextVersion', 'DocumentCounter'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Practice" WHERE "id" = p AND "status" = 'SUSPENDED') THEN
    RAISE EXCEPTION 'practice % must exist and be suspended', p;
  END IF;
  FOREACH t IN ARRAY protected LOOP
    EXECUTE format('ALTER TABLE %I DISABLE TRIGGER USER', t);
  END LOOP;
  DELETE FROM "PatientZoneAttempt" WHERE "linkId" IN (SELECT "id" FROM "PatientAccessLink" WHERE "practiceId" = p);
  FOREACH t IN ARRAY ordered LOOP
    EXECUTE format('DELETE FROM %I WHERE "practiceId" = $1', t) USING p;
  END LOOP;
  FOREACH t IN ARRAY protected LOOP
    EXECUTE format('ALTER TABLE %I ENABLE TRIGGER USER', t);
  END LOOP;
  -- Accounts that belonged only to this practice end with it
  DELETE FROM "LoginCode" WHERE "invitationId" IN (SELECT "id" FROM "Invitation" WHERE "practiceId" = p);
  DELETE FROM "Invitation" WHERE "practiceId" = p;
  CREATE TEMP TABLE purge_users ON COMMIT DROP AS
    SELECT "userId" AS id FROM "PracticeMembership" m WHERE m."practiceId" = p
      AND NOT EXISTS (SELECT 1 FROM "PracticeMembership" o WHERE o."userId" = m."userId" AND o."practiceId" <> p)
      AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u."id" = m."userId" AND u."platformAdmin");
  DELETE FROM "PracticeMembership" WHERE "practiceId" = p;
  DELETE FROM "WebAuthnChallenge" WHERE "userId" IN (SELECT id FROM purge_users);
  DELETE FROM "User" WHERE "id" IN (SELECT id FROM purge_users);
  UPDATE "Practice" SET "deletedAt" = now(), "logo" = NULL, "logoType" = NULL, "privacyNotice" = NULL,
    "phone" = NULL, "street" = NULL, "zip" = NULL, "city" = NULL WHERE "id" = p;
END
$$;
REVOKE ALL ON FUNCTION platform_purge_practice(text) FROM PUBLIC;
