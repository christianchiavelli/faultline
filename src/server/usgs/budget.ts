import { setTimeout as sleep } from 'node:timers/promises';
import { serverConfig } from '../config';
import { createRateLimiter } from '../http/rate-limit';
import { UpstreamBusyError } from '../http/upstream';

/**
 * One budget for every USGS call a cache could not answer, for the whole
 * process: event lookups, counts and the pages of an export. However many
 * addresses a script rotates through, the USGS sees at most a burst of ten,
 * then two calls a second. Feeds do not draw on it: they are fetched once a
 * minute per window whatever the traffic.
 */
const budget = createRateLimiter(serverConfig.upstreamRate);
const KEY = 'usgs';

/** For a reader waiting on one answer: out of budget is a 503 they can retry. */
export function spendOrRefuse(): void {
  const decision = budget.take(KEY);
  if (!decision.allowed) throw new UpstreamBusyError(decision.retryAfterSeconds);
}

/**
 * For an export already under way, where a pause between pages is better
 * than a file cut short. Gives up after `maxWaitMs`, or when the reader does.
 */
export async function spendWhenAvailable(signal: AbortSignal, maxWaitMs = 30_000): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    signal.throwIfAborted();
    const decision = budget.take(KEY);
    if (decision.allowed) return;

    const waitMs = decision.retryAfterSeconds * 1000;
    if (Date.now() + waitMs > deadline) throw new UpstreamBusyError(decision.retryAfterSeconds);
    await sleep(waitMs, undefined, { signal });
  }
}
