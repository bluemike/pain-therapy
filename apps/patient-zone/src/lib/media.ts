import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

/**
 * Read-only access to the private containers `exercise-media` (design D7, D13) and, since iteration 6 (design D4),
 * `signed-documents`: the managed identity of the patient zone has "Storage Blob Data Reader" on these two containers
 * only. Locally the folders of npm run media:placeholders and of the practice app's document archive.
 */
export interface MediaStore {
  get(name: string): Promise<Buffer | null>;
}

class LocalMedia implements MediaStore {
  constructor(private dir: string) {}
  async get(name: string) {
    const root = path.resolve(this.dir);
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) return null;
    try {
      return await readFile(file);
    } catch {
      return null;
    }
  }
}

class AzureMedia implements MediaStore {
  constructor(private container: string) {}
  private client = (async () => {
    const { BlobServiceClient } = await import('@azure/storage-blob');
    const service = config.storage.connectionString
      ? BlobServiceClient.fromConnectionString(config.storage.connectionString)
      : new BlobServiceClient(
          config.storage.accountUrl,
          new (await import('@azure/identity')).DefaultAzureCredential(),
        );
    return service.getContainerClient(this.container);
  })();
  async get(name: string) {
    try {
      return await (await this.client).getBlockBlobClient(name).downloadToBuffer();
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 404) return null;
      throw e;
    }
  }
}

let store: MediaStore | null = null;
export function mediaStore(): MediaStore {
  store ??=
    config.storage.driver === 'azure'
      ? new AzureMedia(config.storage.exerciseContainer)
      : new LocalMedia(config.storage.exerciseLocalDir);
  return store;
}
export function setMediaStore(s: MediaStore | null) {
  store = s;
}

/** The archived PDFs (signed disclaimers and exercise sheets), read only */
let documents: MediaStore | null = null;
export function documentStore(): MediaStore {
  documents ??=
    config.storage.driver === 'azure'
      ? new AzureMedia(config.storage.documentContainer)
      : new LocalMedia(config.storage.documentLocalDir);
  return documents;
}
export function setDocumentStore(s: MediaStore | null) {
  documents = s;
}

export function contentTypeOf(name: string) {
  return name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}
