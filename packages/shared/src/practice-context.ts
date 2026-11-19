import { AsyncLocalStorage } from 'node:async_hooks';
import type { PrismaClient } from '@prisma/client';

/**
 * Practice context for row-level security (iteration 12, design D1).
 *
 * Every table with practice data has a policy `"practiceId" = current_setting('app.practice_id')` (prisma/rls.sql),
 * and new rows take their practiceId from the same setting by column default. This module sets the setting for each
 * database call:
 * - a single query runs in a short batch transaction `[set_config(...), query]`;
 * - an interactive `db.$transaction(fn)` sets it once as the first statement, then runs fn unchanged.
 *
 * The practice comes from `runInPractice()` (jobs, internal routes, tests) or else from the resolver the app installs
 * (the signed-in user's practice, the zone session's practice). Without a practice the setting stays empty: reads
 * return no rows and inserts fail, so a forgotten context fails closed.
 */

type Ctx = { practiceId: string | null; inTx?: boolean };

const store = new AsyncLocalStorage<Ctx>();

export type PracticeResolver = () => Promise<string | null>;

/** Runs fn with the given practice, ignoring the app's resolver. */
export function runInPractice<T>(practiceId: string, fn: () => Promise<T>): Promise<T> {
  // Await inside the context: Prisma queries are lazy and run when awaited, so a query returned unawaited from fn
  // would otherwise run outside the practice
  return store.run({ practiceId }, async () => await fn());
}

/** The practice set by runInPractice(), if any (for code that needs the id itself, e.g. blob paths). */
export function explicitPracticeId(): string | null {
  return store.getStore()?.practiceId ?? null;
}

/**
 * Wraps a Prisma client so that every call carries the practice. `resolve` is asked only when no runInPractice()
 * is active; it must not throw (return null instead).
 */
export function withPracticeContext<C extends PrismaClient>(base: C, resolve: PracticeResolver): C {
  const practiceOf = async (): Promise<string | null> => {
    const ctx = store.getStore();
    if (ctx) return ctx.practiceId;
    try {
      return await resolve();
    } catch {
      return null;
    }
  };

  const extended = base.$extends({
    query: {
      async $allOperations({ args, query }) {
        if (store.getStore()?.inTx) return query(args);
        const practiceId = await practiceOf();
        if (!practiceId) return query(args);
        const [, result] = await base.$transaction([
          base.$executeRaw`SELECT set_config('app.practice_id', ${practiceId}, true)`,
          query(args) as never,
        ]);
        return result;
      },
    },
  }) as unknown as C;

  const interactive = async (fn: (tx: unknown) => Promise<unknown>, options?: unknown) => {
    const practiceId = await practiceOf();
    return store.run({ practiceId, inTx: true }, () =>
      (extended.$transaction as (f: (tx: unknown) => Promise<unknown>, o?: unknown) => Promise<unknown>)(async (tx) => {
        if (practiceId)
          await (tx as PrismaClient).$executeRaw`SELECT set_config('app.practice_id', ${practiceId}, true)`;
        return fn(tx);
      }, options),
    );
  };

  return new Proxy(extended, {
    get(target, prop, receiver) {
      if (prop === '$transaction') {
        return (arg: unknown, options?: unknown) =>
          typeof arg === 'function'
            ? interactive(arg as (tx: unknown) => Promise<unknown>, options)
            : (target.$transaction as (a: unknown, o?: unknown) => Promise<unknown>)(arg, options);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
