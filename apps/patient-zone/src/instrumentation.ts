/** Masks tokens of access links in every server log line (design D14, src/lib/log.ts) */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { installLogMasking } = await import('./lib/log');
    installLogMasking();
  }
}
