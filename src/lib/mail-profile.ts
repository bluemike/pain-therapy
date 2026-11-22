import { randomUUID } from 'node:crypto';

/**
 * Apple configuration profile for Mail on iPad, iPhone and Mac (iteration 16, design D4): one IMAP account with
 * address, server and device password, so the mailbox works after one tap and «Installieren». Built on demand, never
 * written to disk.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Value = string | number | boolean | Value[] | { [k: string]: Value };

function plist(v: Value, indent = ''): string {
  const i = `${indent}  `;
  if (typeof v === 'string') return `${indent}<string>${esc(v)}</string>`;
  if (typeof v === 'number') return `${indent}<integer>${v}</integer>`;
  if (typeof v === 'boolean') return `${indent}<${v}/>`;
  if (Array.isArray(v)) return `${indent}<array>\n${v.map((x) => plist(x, i)).join('\n')}\n${indent}</array>`;
  const entries = Object.entries(v).map(([k, x]) => `${i}<key>${esc(k)}</key>\n${plist(x, i)}`);
  return `${indent}<dict>\n${entries.join('\n')}\n${indent}</dict>`;
}

export function mailProfile(input: {
  address: string;
  password: string;
  name: string;
  host: string;
  imapPort: number;
  smtpPort: number;
  /** e.g. "Pain Therapy" */
  label: string;
  /** Reverse-DNS prefix, e.g. "online.pain-therapy" */
  idPrefix: string;
}): string {
  const id = `${input.idPrefix}.mail.${input.address.replace(/[^a-z0-9]/gi, '-')}`;
  const account: Value = {
    PayloadType: 'com.apple.mail.managed',
    PayloadVersion: 1,
    PayloadIdentifier: `${id}.account`,
    PayloadUUID: randomUUID(),
    PayloadDisplayName: input.address,
    EmailAccountDescription: `${input.label} (${input.address})`,
    EmailAccountName: input.name,
    EmailAccountType: 'EmailTypeIMAP',
    EmailAddress: input.address,
    IncomingMailServerAuthentication: 'EmailAuthPassword',
    IncomingMailServerHostName: input.host,
    IncomingMailServerPortNumber: input.imapPort,
    IncomingMailServerUseSSL: true,
    IncomingMailServerUsername: input.address,
    IncomingPassword: input.password,
    OutgoingMailServerAuthentication: 'EmailAuthPassword',
    OutgoingMailServerHostName: input.host,
    OutgoingMailServerPortNumber: input.smtpPort,
    OutgoingMailServerUseSSL: true,
    OutgoingMailServerUsername: input.address,
    OutgoingPassword: input.password,
    OutgoingPasswordSameAsIncomingPassword: true,
  };
  const root: Value = {
    PayloadContent: [account],
    PayloadDisplayName: `${input.label}: E-Mail ${input.address}`,
    PayloadDescription: `Richtet das Postfach ${input.address} in Apple Mail ein.`,
    PayloadIdentifier: id,
    PayloadType: 'Configuration',
    PayloadUUID: randomUUID(),
    PayloadVersion: 1,
    PayloadRemovalDisallowed: false,
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${plist(root)}
</plist>
`;
}
