import { expect, test } from '@playwright/test';
import {
  holdStream,
  nextFrames,
  readout,
  traceOrigin,
  waitForHydration,
  waitForHydrationOf,
} from './support/page';

test('renders the whole day on the server, before any script runs', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');

  await expect(page.locator('fl-helicorder path.ink')).toHaveCount(24);
  await expect(readout(page, 'Events').locator('.readout__value')).toHaveText('14');
  await expect(readout(page, 'Events')).toContainText('13 earthquakes · 1 explosion');
  await expect(readout(page, 'Largest')).toContainText('South of the Fiji Islands');
  await expect(
    page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }),
  ).toBeVisible();
  await expect(page.getByRole('table', { name: /^Seismic events/ })).toContainText(
    'Kermadec Islands region',
  );

  await context.close();
});

test('opens a labelled event straight from the trace', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).click();

  await expect(page).toHaveURL(/\/quakes\/us7000big$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('South of the Fiji Islands');
  await expect(page).toHaveTitle('M6.2 South of the Fiji Islands | Faultline');
});

test('filters the log through the address bar and keeps the reader in place', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'A phone keeps its filters in a sheet');
  await page.goto('/');
  const log = page.getByRole('region', { name: 'Every event' });
  const filters = log.getByRole('group', { name: 'Magnitude' });
  const rows = log.locator('tbody tr:not(.day)');
  await filters.scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(6);

  await filters.getByRole('link', { name: /^4\.5 and up/ }).click();

  await expect(page).toHaveURL(/\?mag=4\.5$/);
  await expect(rows).toHaveCount(3);
  await expect(filters.getByRole('link', { name: /^4\.5 and up/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  // A filter is not a new page: the reader stays where they were, not at the top.
  await expect(filters).toBeInViewport();

  await page.goBack();
  await expect(rows).toHaveCount(6);
});

test('opens an event from anywhere on its row in the log', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);
  const row = page
    .getByRole('region', { name: 'Every event' })
    .getByRole('row', { name: /Kermadec Islands region/ });

  // Forced: the row's link lies over the cell, which is the point.
  await row.getByRole('cell').first().click({ force: true });

  await expect(page).toHaveURL(/\/quakes\/us7000kerm$/);
});

test('is upfront about the awkward records', async ({ page }) => {
  await page.goto('/?mag=any&rows=all');
  const log = page.getByRole('region', { name: 'Every event' });

  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(14);
  await expect(log.getByText('explosion', { exact: true })).toBeVisible();
  await expect(log.getByTitle('1.2 km above sea level')).toHaveText('−1.2');
  await expect(log.getByTitle('No magnitude computed yet')).toBeVisible();
  await expect(log.getByRole('link', { name: '6 km SW of Pāhala' })).toBeVisible();
  await expect(
    page.getByText('1 record from the USGS failed validation and is not shown.'),
  ).toBeVisible();
});

test('keeps a label at the very end of its hour inside the trace, on any screen', async ({
  page,
}) => {
  await page.goto('/');
  const paper = page.locator('fl-helicorder .paper');
  const labels = page.locator('fl-helicorder .marker');
  await expect(labels).toHaveCount(3);

  // Where a label lands follows the minute of its event, so pin them all to the end of their line.
  await labels.evaluateAll((elements) => {
    for (const element of elements) (element as HTMLElement).style.setProperty('--at', '100');
  });

  const edge = await paper.evaluate((element) => element.getBoundingClientRect().right);
  for (const right of await labels.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().right),
  )) {
    expect(right).toBeLessThanOrEqual(edge + 0.5);
  }
  // Hanging past the edge, a label widened the page and a phone zoomed out to fit it.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});

