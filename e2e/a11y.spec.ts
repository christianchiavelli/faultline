import { expect, test } from '@playwright/test';
import { audit } from './support/a11y';
import {
  EVENT_API,
  arriveEmptyHanded,
  hold,
  holdStream,
  scrollThrough,
  settled,
  waitForHydration,
  waitForHydrationOf,
} from './support/page';

const PAGES = [
  '/',
  '/?mag=any',
  '/?mag=any&region=california&depth=shallow',
  '/?mag=any&q=geysers',
  '/quakes/us7000big',
  '/quakes/us7000tonga',
  '/quakes/zz404',
  '/quakes/zzgone',
  '/nowhere',
  // Portuguese words run longer, and its pages are a build of their own.
  '/pt/',
  '/pt/?mag=any&rows=all',
  '/pt/quakes/us7000big',
  '/pt/quakes/zz404',
  '/pt/nowhere',
];
const THEMES = ['paper', 'film'] as const;

/** The export dialog in its two fullest states: offering suggestions, and a file near an event. */
const DIALOGS = [
  { path: '/?mag=any', button: 'Export…', heading: 'Export events', period: '30 days' },
  {
    path: '/quakes/us7000big',
    button: 'Export the events near this one…',
    heading: 'Export events',
    period: null,
  },
  { path: '/pt/?mag=any', button: 'Exportar…', heading: 'Exportar eventos', period: '30 dias' },
];

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
      const card = page.locator('fl-helicorder .card');
      await expect(card).toBeVisible();
      // Contrast is measured on what has come in, not on its way.
      await settled(card);

      expect(await audit(page)).toEqual([]);
    });

    test('the theme menu, open, meets WCAG 2.2 AA', async ({ page }) => {
      await page.goto('/');
      await waitForHydration(page);
      await page.getByRole('button', { name: /^Theme:/ }).click();
      const menu = page.getByRole('group', { name: 'Theme' });
      await expect(menu).toBeVisible();
      await settled(menu);

      expect(await audit(page)).toEqual([]);
    });

    test('the event page, opened on what the day knew and waiting for its record, meets WCAG 2.2 AA', async ({
      page,
    }) => {
      await page.goto('/');
      await waitForHydration(page);
      const release = await hold(page, EVENT_API);
      await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).click();
      await expect(page.getByText('Coming from the USGS catalogue…').first()).toBeAttached();
      await settled(page.locator('fl-quake-page'));

      expect(await audit(page)).toEqual([]);
      release();
    });

    test('the event page, knowing nothing of it yet, meets WCAG 2.2 AA', async ({ page }) => {
      await page.goto('/');
      await waitForHydration(page);
      const release = await hold(page, EVENT_API);
      await arriveEmptyHanded(page, '/quakes/us7000big');
      await expect(page.getByText('Looking the event up in the USGS catalogue…')).toBeAttached();

      expect(await audit(page)).toEqual([]);
      release();
    });

    test('the live page, waiting on the feed, meets WCAG 2.2 AA', async ({ page }) => {
      await page.goto('/quakes/us7000big');
      await waitForHydration(page);
      const release = await hold(page, '**/api/quakes/recent?window=day');
      await page.getByRole('link', { name: 'Live', exact: true }).click();
      await expect(page.getByText('Unrolling the last 24 hours…')).toBeAttached();

      expect(await audit(page)).toEqual([]);
      release();
    });

    test('every region, open in its popover, meets WCAG 2.2 AA', async ({ page, isMobile }) => {
      test.skip(isMobile, 'A phone keeps its filters in a sheet');
      await page.goto('/?mag=any');
      await waitForHydration(page);
      await waitForHydrationOf(page.locator('fl-event-log'));
      await page.getByRole('button', { name: 'All 8 regions' }).click();
      const regions = page.getByRole('group', { name: 'Every region in the last 24 hours' });
      await expect(regions).toBeVisible();
      await settled(regions);

      expect(await audit(page)).toEqual([]);
    });

    test('the filters sheet on a phone meets WCAG 2.2 AA', async ({ page, isMobile }) => {
      test.skip(!isMobile, 'The phone layout');
      await page.goto('/?mag=any&depth=shallow');
      await waitForHydration(page);
      await waitForHydrationOf(page.locator('fl-event-log'));
      await page.getByRole('button', { name: /^Filters/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Filters' });
      await expect(sheet).toBeVisible();
      await settled(sheet);

      expect(await audit(page)).toEqual([]);
    });

    test('the log holding a new event meets WCAG 2.2 AA', async ({ page }) => {
      const arrive = await holdStream(page);
      await page.goto('/?mag=any');
      await waitForHydration(page);
      const log = page.getByRole('region', { name: 'Every event' });
      await waitForHydrationOf(page.locator('fl-event-log'));
      await arrive({ id: 'nc9001', place: '4 km E of Cobb, CA', magnitude: 1.4 });
      const waiting = log.getByRole('status', { name: 'New events' });
      await expect(waiting).toContainText('1 new event');
      await settled(waiting);

      expect(await audit(page)).toEqual([]);
    });

    for (const { path, button, heading, period } of DIALOGS) {
      test(`the export dialog on ${path} meets WCAG 2.2 AA`, async ({ page }) => {
        await page.goto(path);
        await waitForHydration(page);
        await page.getByRole('button', { name: button }).click();
        const dialog = page.getByRole('dialog', { name: heading });
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
