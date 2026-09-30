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
  return { status, body: text ? (JSON.parse(text) as unknown) : null };
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
    signal,
    fetchFn = fetch,
    random = Math.random,
    sleep = wait,
  } = options;

  for (let attempt = 0; ; attempt++) {
    signal?.throwIfAborted();
    const hasAttemptsLeft = attempt < retries;
    const timeout = AbortSignal.timeout(timeoutMs);

    let response: Response;
    try {
      response = await fetchFn(url, {
        headers: { accept, 'user-agent': serverConfig.userAgent },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!hasAttemptsLeft)
        throw new UpstreamError('USGS did not answer', undefined, { cause: error });
      await sleep(backoffDelay(attempt, random));
      continue;
    }

    if (RETRYABLE.has(response.status)) {
      // Unread, the body would hold its connection until garbage collection.
      await response.body?.cancel();
      if (!hasAttemptsLeft)
        throw new UpstreamError(`USGS answered ${response.status}`, response.status);
      await sleep(backoffDelay(attempt, random));
      continue;
    }

    return { status: response.status, text: await response.text() };
  }
}
