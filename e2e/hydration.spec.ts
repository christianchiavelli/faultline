import { expect, test } from '@playwright/test';
import {
  FEED_STREAM,
  nextFrames,
  recordApiCalls,
  recordErrors,
  scrollThrough,
  waitForHydration,
} from './support/page';

/**
 * A server render hands its data to the browser with the page. Hydrating,
 * deferred sections included, must not ask the API again, whether the answer
 * was an event or an error, and must not fail on the way: a page that cannot
 * hydrate a section draws it again, or breaks it. A live page then follows
 * the feed from the copy it was handed, asking only for what changed since.
 * Each language is a build of its own, and each is hydrated here.
 */
const PAGES = [
  { path: '/', live: true },
  { path: '/?mag=any', live: true },
  { path: '/quakes/us7000big', live: false },
  { path: '/quakes/zz404', live: false },
  { path: '/quakes/zzgone', live: false },
  { path: '/pt/', live: true },
  { path: '/pt/?mag=any&rows=all', live: true },
  { path: '/pt/quakes/us7000big', live: false },
  { path: '/pt/quakes/zz404', live: false },
];

const SINCE_ITS_COPY = /^\/api\/quakes\/recent\/stream\?window=day&since=\d+-f$/;

for (const { path, live } of PAGES) {
  test(`${path} hydrates without asking the API for what it was handed`, async ({ page }) => {
    const calls = recordApiCalls(page);
    const errors = recordErrors(page);
    // Answered with nothing to follow, so the network can fall quiet; what counts is the asking.
    await page.route(FEED_STREAM, (route) => route.fulfill({ status: 204 }));

    await page.goto(path);
    await waitForHydration(page);
    await scrollThrough(page);
    // Every component drops its hydration marker as it hydrates, the deferred
    // sections last; the network having gone quiet once says nothing of them.
    await expect(page.locator('[ngh]')).toHaveCount(0);
    await nextFrames(page);

    expect(calls).toEqual(live ? [expect.stringMatching(SINCE_ITS_COPY)] : []);
    expect(errors).toEqual([]);
  });
}
