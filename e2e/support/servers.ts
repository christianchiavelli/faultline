import { STUB_PORT } from './ports';

/**
 * The production server on `port`, its USGS at `usgs`. The suite comes from
 * one address, far faster than any reader, and in more tabs, so the limits
 * per client are lifted.
 */
export const appServer = (port: number, usgs: string) => ({
  command: 'node dist/faultline/server/server.mjs',
  port,
  reuseExistingServer: false,
  timeout: 60_000,
  env: {
    PORT: String(port),
    USGS_BASE_URL: usgs,
    RATE_LIMIT_BURST: '100000',
    STREAMS_PER_CLIENT: '100000',
  },
});

/** The USGS stub, serving its own awkward day, or the day recorded in `day` (see `usgs-stub.ts`). */
export const usgsStub = (day?: string) => ({
  command: 'node e2e/support/usgs-stub.ts',
  port: STUB_PORT,
  reuseExistingServer: false,
  env: { PORT: String(STUB_PORT), ...(day ? { STUB_DAY: day } : {}) },
});
