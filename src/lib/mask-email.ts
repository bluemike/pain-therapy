/** Iteration 19 (design D2): an address shown on the open invitation page, c***@ayanta.ch */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}
