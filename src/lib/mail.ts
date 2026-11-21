import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config';
import { mailHtml } from './mail-html';

/**
 * Email delivery (iteration 12, design D7): SMTP at Infomaniak in Azure, a local outbox folder in development. Mails
 * carry only links, never a document: the Mailer knows no attachments. The sender is noreply@ with the display name of
 * the practice; answers go to the practice (Reply-To).
 */
export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  /** Display name of the sender, e.g. the practice; default "Pain Therapy Online" */
  fromName?: string;
  /** Contact address of the practice */
  replyTo?: string;
  /** Phrases set in bold in the HTML part (iteration 13), e.g. the practice name or a code; links are always bold */
  bold?: string[];
}

export interface Mailer {
  send(mail: OutgoingMail): Promise<void>;
}

class OutboxMailer implements Mailer {
  async send(mail: OutgoingMail) {
    const dir = path.resolve(config.mail.outboxDir);
    await mkdir(dir, { recursive: true });
    const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}`;
    const from = `${mail.fromName ?? config.mail.fromName} <${config.mail.from}>`;
    const html = mailHtml(mail.text, mail.bold);
    await writeFile(path.join(dir, `${base}.json`), JSON.stringify({ from, ...mail, html }, null, 2));
  }
}

class FailingMailer implements Mailer {
  async send(): Promise<void> {
    throw new Error('Mail delivery disabled (MAIL_DRIVER=fail)');
  }
}

/** Header-safe display name: no line breaks or quotes, at most 70 characters */
const displayName = (name: string) =>
  name
    .replace(/[\r\n"<>]/g, ' ')
    .trim()
    .slice(0, 70) || config.mail.fromName;

class SmtpMailer implements Mailer {
  private transport: Promise<import('nodemailer').Transporter> | null = null;

  private connect() {
    const { host, port, user, password } = config.mail.smtp;
    if (!password) throw new Error('SMTP_PASSWORD is not set');
    this.transport ??= import('nodemailer').then((m) =>
      (m.default ?? m).createTransport({
        host,
        port,
        // 465: TLS from the start; 587: STARTTLS, required
        secure: port === 465,
        requireTLS: port !== 465,
        auth: { user, pass: password },
        // EHLO with the sender domain instead of the container's random host name, which spam filters count against us
        name: config.mail.from.split('@')[1] || undefined,
      }),
    );
    return this.transport;
  }

  async send(mail: OutgoingMail) {
    const transport = await this.connect();
    await transport.sendMail({
      from: { name: displayName(mail.fromName ?? config.mail.fromName), address: config.mail.from },
      to: mail.to,
      replyTo: mail.replyTo || undefined,
      subject: mail.subject,
      text: mail.text,
      html: mailHtml(mail.text, mail.bold),
      // Transactional mail: tells mail servers not to send auto-replies back to noreply@
      headers: { 'Auto-Submitted': 'auto-generated' },
    });
  }
}

let mailer: Mailer | null = null;
export function getMailer(): Mailer {
  mailer ??=
    config.mail.driver === 'smtp'
      ? new SmtpMailer()
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
