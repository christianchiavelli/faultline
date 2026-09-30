import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { settled, waitForHydration } from './support/page';

/** The file's header is a public format: a column changes here on purpose or not at all. */
const HEADER =
  'time,latitude,longitude,depth,mag,magType,nst,gap,dmin,rms,net,id,updated,place,type,' +
  'horizontalError,depthError,magError,magNst,status,locationSource,magSource,url';

async function openFrom(page: Page, path: string, button: string): Promise<Locator> {
  await page.goto(path);
  await waitForHydration(page);
  await page.getByRole('button', { name: button }).click();
  const dialog = page.getByRole('dialog', { name: 'Export events' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function choose(dialog: Locator, name: string): Promise<void> {
  await dialog.locator('label').filter({ hasText: name }).click();
  await expect(dialog.getByRole('radio', { name })).toBeChecked();
}

async function save(page: Page, link: Locator): Promise<{ download: Download; file: Buffer }> {
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  return { download, file: await readFile(await download.path()) };
}

test('exports the day in the log as a spreadsheet Excel reads, from the keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await waitForHydration(page);
  const trigger = page.getByRole('button', { name: 'Export…' });

  await trigger.focus();
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog', { name: 'Export events' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await expect(dialog.getByRole('radio', { name: 'Last 24 hours' })).toBeChecked();
  await expect(dialog.getByText('About 2 kB, worldwide, M2.5 and up')).toBeVisible();

  const { download, file } = await save(
    page,
    dialog.getByRole('link', { name: 'Download 6 events' }),
  );

  expect(download.suggestedFilename()).toMatch(
    /^faultline_\d{4}-\d\d-\d\d_\d{4}-\d\d-\d\d_m2\.5\.csv$/,
  );
  // A byte order mark, or Excel reads Guánica in the wrong encoding.
  expect([...file.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = file.subarray(3).toString('utf8').split('\r\n');
  expect(lines[0]).toBe(HEADER);
  expect(lines.slice(1, -1)).toHaveLength(6);
  expect(lines.at(-1)).toBe('');
  expect(lines.find((line) => line.includes('pr0001'))).toContain(
    '"8 km S of Guánica, Puerto Rico"',
  );

  // The download manager takes over, and the reader is back where they were.
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('closes on Escape and hands focus back', async ({ page }) => {
  const dialog = await openFrom(page, '/', 'Export…');

  await page.keyboard.press('Escape');

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Export…' })).toBeFocused();
});

test('narrows a search too large for one file, with counted suggestions', async ({ page }) => {
  const dialog = await openFrom(page, '/?mag=any', 'Export…');
  await expect(dialog.getByRole('radio', { name: 'All', exact: true })).toBeChecked();

  await choose(dialog, '30 days');

  await expect(dialog.getByText('More than one file holds.')).toBeVisible();
  await expect(dialog.getByRole('link', { name: /^Download/ })).toHaveCount(0);
  const suggestions = dialog.locator('.suggestion');
  await expect(suggestions).toHaveCount(2);
  await expect(suggestions.first()).toContainText('Only M2.5 and up');
  const count = (await suggestions.first().locator('span').textContent())!.replace(' events', '');

  await suggestions.first().click();

  await expect(dialog.getByRole('radio', { name: '2.5+' })).toBeChecked();
  await expect(dialog.getByRole('link', { name: `Download ${count} events` })).toBeVisible();
});

test('exports the aftershocks of an event, as a spreadsheet or map data', async ({ page }) => {
  const dialog = await openFrom(page, '/quakes/us7000big', 'Export the events near this one…');
  await expect(dialog).toContainText('Around the M6.2 south of the Fiji Islands');
  await expect(dialog.getByRole('radio', { name: 'Near this event' })).toBeChecked();
  await expect(dialog.getByRole('radio', { name: '100', exact: true })).toBeChecked();

  const csv = await save(page, dialog.getByRole('link', { name: 'Download 1 event' }));
  expect(csv.download.suggestedFilename()).toMatch(/_100km\.csv$/);
  const rows = csv.file.subarray(3).toString('utf8').split('\r\n').slice(1, -1);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toContain('https://earthquake.usgs.gov/earthquakes/eventpage/us7000big');

  await page.getByRole('button', { name: 'Export the events near this one…' }).click();
  await choose(dialog, 'Map data');
  const geojson = await save(page, dialog.getByRole('link', { name: 'Download 1 event' }));

  expect(geojson.download.suggestedFilename()).toMatch(/_100km\.geojson$/);
  const collection = JSON.parse(geojson.file.toString('utf8'));
  expect(collection).toMatchObject({
    type: 'FeatureCollection',
    metadata: { count: 1, skipped: 0 },
    features: [
      { id: 'us7000big', geometry: { type: 'Point', coordinates: [-178.1, -24.3, 560.2] } },
    ],
  });
});

test('fills a phone screen, with its actions pinned under the thumb', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The phone layout');
  const dialog = await openFrom(page, '/', 'Export…');
  await settled(dialog);

  const viewport = page.viewportSize()!;
  expect(await dialog.boundingBox()).toEqual({
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  });
  const footer = (await dialog.locator('footer').boundingBox())!;
  expect(footer.y + footer.height).toBeCloseTo(viewport.height, 0);
  await expect(dialog.getByRole('link', { name: 'Download 6 events' })).toBeInViewport();
});
