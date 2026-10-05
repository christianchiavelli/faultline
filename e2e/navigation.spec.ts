import { expect, test } from '@playwright/test';
import { nextFrames, waitForHydration, waitForHydrationOf } from './support/page';

const SKIP = [
  { path: '/quakes/us7000big', name: 'Skip to content' },
  // The Portuguese build lives under `/pt/`, its `<base href>`.
  { path: '/pt/quakes/us7000big', name: 'Pular para o conteúdo' },
];

for (const { path, name } of SKIP) {
  test(`the skip link on ${path} jumps to the content of that page`, async ({ page, isMobile }) => {
    test.skip(isMobile, 'A phone has no Tab key');
    await page.goto(path);
    await waitForHydration(page);

    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name })).toBeFocused();
    await page.keyboard.press('Enter');
    await nextFrames(page);

    await expect(page).toHaveURL(new RegExp(`${path}#main$`));
    await expect(page.getByRole('main')).toBeFocused();
    // Still at the content: the router hears of the jump, and leaves the scrolling to the browser.
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  });
}

test('takes the focus to the content of a new page, and leaves it on a filter', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'A phone keeps its filters in a sheet');
  await page.goto('/');
  await waitForHydration(page);
  await waitForHydrationOf(page.locator('fl-event-log'));
  const magnitude = page.getByRole('group', { name: 'Magnitude' });

  await magnitude.getByRole('link', { name: /^4\.5 and up/ }).click();
  await expect(page).toHaveURL(/\?mag=4\.5$/);
  await expect(magnitude.getByRole('link', { name: /^4\.5 and up/ })).toBeFocused();

  await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).first().click();
  await expect(page).toHaveURL(/\/quakes\/us7000big$/);
  await expect(page.getByRole('main')).toBeFocused();

  await page.goBack();
  await expect(page).toHaveURL(/\?mag=4\.5$/);
  await expect(page.getByRole('main')).toBeFocused();
});
