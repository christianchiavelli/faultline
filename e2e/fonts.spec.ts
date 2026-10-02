import { expect, test } from '@playwright/test';
import { FEED_STREAM, hold, nextFrames, waitForHydration } from './support/page';

/**
 * The local fallbacks are drawn to the web fonts' metrics at each weight and
 * width the app sets, and declared in the document's head, so the page is laid
 * out the same before Archivo and Martian Mono arrive as after. Held back
 * until the page has settled on its fallbacks, the fonts land with no layout
 * shift worth the name: under a hundredth of the 0.1 Google allows a whole
 * visit, as the browser scores it. A word a hair wider in the fallback moves
 * only itself, along its line, and scores next to nothing; a heading in a
 * weight or width with no fallback of its own wraps differently, moves
 * everything under it, and fails this (see `scripts/build-fonts.ts`).
 */
const PAGES = ['/', '/quakes/us7000big', '/pt/'];

for (const path of PAGES) {
  test(`${path} takes its web fonts without moving`, async ({ page }) => {
    await page.route(FEED_STREAM, (route) => route.fulfill({ status: 204 }));
    const release = await hold(page, '**/fonts/*.woff2');
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    await page.evaluate(() => {
      const shifts: number[] = ((window as unknown as { shifts: number[] }).shifts = []);
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as { value: number }[]) {
          shifts.push(entry.value);
        }
      }).observe({ type: 'layout-shift' });
    });

    release();
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (face) => face.family === 'Archivo' && face.status === 'loaded',
      );
    });
    await nextFrames(page);

    expect(loaded, 'Archivo has arrived').toBe(true);
    const shifts = await page.evaluate(() => (window as unknown as { shifts: number[] }).shifts);
    expect(shifts.reduce((total, value) => total + value, 0)).toBeLessThan(0.001);
  });
}
