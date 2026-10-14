import { maskTokens } from '@pain-therapy/shared/tokens';

/**
 * Token in Logs maskiert (design D14): every console line of the server goes through maskTokens, so an address
 * "/l/<token>" in an error message or stack never reaches the container logs. Installed by src/instrumentation.ts.
 */
export function installLogMasking(target: Pick<Console, 'log' | 'info' | 'warn' | 'error' | 'debug'> = console) {
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = target[level].bind(target);
    target[level] = (...args: unknown[]) => original(...args.map(maskArg));
  }
}

function maskArg(a: unknown): unknown {
  if (typeof a === 'string') return maskTokens(a);
  if (a instanceof Error) {
    const masked = new Error(maskTokens(a.message));
    masked.name = a.name;
    masked.stack = a.stack ? maskTokens(a.stack) : undefined;
    return masked;
  }
  if (a && typeof a === 'object') {
    try {
      return maskTokens(JSON.stringify(a));
    } catch {
      return '[unserializable]';
    }
  }
  return a;
}
