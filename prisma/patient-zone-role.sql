-- Database role of the patient zone (patient-zone-app: Rechte der Rolle patient_zone, iteration 4 design D12).
-- Run by prisma/patient-zone-role.mjs in the migration job after `prisma migrate deploy`, so the grants match the
-- schema after every migration. Idempotent: creates the role if missing, revokes everything, then grants exactly the
-- list below. The password comes from the session setting pain_therapy.patient_zone_password (set by the runner
-- from PATIENT_ZONE_DB_PASSWORD); without it the role keeps its password, or stays without login when new.
--
-- No DELETE anywhere, no access to anamnesis, photos, signature images, archive paths, deliveries, user fields or the
-- notes of the therapist. Contact data only as far as the consent form shows it for checking (iteration 5, design D8).
-- Treatments, consultations and documents of the own record read only (iteration 6, design D4, D5); every query of
-- the zone filters by the patient of the device session.
-- tests/unit/patient-zone-role.test.ts compares the result with the same list.
DO $$
DECLARE
  pw text := current_setting('pain_therapy.patient_zone_password', true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'patient_zone') THEN
    CREATE ROLE patient_zone NOLOGIN;
  END IF;
  IF pw IS NOT NULL AND pw <> '' THEN
    EXECUTE format('ALTER ROLE patient_zone WITH LOGIN PASSWORD %L', pw);
  END IF;

  -- Start from nothing: table privileges and with them all column privileges
  REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM patient_zone;
  REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM patient_zone;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO patient_zone', current_database());
  GRANT USAGE ON SCHEMA public TO patient_zone;

  -- Patient: first name for the greeting, language, date of birth for the confirmation, status; for the consent form
  -- the personal details the patient checks (iteration 5, design D8), but not the emergency contact, GP or occupation
  GRANT SELECT ("id", "firstName", "preferredLanguage", "dateOfBirth", "status",
                "lastName", "street", "zip", "city", "phone", "mobile", "email", "insurer", "insuranceNumber")
    ON "Patient" TO patient_zone;
  -- The current home program (design D2) and, read only, the treatments and consultations of the record (iteration 6,
  -- design D5), without createdBy and updatedBy
  GRANT SELECT ("id", "patientId", "startedAt", "regionId", "diagnosis", "painStart") ON "Treatment" TO patient_zone;
  GRANT SELECT ("id", "treatmentId", "number", "at", "diagnosis", "painBefore", "painAfter", "comparison")
    ON "Consultation" TO patient_zone;
  GRANT SELECT ("consultationId", "pointId", "left", "right", "sensitivity") ON "ConsultationPoint" TO patient_zone;
  GRANT SELECT ("consultationId", "exerciseCode", "prescribed", "difficulty", "variants")
    ON "ConsultationExercise" TO patient_zone;
  GRANT SELECT ("consultationId", "position", "area", "toolCode") ON "ConsultationRolling" TO patient_zone;
  GRANT SELECT ("id", "nameDe", "nameEn") ON "Region" TO patient_zone;
  GRANT SELECT ("id", "group", "muscleAttachmentLatin", "attachmentDe", "sort") ON "OsteopressurePoint" TO patient_zone;
  GRANT SELECT ("code", "nameDe", "nameEn", "sort") ON "RollingTool" TO patient_zone;
  -- Documents of the record (iteration 6, design D4): the list, not the archive path, checksum or deliveries; the zone
  -- builds the blob path {patientId}/{documentNumber}.pdf itself
  GRANT SELECT ("id", "documentNumber", "patientId", "textVersion", "language", "createdAt", "sessionId")
    ON "SignedDocument" TO patient_zone;
  GRANT SELECT ("id", "documentNumber", "patientId", "consultationId", "version", "language", "createdAt")
    ON "ExerciseHandout" TO patient_zone;
  -- Without intensity, steps and the note of the therapist (design D7: Bemerkungen der Therapeutin nicht sichtbar)
  GRANT SELECT ("consultationId", "exerciseCode", "repetition") ON "HomePrescription" TO patient_zone;
  GRANT SELECT ("code", "nameDe", "nameEn", "sort") ON "Exercise" TO patient_zone;
  GRANT SELECT ("exerciseCode", "mainImage", "stretchSecondsPerSide", "sides", "rollingSeconds") ON "ExerciseSheet" TO patient_zone;

  -- Access link: read, and update only the counters and the last use
  GRANT SELECT ON "PatientAccessLink" TO patient_zone;
  GRANT UPDATE ("failedAttempts", "lockedUntil", "blockedAt", "lastUsedAt") ON "PatientAccessLink" TO patient_zone;

  GRANT SELECT, INSERT, UPDATE ON "PatientZoneSession" TO patient_zone;
  GRANT SELECT, INSERT, UPDATE ON "ExerciseLogEntry" TO patient_zone;
  GRANT SELECT, INSERT ON "PatientZoneAttempt" TO patient_zone;
  -- Signature in the patient zone (iteration 5, design D8): the current text, the own signature state, and writing a
  -- signature with its consents. No SELECT on the signature images or the remark; inserts without
  -- RETURNING (createMany), so INSERT needs no SELECT on the other columns
  GRANT SELECT ("id", "version", "language", "title", "body") ON "ConsentTextVersion" TO patient_zone;
  GRANT SELECT ("id", "patientId", "textVersionId", "language", "status", "channel", "zoneSessionId", "startedAt",
                "completedAt") ON "SignatureSession" TO patient_zone;
  GRANT INSERT ON "SignatureSession" TO patient_zone;
  GRANT UPDATE ("status", "completedAt", "abortedAt", "patientNote", "place", "signaturePoints", "signatureSvg")
    ON "SignatureSession" TO patient_zone;
  GRANT INSERT ON "Consent" TO patient_zone;

  -- Append only, without reading back (the zone inserts without RETURNING)
  GRANT INSERT ON "AuditEvent" TO patient_zone;
END
$$;
