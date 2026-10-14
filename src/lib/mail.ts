import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

/**
 * Email delivery (design D9): Microsoft Graph sendMail in Azure, a local outbox folder in development. The link to
 * the patient zone goes without attachment (iteration 4, design D4).
 */
export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  attachment?: { name: string; contentType: string; data: Buffer };
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}

class OutboxMailer implements Mailer {
  async send(mail: OutgoingMail) {
    const dir = path.resolve(config.mail.outboxDir);
    await mkdir(dir, { recursive: true });
    const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}`;
    const { attachment } = mail;
    await writeFile(
      path.join(dir, `${base}.json`),
      JSON.stringify(
        { ...mail, attachment: attachment ? { name: attachment.name, bytes: attachment.data.length } : undefined },
        null,
        2,
      ),
    );
    if (attachment) await writeFile(path.join(dir, `${base}-${attachment.name}`), attachment.data);
  }
}

class FailingMailer implements Mailer {
  async send(): Promise<void> {
    throw new Error('Mail delivery disabled (MAIL_DRIVER=fail)');
  }
}

class GraphMailer implements Mailer {
  async send(mail: OutgoingMail) {
    const { DefaultAzureCredential } = await import('@azure/identity');
    const token = await new DefaultAzureCredential().getToken('https://graph.microsoft.com/.default');
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.mail.sender)}/sendMail`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: mail.subject,
            body: { contentType: 'Text', content: mail.text },
            toRecipients: [{ emailAddress: { address: mail.to } }],
            attachments: mail.attachment
              ? [
                  {
                    '@odata.type': '#microsoft.graph.fileAttachment',
                    name: mail.attachment.name,
                    contentType: mail.attachment.contentType,
                    contentBytes: mail.attachment.data.toString('base64'),
                  },
                ]
              : [],
          },
          saveToSentItems: true,
        }),
      },
    );
    if (!res.ok) throw new Error(`Graph sendMail ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

let mailer: Mailer | null = null;
export function getMailer(): Mailer {
  mailer ??=
    config.mail.driver === 'graph'
      ? new GraphMailer()
      : config.mail.driver === 'fail'
        ? new FailingMailer()
        : new OutboxMailer();
  return mailer;
}
export function setMailer(m: Mailer | null) {
  mailer = m;
}

/**
 * Sends a mail with up to `config.mail.maxAttempts` attempts and exponential back-off (consent-documents:
 * Fehlgeschlagener Versand). `onFailedAttempt` records each failed attempt, e.g. in the delivery row.
 */
export async function sendWithRetry(
  mail: OutgoingMail,
  opts: { retryDelayMs?: number; onFailedAttempt?: (attempt: number, error: string) => Promise<void> } = {},
): Promise<{ ok: true; attempts: number } | { ok: false; attempts: number; lastError: string }> {
  const delay = opts.retryDelayMs ?? config.mail.retryDelayMs;
  let lastError = '';
  for (let attempt = 1; attempt <= config.mail.maxAttempts; attempt++) {
    try {
      await getMailer().send(mail);
      return { ok: true, attempts: attempt };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      await opts.onFailedAttempt?.(attempt, lastError);
      if (attempt < config.mail.maxAttempts) await new Promise((r) => setTimeout(r, delay * 2 ** (attempt - 1)));
    }
  }
  return { ok: false, attempts: config.mail.maxAttempts, lastError };
}
