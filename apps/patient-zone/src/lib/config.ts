/** Runtime configuration of the patient zone (see apps/patient-zone/.env.example and infra/main.bicep). */
export const config = {
  /**
   * Key for the HMAC of IP addresses (PatientZoneAttempt.ipHash, design D5). Key Vault secret patient-zone-secret in
   * Azure; a fixed development value only outside production.
   */
  secret:
    process.env.PATIENT_ZONE_SECRET ??
    (process.env.NODE_ENV === 'production' ? '' : 'local-development-patient-zone-secret'),
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 'azure',
    /** Same folder as the practice app locally (npm run media:placeholders writes there) */
    exerciseLocalDir: process.env.STORAGE_EXERCISE_LOCAL_DIR ?? '../../data/exercise-media',
    accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL ?? '',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? '',
    exerciseContainer: process.env.AZURE_STORAGE_EXERCISE_CONTAINER ?? 'exercise-media',
  },
  practice: {
    name: 'Ayanta Pain Therapy',
    email: process.env.PRACTICE_EMAIL ?? 'pain-therapy@ayanta.ch',
    address: 'Via Prau da Cuort 5, 7153 Falera',
  },
};
