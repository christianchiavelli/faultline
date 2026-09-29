/**
 * Runtime settings, read once at start-up. Every one has a default, so a fresh
 * clone runs with `pnpm dev` and no `.env`.
 */
export const serverConfig = {
  usgsBaseUrl: process.env['USGS_BASE_URL'] ?? 'https://earthquake.usgs.gov',
  /**
   * The USGS asks nothing of clients, but an identifiable agent is how a
   * provider reaches you before it reaches for a block list.
   */
  userAgent:
    process.env['UPSTREAM_USER_AGENT'] ??
    'Faultline/0.1 (+https://github.com/christianchiavelli/faultline)',
} as const;
