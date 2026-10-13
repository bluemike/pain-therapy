/** Runtime configuration read from environment variables (see .env.example). */
export const config = {
  /** Sliding session timeout (access-control: Abmeldung) */
  idleTimeoutMs: 30 * 60 * 1000,
  entra: {
    tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID ?? '',
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID ?? '',
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET ?? '',
  },
  /**
   * Local sign-in without Entra ID for development and end-to-end tests.
   * Never active inside Azure Container Apps (CONTAINER_APP_NAME is always set there).
   */
  devLogin: process.env.AUTH_DEV_LOGIN === 'true' && !process.env.CONTAINER_APP_NAME,
  /** Tenant id the development sign-in treats as "Ayanta" */
  devTenantId: '00000000-0000-0000-0000-00000000a7a7',
  storage: {
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 'azure',
    localDir: process.env.STORAGE_LOCAL_DIR ?? './data/documents',
    accountUrl: process.env.AZURE_STORAGE_ACCOUNT_URL ?? '',
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING ?? '',
    container: process.env.AZURE_STORAGE_CONTAINER ?? 'signed-documents',
    photoLocalDir: process.env.STORAGE_PHOTO_LOCAL_DIR ?? './data/clinical-photos',
    photoContainer: process.env.AZURE_STORAGE_PHOTO_CONTAINER ?? 'clinical-photos',
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
    driver: (process.env.MAIL_DRIVER ?? 'outbox') as 'outbox' | 'graph' | 'fail',
    outboxDir: process.env.MAIL_OUTBOX_DIR ?? './data/outbox',
    sender: process.env.MAIL_SENDER ?? 'pain-therapy@ayanta.ch',
    maxAttempts: 3,
    retryDelayMs: Number(process.env.MAIL_RETRY_DELAY_MS ?? 2000),
  },
  defaultPlace: process.env.DEFAULT_PLACE ?? 'Falera',
  /** Printed in the header of every signed PDF */
  practiceAddress: 'Pain Therapy | Via Prau da Cuort 5 | 7153 Falera',
};
