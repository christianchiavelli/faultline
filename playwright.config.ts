import { defineConfig, devices } from '@playwright/test';
import { APP_PORT, OUTAGE_PORT, STUB_PORT } from './e2e/support/ports';

/**
 * End to end against the production build: the Express server, SSR and
 * hydration as they ship, with the USGS replaced by a stub that serves a known
 * day. A second server points at nothing, to exercise the outage path.
 *
 *   pnpm e2e    builds, then runs both viewports
 */
const server = (port: number, usgs: string) => ({
  command: 'node dist/faultline/server/server.mjs',
  port,
  reuseExistingServer: false,
  timeout: 60_000,
  // The suite comes from one address, far faster than any reader.
  env: { PORT: String(port), USGS_BASE_URL: usgs, RATE_LIMIT_BURST: '100000' },
});

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

  webServer: [
    {
      command: 'node e2e/support/usgs-stub.ts',
      port: STUB_PORT,
      reuseExistingServer: false,
      env: { PORT: String(STUB_PORT) },
    },
    server(APP_PORT, `http://localhost:${STUB_PORT}`),
    // Port 9 is discard: nothing answers, so every USGS call fails fast.
    server(OUTAGE_PORT, 'http://127.0.0.1:9'),
  ],
});
