import { expect, test, type Browser, type BrowserContextOptions } from '@playwright/test';
import { FEED_STREAM } from './support/page';

/**
 * The local fallbacks are drawn to the web fonts' metrics at each weight and
 * width the app sets, and declared in the document's head, so the first
 * screen is laid out the same before Archivo and Martian Mono arrive as after:
 * the swap moves nothing a reader can see. A heading in a weight or width
 * with no fallback of its own wraps differently in the fallback, and fails
 * this (see `scripts/build-fonts.ts`).
 */
const PAGES = ['/', '/quakes/us7000big', '/pt/'];

type Boxes = Record<string, readonly [top: number, left: number, height: number]>;

async function firstScreen(
  browser: Browser,
  options: BrowserContextOptions,
  path: string,
  fonts: boolean,
): Promise<Boxes> {
  const context = await browser.newContext(options);
  await context.route(FEED_STREAM, (route) => route.fulfill({ status: 204 }));
  if (!fonts) await context.route('**/fonts/*.woff2', (route) => route.abort());
  const page = await context.newPage();
  await page.goto(path, { waitUntil: 'networkidle' });
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some(
      (face) => face.family === 'Archivo' && face.status === 'loaded',
    );
  });
  expect(loaded, fonts ? 'Archivo has arrived' : 'Archivo was held back').toBe(fonts);

  const boxes = await page.evaluate(() => {
    const blocks = document.querySelectorAll('h1, h2, h3, p, dt, dd, li, th, td, label, button');
    const seen: Record<string, [number, number, number]> = {};
    blocks.forEach((element, index) => {
      const box = element.getBoundingClientRect();
      if (!box.height || box.top >= innerHeight) return;
      const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 32);
      seen[`${index} ${element.localName} “${text}”`] = [box.top, box.left, box.height].map(
        Math.round,
      ) as [number, number, number];
    });
    return seen;
  });
  await context.close();
  return boxes;
}

for (const path of PAGES) {
  test(`${path} lays out its first screen the same before the fonts arrive`, async ({
    browser,
    contextOptions,
    viewport,
    isMobile,
    hasTouch,
    deviceScaleFactor,
  }) => {
    const options = { ...contextOptions, viewport, isMobile, hasTouch, deviceScaleFactor };
    const before = await firstScreen(browser, options, path, false);
    const after = await firstScreen(browser, options, path, true);

    // The text of a block is in its key, so a block whose words change, like a clock, is left out.
    const moved = Object.keys(after).filter((key) => {
      const [a, b] = [before[key], after[key]];
      return a && a.some((value, i) => Math.abs(value - b![i]!) > 1);
    });
    expect(
      moved.map((key) => `${key}: ${before[key]!.join(', ')} then ${after[key]!.join(', ')}`),
    ).toEqual([]);
    expect(Object.keys(after).filter((key) => before[key]).length).toBeGreaterThan(5);
  });
}
