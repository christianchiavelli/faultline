import { expect, test, type Locator, type Page } from '@playwright/test';
import { EVENT_API, arriveEmptyHanded, hold, readout, waitForHydration } from './support/page';

/** Each label of a set of readouts, and where it sits in them. */
const labelsOf = (readouts: Locator) =>
  readouts.evaluate((list) => {
    const frame = list.getBoundingClientRect();
    return [...list.querySelectorAll('dt')].map((dt) => {
      const box = dt.getBoundingClientRect();
      return {
        label: dt.textContent?.trim(),
        x: Math.round(box.left - frame.left),
        y: Math.round(box.top - frame.top),
      };
    });
  });

/**
 * The labels on the readouts' first line. Further down, on a phone, each one
 * waits under the one before, whose hint is only as long as its words turn out.
 */
const firstLine = (labels: Awaited<ReturnType<typeof labelsOf>>) =>
  labels.filter((label) => label.y === labels[0]?.y);

/** How visible each line still to come is the moment it is put on the page. */
async function watchLinesArrive(page: Page): Promise<() => Promise<number[]>> {
  await page.evaluate(() => {
    const seen: number[] = [];
    Object.assign(window, { linesSeen: seen });
    new MutationObserver((records) => {
      for (const node of records.flatMap((record) => [...record.addedNodes])) {
        if (!(node instanceof Element)) continue;
        for (const line of [node, ...node.querySelectorAll('ui-skeleton')]) {
          const style = getComputedStyle(line);
          // One a narrow screen leaves out is not drawn at all.
          if (line.localName === 'ui-skeleton' && style.display !== 'none') {
            seen.push(Number(style.opacity));
          }
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  return () => page.evaluate(() => (window as unknown as { linesSeen: number[] }).linesSeen);
}

const opacityOf = (locator: Locator) =>
  locator.evaluate((element) => Number(getComputedStyle(element).opacity));

test('opens an event on what the day knew of it, and lands the rest of its record where it waited', async ({
  page,
}) => {
  await page.goto('/');
  await waitForHydration(page);
  const seen = await watchLinesArrive(page);
  const release = await hold(page, EVENT_API);
  await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).click();

  // The event at once: what it was, how big, where and how deep.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('South of the Fiji Islands');
  await expect(page).toHaveTitle('M6.2 South of the Fiji Islands | Faultline');
  await expect(readout(page, 'Depth')).toContainText('560.2km');
  // Only what the catalogue's record adds waits: how well it is located, by whom, what it did.
  await expect(readout(page, 'Solution')).toHaveText('Coming from the USGS catalogue…');
  await expect(page.locator('fl-quake-page .facts')).toHaveAttribute('aria-hidden', 'true');
  const line = page.locator('fl-quake-page ui-skeleton').first();
  await expect.poll(() => opacityOf(line)).toBeGreaterThan(0.4);
  expect(new Set(await seen())).toEqual(new Set([0]));
  const readouts = page.locator('fl-quake-page .readouts');
  const waiting = await labelsOf(readouts);

  release();
  await expect(readout(page, 'Solution')).toContainText('stations');
  await expect(page.locator('fl-quake-page ui-skeleton')).toHaveCount(0);
  // The labels the reader saw waiting are the record's, where they were.
  expect(firstLine(await labelsOf(readouts))).toEqual(firstLine(waiting));
});

test('lays out an event it knows nothing of yet, and lands the event on it', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);
  const seen = await watchLinesArrive(page);
  const release = await hold(page, EVENT_API);
  await arriveEmptyHanded(page, '/quakes/us7000big');

  // Words for a screen reader; for the eye, the page's shape, kept out of the reader's way.
  await expect(page.getByText('Looking the event up in the USGS catalogue…')).toBeAttached();
  const readouts = page.locator('fl-quake-page .readouts');
  await expect(readouts).toHaveAttribute('aria-hidden', 'true');
  // Nothing at first, so an answer quicker than the wait flashes nothing; then the lines come.
  const line = page.locator('fl-quake-page ui-skeleton').first();
  await expect.poll(() => opacityOf(line)).toBeGreaterThan(0.4);
  expect(await seen()).not.toEqual([]);
  expect(new Set(await seen())).toEqual(new Set([0]));
  const waiting = await labelsOf(readouts);
  expect(waiting.map((label) => label.label)).toEqual(['Depth', 'Epicentre', 'Solution', 'Energy']);

  release();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('South of the Fiji Islands');
  await expect(readouts).not.toHaveAttribute('aria-hidden');
  // The labels the reader saw waiting are the event's, where they were.
  expect(firstLine(await labelsOf(readouts))).toEqual(firstLine(waiting));
});

test('lays the day out before it comes, and inks the same drum when it does', async ({ page }) => {
  await page.goto('/quakes/us7000big');
  await waitForHydration(page);
  const release = await hold(page, '**/api/quakes/recent?window=day');
  await page.getByRole('link', { name: 'Live', exact: true }).click();

  await expect(page.getByText('Unrolling the last 24 hours…')).toBeAttached();
  const drum = page.locator('fl-live-page fl-helicorder');
  await expect(drum.locator('svg.trace')).toHaveClass(/trace--waiting/);
  await expect(drum.locator('.hours__current')).toBeVisible();
  // Nothing to read off it yet: not a quiet day, a day that has not come.
  await expect(page.getByRole('slider', { name: 'Events on the trace' })).toHaveCount(0);
  const paper = await drum.locator('.paper').boundingBox();
  const readouts = page.locator('fl-live-page .readouts');
  const waiting = await labelsOf(readouts);
  const before = await drum.elementHandle();

  release();
  await expect(drum.locator('svg.trace')).not.toHaveClass(/trace--waiting/);
  await expect(page.getByRole('slider', { name: 'Events on the trace' })).toBeAttached();
  // The same drum, inked where it was, its readouts' labels where they were.
  expect(await drum.evaluate((element, then) => element === then, before)).toBe(true);
  expect(await drum.locator('.paper').boundingBox()).toEqual(paper);
  expect(firstLine(await labelsOf(readouts))).toEqual(firstLine(waiting));
});

test('holds the waiting lines still under reduced motion', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await waitForHydration(page);
  const release = await hold(page, EVENT_API);
  await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).click();

  // After the same wait, there at once, and not breathing.
  const line = page.locator('fl-quake-page ui-skeleton').first();
  await expect.poll(() => opacityOf(line)).toBe(1);
  expect(
    await line.evaluate(
      (element) =>
        element.getAnimations().filter((animation) => animation.playState === 'running').length,
    ),
  ).toBe(0);

  release();
  await context.close();
});
