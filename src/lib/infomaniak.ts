import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { connect } from 'node:tls';
import { config } from './config';

/**
 * Mail Service of Infomaniak (iteration 16, design D3, D6): list, create and delete mailboxes of pain-therapy.online
 * with the API token of api@pain-therapy.online. The API cannot create passwords that work for IMAP and SMTP (test of
 * 22.11.2026): device passwords come from the Manager and are only checked here with an IMAP login.
 *
 * Without a token outside Azure a fake keeps the mailboxes in a JSON file (development, end-to-end tests); its IMAP
 * check accepts the passwords stored there by `fakeAddDevice`.
 */

export class InfomaniakError extends Error {
  constructor(
    public code: 'disabled' | 'unavailable' | 'taken' | 'notFound',
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

export interface MailService {
  list(): Promise<string[]>;
  create(localPart: string, password: string): Promise<void>;
  remove(localPart: string): Promise<void>;
  /** true when IMAP accepts address and password */
  checkLogin(address: string, password: string): Promise<boolean>;
}

const mode = (): 'api' | 'fake' | 'disabled' => {
  const { token, mailHostingId } = config.mailboxes;
  if (token && mailHostingId) return 'api';
  return process.env.CONTAINER_APP_NAME ? 'disabled' : 'fake';
};

export const mailboxesEnabled = () => mode() !== 'disabled';

type ApiAnswer<T> = { result?: string; data?: T; error?: { code?: string; description?: string } };

class ApiMailService implements MailService {
  private async call<T>(method: string, suffix: string, body?: unknown): Promise<T> {
    const { apiUrl, token, mailHostingId } = config.mailboxes;
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/1/mail_hostings/${encodeURIComponent(mailHostingId)}${suffix}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      throw new InfomaniakError('unavailable', e instanceof Error ? e.message : String(e));
    }
    const json = (await res.json().catch(() => null)) as ApiAnswer<T> | null;
    if (res.status === 404) throw new InfomaniakError('notFound');
    if (!res.ok || json?.result === 'error') {
      const detail = `${res.status} ${json?.error?.code ?? ''} ${json?.error?.description ?? ''}`.trim();
      if (/exist|already|taken/i.test(detail)) throw new InfomaniakError('taken', detail);
      throw new InfomaniakError('unavailable', detail.slice(0, 200));
    }
    return json?.data as T;
  }

  async list() {
    const data = await this.call<{ mailbox_name: string }[]>('GET', '/mailboxes');
    return (data ?? []).map((m) => m.mailbox_name.toLowerCase());
  }

  async create(localPart: string, password: string) {
    await this.call('POST', '/mailboxes', { mailbox_name: localPart, password, link_to_current_user: false });
  }

  async remove(localPart: string) {
    await this.call('DELETE', `/mailboxes/${encodeURIComponent(localPart)}`);
  }

  checkLogin(address: string, password: string) {
    return imapLogin(config.mailboxes.imapHost, config.mailboxes.imapPort, address, password);
  }
}

type FakeState = { mailboxes: string[]; devices: Record<string, string[]> };

class FakeMailService implements MailService {
  private file = () => path.resolve(config.mailboxes.fakeFile);

  async read(): Promise<FakeState> {
    try {
      const s = JSON.parse(await readFile(this.file(), 'utf8')) as Partial<FakeState>;
      return { mailboxes: s.mailboxes ?? [], devices: s.devices ?? {} };
    } catch {
      return { mailboxes: ['admin', 'api', 'noreply'], devices: {} };
    }
  }

  async write(s: FakeState) {
    await mkdir(path.dirname(this.file()), { recursive: true });
    await writeFile(this.file(), JSON.stringify(s, null, 2));
  }

  async list() {
    return (await this.read()).mailboxes;
  }

  async create(localPart: string) {
    const s = await this.read();
    if (s.mailboxes.includes(localPart)) throw new InfomaniakError('taken');
    s.mailboxes.push(localPart);
    await this.write(s);
  }

  async remove(localPart: string) {
    const s = await this.read();
    if (!s.mailboxes.includes(localPart)) throw new InfomaniakError('notFound');
    s.mailboxes = s.mailboxes.filter((m) => m !== localPart);
    delete s.devices[localPart];
    await this.write(s);
  }

  async checkLogin(address: string, password: string) {
    const s = await this.read();
    const local = address.split('@')[0] ?? '';
    return s.mailboxes.includes(local) && (s.devices[local] ?? []).includes(password);
  }

  /** Development and tests: what the Manager does with «Gerät hinzufügen» */
  async addDevice(localPart: string, password: string) {
    const s = await this.read();
    (s.devices[localPart] ??= []).push(password);
    await this.write(s);
  }
}

class DisabledMailService implements MailService {
  private no(): never {
    throw new InfomaniakError('disabled');
  }
  list = async () => this.no();
  create = async () => this.no();
  remove = async () => this.no();
  checkLogin = async () => this.no();
}

let service: MailService | null = null;
export function mailService(): MailService {
  service ??=
    mode() === 'api' ? new ApiMailService() : mode() === 'fake' ? new FakeMailService() : new DisabledMailService();
  return service;
}
export function setMailService(s: MailService | null) {
  service = s;
}

/** Only for development and tests (fake mode) */
export async function fakeAddDevice(localPart: string, password: string) {
  const s = mailService();
  if (!(s instanceof FakeMailService)) throw new Error('Only with the fake mail service');
  await s.addDevice(localPart, password);
}

/** Link into the Infomaniak Manager for the platform admin (D4 step 1) */
export function managerUrl(): string {
  const { accountId, mailHostingId } = config.mailboxes;
  return accountId && mailHostingId
    ? `https://manager.infomaniak.com/v3/mail/${accountId}/mail-service/${mailHostingId}/mailboxes/list`
    : 'https://manager.infomaniak.com';
}

/** IMAP quoted string: backslash and double quote escaped; no line breaks allowed */
export function imapQuote(s: string): string | null {
  if (/[\r\n\0]/.test(s)) return null;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Minimal IMAP login over TLS: reads the greeting, sends LOGIN and LOGOUT. true for "a1 OK", false for "a1 NO" or
 * "a1 BAD"; throws InfomaniakError('unavailable') when the server cannot be reached.
 */
export function imapLogin(host: string, port: number, user: string, password: string): Promise<boolean> {
  const u = imapQuote(user);
  const p = imapQuote(password);
  if (!u || !p) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    let buf = '';
    let greeted = false;
    let settled = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sock.end();
      fn();
    };
    const sock = connect({ host, port, servername: host }, () => undefined);
    const timer = setTimeout(() => done(() => reject(new InfomaniakError('unavailable', 'IMAP timeout'))), 15000);
    sock.setEncoding('utf8');
    sock.on('data', (chunk: string) => {
      buf += chunk;
      if (!greeted && /^\* (OK|PREAUTH)/m.test(buf)) {
        greeted = true;
        buf = '';
        sock.write(`a1 LOGIN ${u} ${p}\r\n`);
        return;
      }
      const m = /^a1 (OK|NO|BAD)/m.exec(buf);
      if (m) {
        if (m[1] === 'OK') sock.write('a2 LOGOUT\r\n');
        done(() => resolve(m[1] === 'OK'));
      }
    });
    sock.on('error', (e) => done(() => reject(new InfomaniakError('unavailable', e.message))));
  });
}
