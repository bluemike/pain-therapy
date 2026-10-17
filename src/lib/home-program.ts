/**
 * home-program: repetitions and time per exercise (iteration 3, design D3, D4). Moved to @pain-therapy/shared in
 * iteration 4 (design D11) so the patient zone computes the same values; re-exported here for the practice app.
 */
export * from '@pain-therapy/shared/home-program';

import { scheduleParts, type Schedule } from '@pain-therapy/shared/home-program';

type Translate = (key: string, values?: Record<string, string | number>) => string;

/**
 * "1× pro Tag · Mo Di Mi Do Fr" (home-schedule, iteration 8). `t` translates in the namespace "home"; it is typed
 * loosely so server and client translators both fit.
 */
export function scheduleText(s: Schedule, t: unknown): string {
  const tr = t as Translate;
  const p = scheduleParts(s);
  const days = p.everyDay ? tr('everyDay') : p.days.map((d) => tr(`short_${d}`)).join(' ');
  return `${tr('timesPerDayN', { n: p.timesPerDay })} · ${days}`;
}
