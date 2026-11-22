import { PLATFORM_NAME } from '@pain-therapy/shared/brand';
/** Runtime configuration read from environment variables (see .env.example). */
export const config = {
  /** Sliding session timeout (access-control: Abmeldung) */
  idleTimeoutMs: 30 * 60 * 1000,
  /** Sign-in without Entra (iteration 12, therapist-login, design D2) */
  auth: {
    /** Public address of the practice app; its host name is the WebAuthn relying party id */
    appUrl: (process.env.AUTH_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    rpName: PLATFORM_NAME,
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
  /**
   * Handschrift → Text (iteration 10, design D4, D8): Azure AI Document Intelligence in Switzerland North, called with
   * the managed identity of the app. Without an endpoint, recognition returns a fixed text outside production
   * (development, end-to-end tests) and is unavailable in production.
   */
  handwriting: {
    endpoint: (process.env.AZURE_DOCINTEL_ENDPOINT ?? '').replace(/\/$/, ''),
    // Never inside Azure Container Apps (CONTAINER_APP_NAME is always set there), like devLogin
    stub:
      !process.env.CONTAINER_APP_NAME &&
      (process.env.DOCINTEL_STUB === '1' ||
        (!process.env.AZURE_DOCINTEL_ENDPOINT && process.env.NODE_ENV !== 'production')),
    apiVersion: '2024-11-30',
    maxImageBytes: 4 * 1024 * 1024,
    timeoutMs: 15000,
    perUserPerHour: 60,
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
    fromName: PLATFORM_NAME,
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
   * SMS (iteration 16, design D2): ASPSMS in Azure, a local outbox folder in development and tests. Never the outbox
   * inside Azure Container Apps.
   */
  sms: {
    driver: (process.env.SMS_DRIVER ?? (process.env.CONTAINER_APP_NAME ? 'aspsms' : 'outbox')) as
      'outbox' | 'aspsms' | 'fail',
    outboxDir: process.env.SMS_OUTBOX_DIR ?? './data/sms-outbox',
    aspsms: {
      url: process.env.ASPSMS_URL ?? 'https://json.aspsms.com/SendSimpleTextSMS',
      /** Key Vault secrets aspsms-userkey and aspsms-password */
      userKey: process.env.ASPSMS_USERKEY ?? '',
      password: process.env.ASPSMS_PASSWORD ?? '',
      /** Alphanumeric sender, at most 11 characters */
      originator: process.env.ASPSMS_ORIGINATOR ?? 'PainTherapy',
    },
    perInvitationPerHour: 5,
    perDay: Number(process.env.SMS_PER_DAY ?? 50),
  },
  /**
   * Mailboxes at Infomaniak (iteration 16, design D3, D6): API token of api@pain-therapy.online (Key Vault secret
   * infomaniak-api-token). Without a token outside Azure a local fake keeps the mailboxes in a file (development,
   * tests); inside Azure without a token the mailbox functions are off.
   */
  mailboxes: {
    domain: (process.env.MAILBOX_DOMAIN ?? 'pain-therapy.online').trim().toLowerCase(),
    apiUrl: (process.env.INFOMANIAK_API_URL ?? 'https://api.infomaniak.com').replace(/\/$/, ''),
    token: process.env.INFOMANIAK_API_TOKEN ?? '',
    mailHostingId: process.env.INFOMANIAK_MAIL_HOSTING_ID ?? '',
    /** For the link into the Manager; optional */
    accountId: process.env.INFOMANIAK_ACCOUNT_ID ?? '',
    fakeFile: process.env.INFOMANIAK_FAKE_FILE ?? './data/infomaniak-fake.json',
    imapHost: process.env.MAILBOX_IMAP_HOST ?? 'mail.infomaniak.com',
    imapPort: 993,
    smtpPort: 465,
    /** Handed over device password waits at most 14 days (design D4) */
    handoverTtlMs: 14 * 24 * 60 * 60 * 1000,
    /** One-time link to the Apple profile */
    profileTtlMs: 10 * 60 * 1000,
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
