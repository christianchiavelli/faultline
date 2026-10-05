import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Every story as a test, in Chromium: rendered, its play function run, and
 * the result audited by axe, which fails the test on a violation.
 *
 * The browser asks for reduced motion, which zeroes the motion roles in
 * `tokens.css`: a check made the moment a dialog opens finds it open, not
 * halfway through fading in.
 */
export default defineConfig({
  plugins: [storybookTest({ configDir: import.meta.dirname })],
  test: {
    name: 'storybook',
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({ contextOptions: { reducedMotion: 'reduce' } }),
      instances: [{ browser: 'chromium' }],
    },
  },
});
