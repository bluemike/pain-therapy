import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SmsPurpose } from '@prisma/client';
import { authDb } from './db';
import { config } from './config';
import { maskMobile } from './phone';

/**
 * SMS (iteration 16, design D2): invitation links, codes and the notice that a mailbox access is ready. ASPSMS in
 * Azure, an outbox folder in development and tests. Every SMS is logged with the masked number, never its text.
 * Limits against costs: 5 per invitation and hour, 50 per day for the whole platform.
 */

export interface SmsSender {
  send(to: string, text: string): Promise<void>;
}

class OutboxSender implements SmsSender {
  async send(to: string, text: string) {
    const dir = path.resolve(config.sms.outboxDir);
    await mkdir(dir, { recursive: true });
    const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${to.replace(/\D/g, '')}`;
    await writeFile(path.join(dir, `${base}.json`), JSON.stringify({ to, text }, null, 2));
  }
}

class FailingSender implements SmsSender {
  async send(): Promise<void> {
    throw new Error('SMS delivery disabled (SMS_DRIVER=fail)');
  }
}

/** JSON interface of aspsms.com: StatusCode "1" means accepted */
class AspsmsSender implements SmsSender {
  async send(to: string, text: string) {
    const { url, userKey, password, originator } = config.sms.aspsms;
    if (!userKey || !password) throw new Error('ASPSMS_USERKEY or ASPSMS_PASSWORD is not set');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        UserName: userKey,
        Password: password,
        Originator: originator,
        Recipients: [to],
        MessageText: text,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json().catch(() => null)) as { StatusCode?: string; StatusInfo?: string } | null;
    if (!res.ok || body?.StatusCode !== '1')
      throw new Error(`ASPSMS ${res.status}: ${body?.StatusInfo ?? 'no answer'}`.slice(0, 200));
  }
}

let sender: SmsSender | null = null;
export function getSmsSender(): SmsSender {
  sender ??=
    config.sms.driver === 'aspsms'
      ? new AspsmsSender()
      : config.sms.driver === 'fail'
        ? new FailingSender()
        : new OutboxSender();
  return sender;
}
export function setSmsSender(s: SmsSender | null) {
  sender = s;
}

export class SmsLimitError extends Error {
  constructor(public code: 'smsInvitationLimit' | 'smsDayLimit') {
    super(code);
  }
}

/** Throws SmsLimitError when a limit is reached; nothing is sent then */
export async function assertSmsAllowed(invitationId?: string | null) {
  const now = Date.now();
  const today = await authDb.smsMessage.count({
    where: { status: 'SENT', createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) } },
  });
  if (today >= config.sms.perDay) throw new SmsLimitError('smsDayLimit');
  if (invitationId) {
    const hour = await authDb.smsMessage.count({
      where: { invitationId, status: 'SENT', createdAt: { gte: new Date(now - 60 * 60 * 1000) } },
    });
    if (hour >= config.sms.perInvitationPerHour) throw new SmsLimitError('smsInvitationLimit');
  }
}

/**
 * Sends one SMS within the limits and logs it. Returns false when the provider refused it (logged as FAILED); throws
 * SmsLimitError when a limit is reached.
 */
export async function sendSms(input: {
  to: string;
  text: string;
  purpose: SmsPurpose;
  invitationId?: string | null;
  userId?: string | null;
}): Promise<boolean> {
  await assertSmsAllowed(input.invitationId);
  let error: string | null = null;
  try {
    await getSmsSender().send(input.to, input.text);
  } catch (e) {
    error = (e instanceof Error ? e.message : String(e)).slice(0, 300);
    console.error('SMS could not be sent', error);
  }
  await authDb.smsMessage.create({
    data: {
      toMasked: maskMobile(input.to),
      purpose: input.purpose,
      status: error ? 'FAILED' : 'SENT',
      error,
      invitationId: input.invitationId ?? null,
      userId: input.userId ?? null,
    },
  });
  return !error;
}
