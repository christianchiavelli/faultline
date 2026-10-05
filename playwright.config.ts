import { defineConfig, devices } from '@playwright/test';
import { APP_PORT, DEAD_PORT, OUTAGE_PORT, STUB_PORT } from './e2e/support/ports';
import { appServer, usgsStub } from './e2e/support/servers';

/**
 * End to end against the production build: the Express server, SSR and
 * hydration as they ship, with the USGS replaced by a stub that serves a known
 * day. A second server points at nothing, to exercise the outage path.
 *
 *   pnpm e2e    builds, then runs both viewports
 *
 * The Web Vitals are measured apart, one visit at a time (`playwright.vitals.config.ts`).
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: 'vitals/**',
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
    usgsStub(),
    appServer(APP_PORT, `http://localhost:${STUB_PORT}`),
    appServer(OUTAGE_PORT, `http://127.0.0.1:${DEAD_PORT}`),
  ],
});
