-- Iteration 12, phase 5 (design D3, D4, D9): team, platform, export and deletion of a practice.

-- Name of the invited person, taken over by the account on the first confirmed code
ALTER TABLE "Invitation" ADD COLUMN "name" TEXT;

-- A deleted practice stays as a row (name, slug, when) so its slug is never given again
ALTER TABLE "Practice" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Export of a practice (ZIP with PDFs, photos and the data as JSON), download for 24 hours
CREATE TYPE "ExportStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');
CREATE TABLE "PracticeExport" (
  "practiceId"  TEXT NOT NULL DEFAULT current_setting('app.practice_id'::text, true),
  "id"          TEXT NOT NULL,
  "status"      "ExportStatus" NOT NULL DEFAULT 'PENDING',
  "requestedBy" TEXT NOT NULL,
  "blobPath"    TEXT,
  "sizeBytes"   INTEGER,
  "error"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt"  TIMESTAMP(3),
  "expiresAt"   TIMESTAMP(3),
  CONSTRAINT "PracticeExport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PracticeExport_practiceId_createdAt_idx" ON "PracticeExport"("practiceId", "createdAt");
ALTER TABLE "PracticeExport" ADD CONSTRAINT "PracticeExport_practiceId_fkey"
  FOREIGN KEY ("practiceId") REFERENCES "Practice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticeExport" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "PracticeExport"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

-- Signed PDFs under WORM retention outlive a deleted practice: they are listed here and removed by a job once their
-- retention has passed (design D9)
CREATE TABLE "PendingBlobDeletion" (
  "id"          TEXT NOT NULL,
  "practiceId"  TEXT NOT NULL,
  "container"   TEXT NOT NULL,
  "path"        TEXT NOT NULL,
  "deleteAfter" TIMESTAMP(3) NOT NULL,
  "deletedAt"   TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PendingBlobDeletion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PendingBlobDeletion_deleteAfter_idx" ON "PendingBlobDeletion"("deleteAfter");
-- Only the table owner (platform functions) works with it
REVOKE ALL ON "PendingBlobDeletion" FROM PUBLIC;

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
    'ConsultationExercise', 'ConsultationPoint', 'ClinicalPhoto', 'AuditEvent', 'Anamnesis', 'SignedDocument',
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

-- A suspended or deleted practice has no patient zone (design D9): its links and device sessions resolve to no
-- practice, so the zone finds nothing and shows the neutral page
CREATE OR REPLACE FUNCTION zone_practice_of_link(token_hash text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT l."practiceId" FROM "PatientAccessLink" l JOIN "Practice" p ON p."id" = l."practiceId"
   WHERE l."tokenHash" = token_hash AND p."status" = 'ACTIVE' AND p."deletedAt" IS NULL $$;

CREATE OR REPLACE FUNCTION zone_practice_of_session(id_hash text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT s."practiceId" FROM "PatientZoneSession" s JOIN "Practice" p ON p."id" = s."practiceId"
   WHERE s."idHash" = id_hash AND p."status" = 'ACTIVE' AND p."deletedAt" IS NULL $$;