test('reads any event off the trace, even one too small to draw, and opens it', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'A phone has no pointer to hover with');
  await page.goto('/');
  await waitForHydration(page);
  const card = page.locator('fl-helicorder .card');
  const origin = await traceOrigin(page, 'hv0001');

  await page.mouse.move(origin.x + 2, origin.y - 2);

  await expect(card).toContainText('M2.6ML');
  await expect(card).toContainText('6 km SW of Pāhala, Hawaii');
  await expect(card).toContainText('1.2 km above sea level');
  await expect(card).toContainText('Reviewed');
  // The band behind the line read lights that one line, and no more.
  const [band, paper] = await Promise.all([
    page.locator('fl-helicorder .band').boundingBox(),
    page.locator('fl-helicorder .paper').boundingBox(),
  ]);
  expect(band!.height).toBeCloseTo(paper!.height / 24, 0);

  await page.mouse.move(origin.x + 2, origin.y + 200);
  await expect(card).toBeHidden();

  // Content shown on hover can be dismissed without moving the pointer.
  await page.mouse.move(origin.x + 2, origin.y - 2);
  await expect(card).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();

  await page.mouse.click(origin.x + 2, origin.y - 2);
  await expect(page).toHaveURL(/\/quakes\/hv0001$/);
});

test('reads a tapped event without leaving the page, and opens it from its card', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'A tap');
  await page.goto('/');
  await waitForHydration(page);
  const card = page.locator('fl-helicorder .card');
  const origin = await traceOrigin(page, 'ak0001');

  // A finger lands wide of a burst this small, and still means it.
  await page.touchscreen.tap(origin.x + 12, origin.y + 6);

  await expect(card).toContainText('12 km NW of Anchorage, Alaska');
  await expect(page).toHaveURL(/\/$/);

  await card.locator('a').tap();
  await expect(page).toHaveURL(/\/quakes\/ak0001$/);
});

test('steps through the trace from the keyboard, as through a slider', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);
  const trace = page.getByRole('slider', { name: 'Events on the trace' });
  const card = page.locator('fl-helicorder .card');

  // Tabbed into, the way a keyboard reader arrives.
  for (let i = 0; i < 20 && !(await trace.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab');
  }
  await expect(trace).toBeFocused();
  await expect(trace).toHaveAttribute('aria-valuetext', /^M1\.3 Md, 2 km NNW of The Geysers, CA,/);
  await expect(card).toContainText('Other events');

  // Back past the swarm's latest, half an hour older still.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(trace).toHaveAttribute(
    'aria-valuetext',
    /^M2\.8 Md, 8 km S of Guánica, Puerto Rico,/,
  );
  await expect(card).toContainText('8 km S of Guánica, Puerto Rico');

  await page.keyboard.press('Escape');
  await expect(card).toBeHidden();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/quakes\/pr0001$/);
});

test('weighs the day against an average day on Earth', async ({ page }) => {
  await page.goto('/');
  const sizes = page.getByRole('region', { name: 'How big' });
  const table = sizes.getByRole('table', { name: /by magnitude/ });

  // From the smallest earthquake, M0.6, to the largest, M6.2, empty sizes included.
  await expect(table.getByRole('row')).toHaveCount(13);
  await expect(table.getByRole('row', { name: /^M2\.5 to 3 / }).getByRole('cell')).toHaveText([
    '2',
    '870',
  ]);
  await expect(sizes.locator('figcaption')).toContainText(
    'Where seismometers are dense. California, mostly',
  );
  await expect(sizes.locator('figcaption')).toContainText(
    'Mostly missing. 3 located, where an average day has about 1,300',
  );
});

