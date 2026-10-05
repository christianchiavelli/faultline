import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Every story as a test, in Chromium: rendered, its play function run, and
 * the result audited by axe, which fails the test on a violation.
 *
 * Motion stays on, as it is for most visitors: a play function that checks a
 * dialog the instant it opens fails here, not in someone's Storybook. Axe runs
 * once Storybook has settled every animation at its end.
 */
export default defineConfig({
  plugins: [storybookTest({ configDir: import.meta.dirname })],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
