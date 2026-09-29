import { expect, test } from '@playwright/test';
import { OUTAGE_PORT } from './support/ports';
import { recordApiCalls, waitForHydration } from './support/page';

test.use({ baseURL: `http://localhost:${OUTAGE_PORT}` });

test('says the USGS is not answering, with a status that says so too', async ({ page }) => {
  const calls = recordApiCalls(page);
  const response = await page.goto('/');

  expect(response?.status()).toBe(502);
  await expect(page.getByRole('alert')).toContainText('The USGS feed did not answer');
  await waitForHydration(page);
  // The render already knows the feed failed; hydrating does not wait on it a second time.
  expect(calls).toEqual([]);

  const retry = page.waitForRequest((request) => request.url().includes('/api/quakes/recent'));
  await page.getByRole('button', { name: 'Try again' }).click();
  await retry;
});

test('reports an event it cannot look up as a gateway failure, not a missing event', async ({
  page,
}) => {
  const response = await page.goto('/quakes/us7000big');

  expect(response?.status()).toBe(502);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('The USGS did not answer');
});
