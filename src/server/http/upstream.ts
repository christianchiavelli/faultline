import { serverConfig } from '../config';

export interface UpstreamResponse {
  readonly status: number;
  /** Parsed JSON for 2xx, the raw text otherwise, `null` when empty. */
  readonly body: unknown;
}

/** The upstream could not give an answer: network failure, timeout or a 5xx after retries. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'UpstreamError';
  }
}

/**
 * This server has used up its budget of upstream calls. Not the USGS's fault,
 * and not worth retrying before `retryAfterSeconds`.
 */
export class UpstreamBusyError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Upstream budget exhausted');
    this.name = 'UpstreamBusyError';
  }
}

export interface UpstreamOptions {
  readonly timeoutMs?: number;
  readonly retries?: number;
  /**
   * Whether a timeout, or a 504 from the USGS's own gateway, is worth another
   * try. Not for a heavy search: one that ran out of time will run out again,
   * and every try costs the USGS the whole search.
   */
  readonly retryTimeouts?: boolean;
  /** Called before every attempt, retries included: the budget of USGS calls is spent per call. */
  readonly beforeAttempt?: () => void | Promise<void>;
  /**
   * Cancels the request and every retry still to come, as when the reader of
   * an export closes the tab. A cancelled call is not an upstream failure.
   */
  readonly signal?: AbortSignal;
  /** Injected in tests. */
  readonly fetchFn?: typeof fetch;
  readonly random?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);
const BASE_BACKOFF_MS = 250;
const MAX_BACKOFF_MS = 2_000;

/**
 * Full-jitter exponential backoff. Without the jitter, every instance that
 * failed together retries together, and a struggling upstream sees the same
 * spike again 250 ms later.
 */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  return Math.round(random() * Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** attempt));
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function getJson(
  url: string,
  options: UpstreamOptions = {},
): Promise<UpstreamResponse> {
  const { status, text } = await request(url, 'application/geo+json, application/json', options);
  if (status < 200 || status >= 300) return { status, body: text || null };
  if (!text) return { status, body: null };
  try {
    return { status, body: JSON.parse(text) as unknown };
  } catch (error) {
    throw new UpstreamError('USGS answered with JSON this server cannot read', status, {
      cause: error,
    });
  }
}

/** For answers that are not JSON, such as the CSV of a catalogue search. */
export async function getText(
  url: string,
  options: UpstreamOptions = {},
): Promise<{ readonly status: number; readonly text: string }> {
  return request(url, 'text/csv, text/plain', options);
}

async function request(
  url: string,
  accept: string,
  options: UpstreamOptions,
): Promise<{ readonly status: number; readonly text: string }> {
  const {
    timeoutMs = 8_000,
    retries = 2,
    retryTimeouts = true,
    beforeAttempt,
    signal,
    fetchFn = fetch,
    random = Math.random,
    sleep = wait,
  } = options;
  const retryable = (status: number) => RETRYABLE.has(status) && (retryTimeouts || status !== 504);

  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    await beforeAttempt?.();
    const hasAttemptsLeft = attempt < retries;
    const timeout = AbortSignal.timeout(timeoutMs);

    let response: Response;
    let text = '';
    try {
      response = await fetchFn(url, {
        headers: { accept, 'user-agent': serverConfig.userAgent },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      // Unread, a body would hold its connection until garbage collection.
      if (retryable(response.status)) await response.body?.cancel();
      // Read here, so a connection that drops or stalls mid-body is one that did not answer.
      else text = await response.text();
    } catch (error) {
      if (signal?.aborted) throw error;
      const timedOut = timeout.aborted;
      if (!hasAttemptsLeft || (timedOut && !retryTimeouts)) {
        const message = timedOut
          ? `USGS did not answer within ${timeoutMs} ms`
          : 'USGS did not answer';
        throw new UpstreamError(message, undefined, { cause: error });
      }
      await sleep(backoffDelay(attempt, random));
      continue;
    }

    if (retryable(response.status)) {
      if (!hasAttemptsLeft)
        throw new UpstreamError(`USGS answered ${response.status}`, response.status);
      await sleep(backoffDelay(attempt, random));
      continue;
    }

    return { status: response.status, text };
  }
}

/**
 * An error and every cause under it, on one line: "USGS did not answer ←
 * fetch failed ← connect ECONNREFUSED 127.0.0.1:9". For an expected failure,
 * logged every time it happens, where a stack trace would bury the log.
 */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  for (let current = error; current !== undefined && parts.length < 5;) {
    parts.push(current instanceof Error ? current.message || current.name : String(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join(' ← ');
}
