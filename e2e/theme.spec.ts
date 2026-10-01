import { expect, test } from '@playwright/test';
import { waitForHydration } from './support/page';

test('remembers the theme, and the server paints it before any script runs', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);
  await page.getByRole('button', { name: 'Theme: System' }).click();
  const menu = page.getByRole('group', { name: 'Theme' });
  await expect(menu).toBeVisible();
  await expect(
    menu.getByRole('button', { name: 'System', exact: true }),
  ).toHaveAccessibleDescription(/^Follows your device: (Paper|Film) now$/);

  await menu.getByRole('button', { name: 'Film', exact: true }).click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'film');
  // The menu closes behind the choice and hands the focus back to its button.
  await expect(menu).toBeHidden();
  await expect(page.getByRole('button', { name: 'Theme: Film' })).toBeFocused();

  // The raw HTML, before hydration: no flash of the wrong theme to cover up.
  const html = await (await page.request.get('/')).text();
  expect(html).toMatch(/<html[^>]*data-theme="film"/);
});

test('opens the theme menu from the keyboard, and closes it with Escape', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);
  const trigger = page.getByRole('button', { name: 'Theme: System' });
  const menu = page.getByRole('group', { name: 'Theme' });

  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  // The choices come next in the tab order, straight after the button.
  await page.keyboard.press('Tab');
  await expect(menu.getByRole('button', { name: 'Paper', exact: true })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});
