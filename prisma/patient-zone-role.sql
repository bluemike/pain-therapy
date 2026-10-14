-- Database role of the patient zone (patient-zone-app: Rechte der Rolle patient_zone, iteration 4 design D12).
-- Run by prisma/patient-zone-role.mjs in the migration job after `prisma migrate deploy`, so the grants match the
-- schema after every migration. Idempotent: creates the role if missing, revokes everything, then grants exactly the
-- list below. The password comes from the session setting pain_therapy.patient_zone_password (set by the runner
-- from PATIENT_ZONE_DB_PASSWORD); without it the role keeps its password, or stays without login when new.
--
-- No DELETE anywhere, no access to anamnesis, diagnoses, pain values, photos, documents, contact data or the notes
-- of the therapist. tests/unit/patient-zone-role.test.ts compares the result with the same list.
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

  -- Patient: first name for the greeting, language, date of birth for the confirmation, status
  GRANT SELECT ("id", "firstName", "preferredLanguage", "dateOfBirth", "status") ON "Patient" TO patient_zone;
  -- The current home program (design D2): newest consultation with a prescription over all treatments
  GRANT SELECT ("id", "patientId") ON "Treatment" TO patient_zone;
  GRANT SELECT ("id", "treatmentId", "at") ON "Consultation" TO patient_zone;
  -- Without intensity, steps and the note of the therapist (design D7: Bemerkungen der Therapeutin nicht sichtbar)
  GRANT SELECT ("consultationId", "exerciseCode", "repetition") ON "HomePrescription" TO patient_zone;
  GRANT SELECT ("code", "nameDe", "nameEn") ON "Exercise" TO patient_zone;
  GRANT SELECT ("exerciseCode", "mainImage", "stretchSecondsPerSide", "sides", "rollingSeconds") ON "ExerciseSheet" TO patient_zone;

  -- Access link: read, and update only the counters and the last use
  GRANT SELECT ON "PatientAccessLink" TO patient_zone;
  GRANT UPDATE ("failedAttempts", "lockedUntil", "blockedAt", "lastUsedAt") ON "PatientAccessLink" TO patient_zone;

  GRANT SELECT, INSERT, UPDATE ON "PatientZoneSession" TO patient_zone;
  GRANT SELECT, INSERT, UPDATE ON "ExerciseLogEntry" TO patient_zone;
  GRANT SELECT, INSERT ON "PatientZoneAttempt" TO patient_zone;
  -- Append only, without reading back (the zone inserts without RETURNING)
  GRANT INSERT ON "AuditEvent" TO patient_zone;
END
$$;
