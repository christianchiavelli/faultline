import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  arrive,
  scrollThrough,
  settled,
  waitForHydration,
  waitForHydrationOf,
} from './support/page';

const PAGES = [
  '/',
  '/?mag=any',
  '/?mag=any&region=california&depth=shallow',
  '/quakes/us7000big',
  '/quakes/us7000tonga',
  '/quakes/zz404',
];
const THEMES = ['paper', 'film'] as const;

/** The export dialog in its two fullest states: offering suggestions, and a file near an event. */
const DIALOGS = [
  { path: '/?mag=any', button: 'Export…', period: '30 days' },
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

    test('the trace, read from the keyboard, meets WCAG 2.2 AA', async ({ page }) => {
      await page.goto('/');
      await waitForHydration(page);
      await page.getByRole('slider', { name: 'Events on the trace' }).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(page.locator('fl-helicorder .card')).toBeVisible();

      expect(await audit(page)).toEqual([]);
    });

    test('every region, open in its popover, meets WCAG 2.2 AA', async ({ page, isMobile }) => {
      test.skip(isMobile, 'A phone keeps its filters in a sheet');
      await page.goto('/?mag=any');
      await waitForHydration(page);
      await waitForHydrationOf(page.locator('fl-event-log'));
      await page.getByRole('button', { name: 'All 8 regions' }).click();
      await expect(
        page.getByRole('group', { name: 'Every region in the last 24 hours' }),
      ).toBeVisible();

      expect(await audit(page)).toEqual([]);
    });

    test('the log holding a new event meets WCAG 2.2 AA', async ({ page }) => {
      await page.clock.install();
      await page.goto('/?mag=any');
      await waitForHydration(page);
      const log = page.getByRole('region', { name: 'Every event' });
      await waitForHydrationOf(page.locator('fl-event-log'));
      await arrive(page, { id: 'nc9001', place: '4 km E of Cobb, CA', magnitude: 1.4 });
      await expect(log.getByRole('status', { name: 'New events' })).toContainText('1 new event');

      expect(await audit(page)).toEqual([]);
    });

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