test('keeps its notes clear of the bars, their counts and both lines, however wide the screen', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'A phone keeps the notes in the caption');
  const arrive = await holdStream(page);
  await page.goto('/');
  await waitForHydration(page);
  const sizes = page.getByRole('region', { name: 'How big' });
  const chart = sizes.locator('fl-magnitude-chart');
  await waitForHydrationOf(chart);

  // A busy hour of M3s raises the bars in the gap.
  await arrive(
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `ak900${i}`,
      place: '20 km N of Willow, Alaska',
      magnitude: 3.2,
    })),
  );
  await expect(
    sizes
      .getByRole('row', { name: /^M3 to 3\.5 / })
      .getByRole('cell')
      .first(),
  ).toHaveText('6');

  const screens = [
    [1440, 900],
    [1280, 600],
    [1024, 768],
    [768, 1024],
  ] as const;
  for (const [width, height] of screens) {
    await page.setViewportSize({ width, height });
    const layout = await chart.evaluate((element) => {
      const paper = element.querySelector('.paper')!.getBoundingClientRect();
      const end = (line: Element, n: 1 | 2) => ({
        x: paper.left + (Number(line.getAttribute(`x${n}`)) / 1000) * paper.width,
        y: paper.top + (Number(line.getAttribute(`y${n}`)) / 1000) * paper.height,
      });
      const law = element.querySelector('line.law')!;
      const [from, to] = [end(law, 1), end(law, 2)];
      const complete = end(element.querySelector('line.complete')!, 1).x;

      const shown = (selector: string) =>
        [...element.querySelectorAll(selector)].filter((el) => {
          const box = el.getBoundingClientRect();
          return box.width > 1 && box.height > 1;
        });
      // The words, not the box: the centred note's box runs up to the top of the paper.
      const words = (note: Element) => {
        const range = document.createRange();
        range.selectNodeContents(note);
        return [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      };
      const meet = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const onLaw = (rect: DOMRect) =>
        Array.from({ length: 501 }, (_, i) => i / 500).some((t) => {
          const x = from.x + (to.x - from.x) * t;
          const y = from.y + (to.y - from.y) * t;
          return x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
        });
      const marks = [...shown('.count'), ...shown('rect.bar')];

      const clashes = shown('.note').flatMap((note) =>
        words(note).flatMap((rect) => [
          ...marks
            .filter((mark) => meet(rect, mark.getBoundingClientRect()))
            .map((mark) => `${note.className} over ${mark.textContent?.trim() || 'a bar'}`),
          ...(onLaw(rect) ? [`${note.className} on the law`] : []),
          ...(rect.left < complete && complete < rect.right ? [`${note.className} on M4.5`] : []),
        ]),
      );
      return {
        clashes: [...new Set(clashes)],
        gap: ['.note--gap', '.legend__item--gap'].filter((selector) => shown(selector).length),
      };
    });

    expect(layout.clashes, `at ${width}×${height}`).toEqual([]);
    // Said once: on the chart where it has room, in the caption where it does not.
    expect(layout.gap, `at ${width}×${height}`).toEqual([
      width >= 1280 ? '.note--gap' : '.legend__item--gap',
    ]);
  }
});

test('folds the log to its latest ten, and unfolds it through the address bar', async ({
  page,
}) => {
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  const rows = log.locator('tbody tr:not(.day)');
  await log.locator('.more').scrollIntoViewIfNeeded();

  await expect(rows).toHaveCount(10);
  await expect(log.locator('.more')).toContainText('The latest 10 of 14');

  // From the keyboard, the reader carries on at the first row the link adds.
  await log.getByRole('link', { name: 'Show all 14' }).focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/[?&]rows=all/);
  await expect(rows).toHaveCount(14);
  await expect(rows.nth(10).getByRole('link')).toBeFocused();

  await page.goBack();
  await expect(rows).toHaveCount(10);
});

