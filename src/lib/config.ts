/** Runtime configuration read from environment variables (see .env.example). */
export const config = {
  /** Sliding session timeout (access-control: Abmeldung) */
  idleTimeoutMs: 30 * 60 * 1000,
  /** Sign-in without Entra (iteration 12, therapist-login, design D2) */
  auth: {
    /** Public address of the practice app; its host name is the WebAuthn relying party id */
    appUrl: (process.env.AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    rpName: 'Pain Therapy',
    /**
     * Key for the TOTP secrets (32 bytes, base64): Key Vault secret auth-encryption-key in Azure. Outside production
     * it is derived from AUTH_SECRET.
     */
    encryptionKey: process.env.AUTH_ENCRYPTION_KEY ?? '',
    codeTtlMs: 10 * 60 * 1000,
    /** Lock after this many wrong codes per address within lockMs (Schutz vor Erraten) */
    maxFailures: 5,
    /** Per IP address, a little higher for practices behind one router */
    maxFailuresPerIp: 20,
    lockMs: 15 * 60 * 1000,
    invitationTtlMs: 7 * 24 * 60 * 60 * 1000,
  },
  /**
   * Local sign-in without email code for development and end-to-end tests.
   * Never active inside Azure Container Apps (CONTAINER_APP_NAME is always set there).
   */
  devLogin: process.env.AUTH_DEV_LOGIN === 'true' && !process.env.CONTAINER_APP_NAME,
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 'azure',
    localDir: process.env.STORAGE_LOCAL_DIR ?? './data/documents',
    accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL ?? '',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? '',
    container: process.env.AZURE_STORAGE_CONTAINER ?? 'signed-documents',
    photoLocalDir: process.env.STORAGE_PHOTO_LOCAL_DIR ?? './data/clinical-photos',
    photoContainer: process.env.AZURE_STORAGE_PHOTO_CONTAINER ?? 'clinical-photos',
    /** WORM retention of signed PDFs and exercise sheets in days (infra/main.bicep documentRetentionDays) */
    documentRetentionDays: Number(process.env.DOCUMENT_RETENTION_DAYS ?? 7300),
    /** Exports of a practice as ZIP (iteration 12, design D9), 24 hours */
    exportLocalDir: process.env.STORAGE_EXPORT_LOCAL_DIR ?? './data/exports',
    exportContainer: process.env.AZURE_STORAGE_EXPORT_CONTAINER ?? 'practice-exports',
    /** Images and texts of the L&B exercise sheets (iteration 3, design D2); never in the repository */
    exerciseLocalDir: process.env.STORAGE_EXERCISE_LOCAL_DIR ?? './data/exercise-media',
    exerciseContainer: process.env.AZURE_STORAGE_EXERCISE_CONTAINER ?? 'exercise-media',
  },
  photos: {
    /** Per photo after resizing in the browser (design D5) */
    maxBytes: 5 * 1024 * 1024,
    maxPerSave: 10,
    maxThumbBytes: 1024 * 1024,
  },
  mail: {
    driver: (process.env.MAIL_DRIVER ?? 'outbox') as 'outbox' | 'smtp' | 'fail',
    outboxDir: process.env.MAIL_OUTBOX_DIR ?? './data/outbox',
    /** Iteration 12, design D7: one sender for all practices, with the practice as display name */
    from: process.env.MAIL_FROM ?? 'noreply@pain-therapy.online',
    fromName: 'Pain Therapy',
    smtp: {
      host: process.env.SMTP_HOST ?? 'mail.infomaniak.com',
      port: Number(process.env.SMTP_PORT ?? 465),
      user: process.env.SMTP_USER ?? process.env.MAIL_FROM ?? 'noreply@pain-therapy.online',
      /** Key Vault secret smtp-password: the device password of noreply@ at Infomaniak */
      password: process.env.SMTP_PASSWORD ?? '',
    },
    maxAttempts: 3,
    retryDelayMs: Number(process.env.MAIL_RETRY_DELAY_MS ?? 2000),
  },
  /**
   * Address of the patient zone (iteration 4, design D13), e.g. https://patient.pain-therapy.ayanta.ch. Empty until
   * its host name is bound: then "Link senden" and "Link zur Patienten-Zone mitsenden" stay hidden.
   */
  patientZone: { url: (process.env.PATIENT_ZONE_URL ?? '').trim() },
  /**
   * Key of the internal calls from the patient zone and the finalize job (iteration 5, design D7, D11): Key Vault
   * secret zone-internal-secret in Azure; a fixed development value only outside production.
   */
  internalSecret:
    process.env.ZONE_INTERNAL_SECRET ??
    (process.env.NODE_ENV === 'production' ? '' : 'local-development-zone-internal-secret'),
  /** Operator of the platform in footer and imprint (Mike, 19.11.2026: Ayanta) */
  /** Address of the platform account invited by the job while none exists (iteration 12, task 5.0) */
  platformAdminEmail: (process.env.PLATFORM_ADMIN_EMAIL ?? 'admin@pain-therapy.online').trim().toLowerCase(),
  operator: {
    name: process.env.OPERATOR_NAME ?? 'Ayanta',
    address: process.env.OPERATOR_ADDRESS ?? '',
    email: process.env.OPERATOR_EMAIL ?? 'admin@pain-therapy.online',
  },
};
