import { expect, test } from '@playwright/test';
import { recordApiCalls, scrollThrough, waitForHydration } from './support/page';

/**
 * A server render hands its data to the browser with the page. Hydrating,
 * deferred sections included, must not ask the API again, whether the answer
 * was an event or an error.
 */
const PAGES = ['/', '/?min=all', '/quakes/us7000big', '/quakes/zz404', '/quakes/zzgone'];

for (const path of PAGES) {
  test(`${path} hydrates without calling the API`, async ({ page }) => {
    const calls = recordApiCalls(page);

    await page.goto(path);
    await waitForHydration(page);
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');

    expect(calls).toEqual([]);
  });
}
