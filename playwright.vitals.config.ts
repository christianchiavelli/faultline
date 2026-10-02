import { defineConfig } from '@playwright/test';
import { APP_PORT, STUB_PORT } from './e2e/support/ports';
import { appServer, usgsStub } from './e2e/support/servers';

/**
 * The Core Web Vitals of the production build, on the phone and connection
 * of Lighthouse's mobile run, against a real day of the catalogue recorded
 * for the purpose (`e2e/vitals/day.json`). Each page's median is held
 * against the last accepted measurement (`e2e/vitals/baseline.json`).
 *
 *   pnpm vitals    builds, then measures every page
 *
 * One visit at a time, and nothing recorded on the side: a measurement
 * shares the machine with nothing, not even a trace of itself.
 */
export default defineConfig({
  testDir: './e2e/vitals',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  // A measurement retried until it passes measures nothing.
  retries: 0,
  timeout: 10 * 60_000,
  // Four times slower, on slow 4G, a page takes longer to answer than the suite's default allows.
  expect: { timeout: 20_000 },
  reporter: [[process.env['CI'] ? 'github' : 'list'], ['./e2e/vitals/reporter.ts']],

  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    // Chrome itself, headless, rather than the lighter shell the suite runs in: it paints the way Chrome does.
    channel: 'chromium',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },

  webServer: [
    usgsStub('e2e/vitals/day.json'),
    appServer(APP_PORT, `http://localhost:${STUB_PORT}`),
  ],
});