test('holds a new event that lands while the log is in view, and shows it on request', async ({
  page,
}) => {
  const arrive = await holdStream(page);
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  const first = log.locator('tbody tr:not(.day)').first();
  await waitForHydrationOf(page.locator('fl-event-log'));
  await expect(first).toContainText('2 km NNW of The Geysers');

  await arrive({ id: 'nc9001', place: '4 km E of Cobb, CA', magnitude: 1.4 });

  const waiting = log.getByRole('status', { name: 'New events' });
  await expect(waiting).toContainText('1 new event');
  // The list the reader is looking at stays put, counts included.
  await expect(first).toContainText('2 km NNW of The Geysers');
  await expect(log.locator('.more')).toContainText('The latest 10 of 14');

  await waiting.getByRole('button', { name: 'Show it' }).click();

  await expect(first).toContainText('4 km E of Cobb');
  await expect(first.getByRole('link')).toBeFocused();
  await expect(log.locator('.more')).toContainText('The latest 10 of 15');
});

test('lets a new event straight in while the log is below the fold', async ({ page }) => {
  const arrive = await holdStream(page);
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  // Rendered once, then left behind: the reader is back up at the trace.
  await waitForHydrationOf(page.locator('fl-event-log'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await nextFrames(page);

  await arrive({ id: 'nc9001', place: '4 km E of Cobb, CA', magnitude: 1.4 });
  await log.scrollIntoViewIfNeeded();

  await expect(log.locator('tbody tr:not(.day)').first()).toContainText('4 km E of Cobb');
  await expect(log.getByRole('status', { name: 'New events' })).toHaveText('');
});

test('filters the log by region and depth, counting every option first', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'A phone keeps its filters in a sheet');
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  await waitForHydrationOf(page.locator('fl-event-log'));
  const filters = log.getByRole('navigation', { name: 'Filter the events' });

  await filters
    .getByRole('group', { name: 'Region' })
    .getByRole('link', { name: 'California 7 events' })
    .click();

  await expect(page).toHaveURL(/\/\?mag=any&region=california$/);
  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(7);
  await expect(log.locator('.tally')).toHaveText('7 of 14 events · any magnitude');
  await expect(
    log.getByRole('list', { name: 'Filters on' }).getByRole('link'),
  ).toHaveAccessibleName('Remove California');
  // Every Californian event of the day is shallow, and the other depths say so before a click.
  await expect(
    filters.getByRole('group', { name: 'Depth' }).getByRole('link', { name: /^Shallow/ }),
  ).toContainText('7');
  await expect(filters.getByRole('group', { name: 'Depth' }).getByRole('link')).toHaveCount(2);

  await log.getByRole('link', { name: 'Clear filters' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(log.locator('.tally')).toHaveText('6 of 14 events · M2.5 and up');
  await expect(log.getByRole('list', { name: 'Filters on' })).toHaveCount(0);
});

test('has every region of the day one click away, in a popover', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone keeps its filters in a sheet');
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  await waitForHydrationOf(page.locator('fl-event-log'));

  await log.getByRole('button', { name: 'All 8 regions' }).click();
  const every = page.getByRole('group', { name: 'Every region in the last 24 hours' });
  await expect(every).toBeVisible();
  await every.getByRole('link', { name: /^Washington/ }).click();

  await expect(page).toHaveURL(/region=washington$/);
  await expect(every).toBeHidden();
  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(1);
  await expect(log.getByText('explosion', { exact: true })).toBeVisible();
});

test('renders a filtered view on the server, as its address asks', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/?mag=any&depth=deep');
  const log = page.getByRole('region', { name: 'Every event' });

  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(1);
  await expect(log.locator('tbody tr:not(.day)')).toContainText('South of the Fiji Islands');
  await context.close();
});

test('searches the log by place, marking what it found', async ({ page }) => {
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  await waitForHydrationOf(page.locator('fl-event-log'));
  const search = log.getByRole('searchbox', { name: 'Search places' });

  await search.fill('geysers');

  await expect(page).toHaveURL(/\/\?mag=any&q=geysers$/);
  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(4);
  await expect(log.locator('tbody mark').first()).toHaveText('Geysers');
  await expect(log.getByRole('link', { name: 'Remove “geysers”' })).toBeVisible();

  await log.getByRole('button', { name: 'Clear the search' }).click();

  await expect(page).toHaveURL(/\/\?mag=any$/);
  await expect(search).toBeFocused();
  await expect(log.locator('tbody mark')).toHaveCount(0);
});

