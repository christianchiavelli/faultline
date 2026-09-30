import { expect, test } from '@playwright/test';

/**
 * Every tab reads "<page> | Faultline", and the home page just "Faultline".
 * Checked with JavaScript off: the server render is what the tab shows first,
 * and all that crawlers and link previews ever see.
 */
const TITLES = {
  '/': 'Faultline',
  '/?mag=any': 'Faultline',
  '/quakes/us7000big': 'M6.2 South of the Fiji Islands | Faultline',
  '/quakes/zz404': 'Event not found | Faultline',
  '/quakes/zzgone': 'Event deleted | Faultline',
  '/nowhere': 'Page not found | Faultline',
};

test.use({ javaScriptEnabled: false });

for (const [path, title] of Object.entries(TITLES)) {
  test(`${path} is titled "${title}"`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveTitle(title);
  });
}
