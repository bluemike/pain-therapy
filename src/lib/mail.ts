import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';

/** Email delivery (design D9): Microsoft Graph sendMail in Azure, a local outbox folder in development. */
export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  attachment: { name: string; contentType: string; data: Buffer };
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}

class OutboxMailer implements Mailer {
  async send(mail: OutgoingMail) {
    const dir = path.resolve(config.mail.outboxDir);
    await mkdir(dir, { recursive: true });
    const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}`;
    await writeFile(
      path.join(dir, `${base}.json`),
      JSON.stringify(
        { ...mail, attachment: { name: mail.attachment.name, bytes: mail.attachment.data.length } },
        null,
        2,
      ),
    );
    await writeFile(path.join(dir, `${base}-${mail.attachment.name}`), mail.attachment.data);
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
            attachments: [
              {
                '@odata.type': '#microsoft.graph.fileAttachment',
                name: mail.attachment.name,
                contentType: mail.attachment.contentType,
                contentBytes: mail.attachment.data.toString('base64'),
              },
            ],
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
