import { expect, test } from '@playwright/test';

test('remembers the theme, and the server paints it before any script runs', async ({ page }) => {
  await page.goto('/');
  const toggle = page.getByRole('button', { name: /^Theme:/ });

  await toggle.click();
  await expect(toggle).toHaveAccessibleName('Theme: Paper. Switch to Film');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'film');

  // The raw HTML, before hydration: no flash of the wrong theme to cover up.
  const html = await (await page.request.get('/')).text();
  expect(html).toMatch(/<html[^>]*data-theme="film"/);
});
