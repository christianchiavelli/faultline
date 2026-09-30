import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { scrollThrough, settled, waitForHydration } from './support/page';

const PAGES = ['/', '/?min=all', '/quakes/us7000big', '/quakes/us7000tonga', '/quakes/zz404'];
const THEMES = ['paper', 'film'] as const;

/** The export dialog in its two fullest states: offering suggestions, and a file near an event. */
const DIALOGS = [
  { path: '/?min=all', button: 'Export…', period: '30 days' },
  { path: '/quakes/us7000big', button: 'Export the events near this one…', period: null },
];

/** Every violation, readable on failure: which rule, and where. */
async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return violations.map(({ id, nodes }) => ({
    id,
    targets: nodes.map((node) => node.target.join(' ')),
  }));
}

for (const theme of THEMES) {
  test.describe(theme, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await context.addCookies([{ name: 'fl-theme', value: theme, url: baseURL! }]);
    });

    for (const path of PAGES) {
      test(`${path} meets WCAG 2.2 AA`, async ({ page }) => {
        await page.goto(path);
        await scrollThrough(page);

        expect(await audit(page)).toEqual([]);
      });
    }

    for (const { path, button, period } of DIALOGS) {
      test(`the export dialog on ${path} meets WCAG 2.2 AA`, async ({ page }) => {
        await page.goto(path);
        await waitForHydration(page);
        await page.getByRole('button', { name: button }).click();
        const dialog = page.getByRole('dialog', { name: 'Export events' });
        if (period) await dialog.locator('label').filter({ hasText: period }).click();
        // The fullest footer: a count, or the suggestions that replace one.
        await expect(dialog.locator('.suggestion, a[download]').first()).toBeVisible();
        // Contrast is measured on the dialog as it lands, not halfway through fading in.
        await settled(dialog);

        expect(await audit(page)).toEqual([]);
      });
    }
  });
}
