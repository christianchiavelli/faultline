import { expect, test } from '@playwright/test';
import { FEED_STREAM, recordApiCalls, scrollThrough, waitForHydration } from './support/page';

/**
 * A server render hands its data to the browser with the page. Hydrating,
 * deferred sections included, must not ask the API again, whether the answer
 * was an event or an error. A live page then follows the feed from the copy
 * it was handed, asking only for what changed since.
 */
const PAGES = [
  { path: '/', live: true },
  { path: '/?mag=any', live: true },
  { path: '/quakes/us7000big', live: false },
  { path: '/quakes/zz404', live: false },
  { path: '/quakes/zzgone', live: false },
];

const SINCE_ITS_COPY = /^\/api\/quakes\/recent\/stream\?window=day&since=\d+-f$/;

for (const { path, live } of PAGES) {
  test(`${path} hydrates without asking the API for what it was handed`, async ({ page }) => {
    const calls = recordApiCalls(page);
    // Answered with nothing to follow, so the network can fall quiet; what counts is the asking.
    await page.route(FEED_STREAM, (route) => route.fulfill({ status: 204 }));

    await page.goto(path);
    await waitForHydration(page);
    await scrollThrough(page);
    await page.waitForLoadState('networkidle');

    expect(calls).toEqual(live ? [expect.stringMatching(SINCE_ITS_COPY)] : []);
  });
}
