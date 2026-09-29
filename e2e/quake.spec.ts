import { expect, test } from '@playwright/test';
import { readout } from './support/page';

test('shows an event with the uncertainty of its solution', async ({ page }) => {
  await page.goto('/quakes/us7000big');

  await expect(page).toHaveTitle('M6.2 South of the Fiji Islands | Faultline');
  await expect(page.locator('.numeral')).toContainText('6.2');
  await expect(page.locator('.scale')).toContainText('Moment W-phase magnitude');
  await expect(readout(page, 'Depth')).toContainText('560.2');
  await expect(readout(page, 'Depth')).toContainText('± 3.1 km');
  await expect(readout(page, 'Epicentre')).toContainText('± 7.4 km horizontal uncertainty');
  await expect(readout(page, 'Solution')).toContainText('Stations surround it well');
  await expect(page.getByText('PAGER green')).toBeVisible();
});

test('says when a depth was fixed rather than measured, and when stations are lopsided', async ({
  page,
}) => {
  await page.goto('/quakes/us7000tonga');

  await expect(readout(page, 'Depth')).toContainText('Fixed by the analyst, not measured');
  await expect(readout(page, 'Solution')).toContainText('Wide: the stations see it from one side');
  await expect(page.getByText('Automatic', { exact: true })).toBeVisible();
});

test('answers a missing event with a real 404, and a deleted one with a 410', async ({ page }) => {
  const missing = await page.goto('/quakes/zz404');
  expect(missing?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('No such event');

  const deleted = await page.goto('/quakes/zzgone');
  expect(deleted?.status()).toBe(410);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This event was deleted');

  const nowhere = await page.goto('/nowhere');
  expect(nowhere?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nothing recorded here');
});