test('goes to the search on "/", from anywhere on the page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone has no keyboard shortcuts');
  await page.goto('/');
  await waitForHydration(page);
  await waitForHydrationOf(page.locator('fl-event-log'));
  await page.evaluate(() => window.scrollTo(0, 0));

  await page.keyboard.press('/');

  await expect(page.getByRole('searchbox', { name: 'Search places' })).toBeFocused();
});

test('searches before any script runs, accents or not', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/?mag=any');
  const log = page.getByRole('region', { name: 'Every event' });

  await log.getByRole('searchbox', { name: 'Search places' }).fill('pahala');
  await log.getByRole('searchbox', { name: 'Search places' }).press('Enter');

  await expect(page).toHaveURL(/[?&]q=pahala/);
  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(1);
  await expect(log.locator('tbody mark')).toHaveText('Pāhala');
  await context.close();
});

test('sorts the log by size or by depth from its headings', async ({ page, isMobile }) => {
  test.skip(isMobile, 'A phone sorts from a menu');
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  await waitForHydrationOf(page.locator('fl-event-log'));
  const rows = log.locator('tbody tr:not(.day)');
  const heading = (name: string) => log.getByRole('columnheader', { name, exact: true });

  await heading('Mag').getByRole('link').click();

  await expect(page).toHaveURL(/\/\?mag=any&sort=largest$/);
  await expect(heading('Mag')).toHaveAttribute('aria-sort', 'descending');
  await expect(rows.nth(0)).toContainText('South of the Fiji Islands');
  await expect(rows.nth(1)).toContainText('Kermadec Islands');
  // Sorted by size, the days would interleave: one list, no day headings.
  await expect(log.locator('tr.day')).toHaveCount(0);
  await expect(log.locator('.more')).toContainText('The largest 10 of 14');

  await heading('Depth km').getByRole('link').click();

  await expect(page).toHaveURL(/sort=deepest$/);
  await expect(rows.nth(1)).toContainText('12 km NW of Anchorage');

  await heading('UTC').getByRole('link').click();

  await expect(page).toHaveURL(/\/\?mag=any$/);
  // Newest first, the days are headings again: one, or two once the last 24 hours cross midnight UTC.
  await expect(log.locator('tr.day').first()).toBeVisible();
});

test('filters the log on a phone from a sheet, its count on the way out', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'The phone layout');
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  await waitForHydrationOf(page.locator('fl-event-log'));

  await log.getByRole('button', { name: 'Filters' }).click();
  const sheet = page.getByRole('dialog', { name: 'Filters' });
  await sheet
    .getByRole('group', { name: 'Region' })
    .getByRole('link', { name: 'California 7 events' })
    .click();

  await expect(page).toHaveURL(/\/\?mag=any&region=california$/);
  await expect(sheet.getByRole('button', { name: 'Show 7 events' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Show 7 events' }).click();

  await expect(sheet).toBeHidden();
  await expect(log.locator('tbody tr:not(.day)')).toHaveCount(7);
  // Two filters away from their default: any magnitude, and the region.
  await expect(log.getByRole('button', { name: 'Filters 2 on' })).toBeFocused();
});

test('sorts the log on a phone from a menu', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The phone layout');
  await page.goto('/?mag=any');
  await waitForHydration(page);
  const log = page.getByRole('region', { name: 'Every event' });
  await waitForHydrationOf(page.locator('fl-event-log'));

  await log.getByRole('combobox', { name: 'Order' }).selectOption('Largest first');

  await expect(page).toHaveURL(/\/\?mag=any&sort=largest$/);
  await expect(log.locator('tbody tr:not(.day)').first()).toContainText(
    'South of the Fiji Islands',
  );
});
