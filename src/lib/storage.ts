import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

/**
 * Document archive (design D8), clinical photos (iteration 2, design D6) and exercise media (iteration 3, design D2),
 * one container each. Archive and photo files are written once and never overwritten.
 */
export interface DocumentStore {
  put(blobPath: string, data: Buffer, contentType: string): Promise<void>;
  get(blobPath: string): Promise<Buffer>;
}

export const sha256 = (data: Buffer) => createHash('sha256').update(data).digest('hex');

class LocalStore implements DocumentStore {
  constructor(private dir: string) {}
  private full(p: string) {
    const resolved = path.resolve(this.dir, p);
    if (!resolved.startsWith(path.resolve(this.dir) + path.sep)) throw new Error('Invalid path');
    return resolved;
  }
  async put(p: string, data: Buffer) {
    const f = this.full(p);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, data, { flag: 'wx' }); // fails if the file exists
    await chmod(f, 0o444);
  }
  async get(p: string) {
    return readFile(this.full(p));
  }
}

class AzureStore implements DocumentStore {
  private client: Promise<import('@azure/storage-blob').ContainerClient>;
  constructor(containerName: string) {
    this.client = (async () => {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const service = config.storage.connectionString
        ? BlobServiceClient.fromConnectionString(config.storage.connectionString)
        : new BlobServiceClient(
            config.storage.accountUrl,
            new (await import('@azure/identity')).DefaultAzureCredential(),
          );
      const container = service.getContainerClient(containerName);
      if (config.storage.connectionString) await container.createIfNotExists();
      return container;
    })();
  }
  async put(p: string, data: Buffer, contentType: string) {
    const blob = (await this.client).getBlockBlobClient(p);
    await blob.uploadData(data, {
      blobHTTPHeaders: { blobContentType: contentType },
      conditions: { ifNoneMatch: '*' },
    });
  }
  async get(p: string) {
    return (await this.client).getBlockBlobClient(p).downloadToBuffer();
  }
}

let store: DocumentStore | null = null;
export function documentStore(): DocumentStore {
  store ??=
    config.storage.driver === 'azure'
      ? new AzureStore(config.storage.container)
      : new LocalStore(config.storage.localDir);
  return store;
}
export function setDocumentStore(s: DocumentStore | null) {
  store = s;
}

/** Private container `clinical-photos` (versioning and soft delete, no immutability so mistakes can be hidden). */
let photos: DocumentStore | null = null;
export function photoStore(): DocumentStore {
  photos ??=
    config.storage.driver === 'azure'
      ? new AzureStore(config.storage.photoContainer)
      : new LocalStore(config.storage.photoLocalDir);
  return photos;
}

/** Read-only access to the exercise media; a missing file is null, so the app can show "Bild nicht verfügbar". */
export interface MediaStore {
  get(blobPath: string): Promise<Buffer | null>;
}

const isMissing = (e: unknown) => {
  const err = e as { code?: string; statusCode?: number };
  return err?.code === 'ENOENT' || err?.statusCode === 404;
};

/** Private container `exercise-media`, filled once by an administrator (docs/deployment.md) */
let media: MediaStore | null = null;
export function exerciseMediaStore(): MediaStore {
  if (!media) {
    const store =
      config.storage.driver === 'azure'
        ? new AzureStore(config.storage.exerciseContainer)
        : new LocalStore(config.storage.exerciseLocalDir);
    media = {
      async get(p) {
        try {
          return await store.get(p);
        } catch (e) {
          if (isMissing(e)) return null;
          throw e;
        }
      },
    };
  }
  return media;
}
export function setExerciseMediaStore(s: MediaStore | null) {
  media = s;
}
