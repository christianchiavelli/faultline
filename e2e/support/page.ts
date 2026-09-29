import { expect, type Locator, type Page } from '@playwright/test';

/** The value and hint under a readout label, e.g. "Events" or "Depth". */
export function readout(page: Page, label: string): Locator {
  return page
    .locator('.readout')
    .filter({ has: page.locator('dt', { hasText: label }) })
    .locator('dd');
}

/** Every `/api/` request the page makes from now on. */
export function recordApiCalls(page: Page): readonly string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) calls.push(url.pathname + url.search);
  });
  return calls;
}

/** The UTC clock only ticks in the browser, so a new time means the app has hydrated. */
export async function waitForHydration(page: Page): Promise<void> {
  const clock = page.locator('.clock');
  await expect(clock).not.toHaveText((await clock.textContent()) ?? '');
}

/**
 * Brings every deferred section into view so it renders and hydrates, the way
 * a reader scrolling down would.
 */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo(0, 0);
  });
}
