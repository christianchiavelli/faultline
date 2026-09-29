import { expect, test } from '@playwright/test';
import { readout } from './support/page';

test('renders the whole day on the server, before any script runs', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');

  await expect(page.locator('fl-helicorder path.ink')).toHaveCount(24);
  await expect(readout(page, 'Events').locator('.readout__value')).toHaveText('9');
  await expect(readout(page, 'Events')).toContainText('8 earthquakes · 1 explosion');
  await expect(readout(page, 'Largest')).toContainText('South of the Fiji Islands');
  await expect(
    page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }),
  ).toBeVisible();
  await expect(page.getByRole('table')).toContainText('Kermadec Islands region');

  await context.close();
});

test('opens a labelled event straight from the trace', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).click();

  await expect(page).toHaveURL(/\/quakes\/us7000big$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('South of the Fiji Islands');
});

test('filters the log through the address bar and keeps the reader in place', async ({ page }) => {
  await page.goto('/');
  const log = page.getByRole('region', { name: 'Every event' });
  const filters = log.getByRole('navigation', { name: 'Minimum magnitude' });
  const rows = log.locator('tbody tr:not(.day)');
  await filters.scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(6);

  await filters.getByRole('link', { name: /^M4\.5\+/ }).click();

  await expect(page).toHaveURL(/\?min=4\.5$/);
  await expect(rows).toHaveCount(3);
  await expect(filters.getByRole('link', { name: /^M4\.5\+/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  // A filter is not a new page: the reader stays where they were, not at the top.
  await expect(filters).toBeInViewport();

  await page.goBack();
  await expect(rows).toHaveCount(6);
});

test('is upfront about the awkward records', async ({ page }) => {
  await page.goto('/?min=all');
  const log = page.getByRole('region', { name: 'Every event' });

  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(9);
  await expect(log.getByText('explosion', { exact: true })).toBeVisible();
  await expect(log.getByTitle('1.2 km above sea level')).toHaveText('−1.2');
  await expect(log.getByTitle('No magnitude computed yet')).toBeVisible();
  await expect(log.getByRole('link', { name: '6 km SW of Pāhala, Hawaii' })).toBeVisible();
  await expect(
    page.getByText('1 record from the USGS failed validation and is not shown.'),
  ).toBeVisible();
});
