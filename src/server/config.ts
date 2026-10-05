/**
 * Runtime settings, read once at start-up. Every one has a default, so a fresh
 * clone runs with `pnpm dev` and no `.env`. One set to something it cannot
 * be stops the server before it starts: a typo would otherwise run, silently,
 * on the default.
 */
export function readServerConfig(env: NodeJS.ProcessEnv) {
  return {
    usgsBaseUrl: env['USGS_BASE_URL'] ?? 'https://earthquake.usgs.gov',
    /**
     * The USGS asks nothing of clients, but an identifiable agent is how a
     * provider reaches you before it reaches for a block list.
     */
    userAgent:
      env['UPSTREAM_USER_AGENT'] ??
      'Faultline/0.1 (+https://github.com/christianchiavelli/faultline)',
    /**
     * Express `trust proxy`, so the client address comes from `X-Forwarded-For`
     * behind a proxy. Off by default: trusting the header without a proxy in
     * front would let anyone pick their own address and dodge the rate limit.
     */
    trustProxy: parseTrustProxy(env['TRUST_PROXY']),
    /** Per client: bursts of 60, then one request a second. Page renders and API calls both count. */
    clientRate: {
      capacity: wholeNumber(env, 'RATE_LIMIT_BURST', 60),
      refillPerSecond: positiveNumber(env, 'RATE_LIMIT_PER_SECOND', 1),
    },
    /**
     * Live feeds one client may follow at once. A tab follows one while it is in
     * view, so a reader needs one or two; the rest is for an address a household
     * or an office shares.
     */
    streamsPerClient: wholeNumber(env, 'STREAMS_PER_CLIENT', 20),
    /**
     * For the whole process: event lookups the cache could not answer. Every
     * visitor shares it, so however many addresses a script rotates through,
     * the USGS sees at most a burst of ten, then two lookups a second.
     */
    upstreamRate: { capacity: 10, refillPerSecond: 2 },
  } as const;
}

export const serverConfig = readServerConfig(process.env);

function positiveNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = env[name];
  if (value === undefined || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${name} must be a number above zero, not "${value}"`);
  }
  return number;
}

function wholeNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const number = positiveNumber(env, name, fallback);
  if (!Number.isInteger(number))
    throw new Error(`${name} must be a whole number, not "${env[name]}"`);
  return number;
}

/** Express reads a number as a hop count and a string as addresses, so `1` must not stay a string. */
function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === '' || value === 'false') return false;
  if (value === 'true') return true;
  return /^\d+$/.test(value) ? Number(value) : value;
}
