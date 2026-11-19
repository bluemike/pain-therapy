-- Iteration 12 (design D1): row-level security per practice.
-- Every table with practice data shows and accepts only rows of the practice in the setting app.practice_id, which
-- the apps set per request (packages/shared/src/practice-context.ts). Not FORCEd: the table owner (migration job,
-- platform functions) is not limited; the practice app connects as practice_app and the zone as patient_zone, both
-- without BYPASSRLS, so they are limited. Catalog, User, Practice, PracticeMembership and PatientZoneAttempt (IP hashes for the
-- rate limit over all links) have no practice rows.

ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "Patient"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "Anamnesis" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "Anamnesis"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "ConsentTextVersion" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "ConsentTextVersion"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "SignatureSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "SignatureSession"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "Consent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "Consent"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "SignedDocument" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "SignedDocument"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "EmailDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "EmailDelivery"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "AuditEvent"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "DocumentCounter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "DocumentCounter"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "Treatment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "Treatment"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "Consultation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "Consultation"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "ConsultationPoint" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "ConsultationPoint"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "ConsultationExercise" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "ConsultationExercise"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "ClinicalPhoto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "ClinicalPhoto"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "HomePrescription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "HomePrescription"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "ExerciseHandout" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "ExerciseHandout"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "HandoutDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "HandoutDelivery"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "PatientAccessLink" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "PatientAccessLink"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "AccessLinkDelivery" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "AccessLinkDelivery"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "PatientZoneSession" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "PatientZoneSession"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

ALTER TABLE "ExerciseLogEntry" ENABLE ROW LEVEL SECURITY;
CREATE POLICY practice_isolation ON "ExerciseLogEntry"
  USING ("practiceId" = current_setting('app.practice_id', true))
  WITH CHECK ("practiceId" = current_setting('app.practice_id', true));

-- The zone learns the practice from the link token or the device session before any practice is set. These two
-- functions run as the owner and return only the practice id (design D6).
CREATE OR REPLACE FUNCTION zone_practice_of_link(token_hash text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT "practiceId" FROM "PatientAccessLink" WHERE "tokenHash" = token_hash $$;

CREATE OR REPLACE FUNCTION zone_practice_of_session(id_hash text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT "practiceId" FROM "PatientZoneSession" WHERE "idHash" = id_hash $$;

REVOKE ALL ON FUNCTION zone_practice_of_link(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION zone_practice_of_session(text) FROM PUBLIC;
