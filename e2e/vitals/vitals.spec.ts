import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { tracePoint } from '../support/page';
import { measure, settle, tap, typeInto, type Visit } from './measure';
import {
  ATTACHMENT,
  METRICS,
  explain,
  format,
  limitOf,
  readBaseline,
  summarise,
  type Measurement,
} from './report';

/**
 * Each page visited five times, the way a reader uses it on a phone: loaded
 * cold, read to the end, then put to work. The median of each metric is held
 * against the baseline, and a page that has none yet is measured, not judged.
 */
const VISITS = 5;

const DAY = JSON.parse(readFileSync(new URL('day.json', import.meta.url), 'utf8')) as {
  readonly largest: string;
};

const PAGES: readonly Visit[] = [
  {
    key: 'live',
    name: 'The live page',
    path: '/',
    journey: async (page) => {
      const log = page.getByRole('region', { name: 'Every event' });

      // Reads an event off the trace, from the newest back to the first burst no label covers:
      // a label is a link to its event, and where the labels fall depends on the hour.
      const day = (await (await page.request.get('/api/quakes/recent?window=day')).json()) as {
        quakes: { time: number }[];
      };
      for (const { time } of day.quakes) {
        const point = await tracePoint(page, time);
        const free = await page.evaluate(
          ({ x, y }) => !document.elementFromPoint(x, y)?.closest('a'),
          point,
        );
        if (free) {
          await page.touchscreen.tap(point.x, point.y);
          break;
        }
      }
      await expect(page.locator('fl-helicorder .card')).toBeVisible();
      await settle(page);

      // Takes the magnitude filter off, from the sheet a phone keeps the filters in.
      await tap(log.getByRole('button', { name: 'Filters' }));
      const sheet = page.getByRole('dialog', { name: 'Filters' });
      await tap(
        sheet.getByRole('group', { name: 'Magnitude' }).getByRole('link', { name: /^Any/ }),
      );
      await expect(page).toHaveURL(/\/\?mag=any$/);
      await tap(sheet.getByRole('button', { name: /^Show \d+ events$/ }));
      await expect(sheet).toBeHidden();

      // Unfolds the whole day, then searches it.
      await tap(log.getByRole('link', { name: /^Show all \d+/ }));
      await expect(page).toHaveURL(/rows=all/);
      await typeInto(log.getByRole('searchbox', { name: 'Search places' }), 'alaska');
      await expect(page).toHaveURL(/q=alaska/);

      // Switches to the film theme, which repaints the whole page.
      await tap(page.getByRole('button', { name: /^Theme: / }));
      await tap(page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Film' }));
      await expect(page.getByRole('button', { name: 'Theme: Film' })).toBeVisible();

      // Opens the export, and closes it.
      await tap(page.getByRole('button', { name: 'Export…' }));
      const dialog = page.getByRole('dialog', { name: 'Export events' });
      await tap(dialog.getByRole('button', { name: 'Close' }));
      await expect(dialog).toBeHidden();

      // Opens the first event found.
      await tap(log.locator('tbody tr:not(.day)').first().getByRole('link').first());
      await expect(page).toHaveURL(/\/quakes\//);
    },
  },
  {
    key: 'quake',
    name: "An event's page",
    path: `/quakes/${DAY.largest}`,
    journey: async (page) => {
      // Opens the export of the events around it, and closes it.
      await tap(page.getByRole('button', { name: 'Export the events near this one…' }));
      const dialog = page.getByRole('dialog', { name: 'Export events' });
      await tap(dialog.getByRole('button', { name: 'Close' }));
      await expect(dialog).toBeHidden();

      // Goes back to the live page.
      await tap(page.getByRole('link', { name: 'Live', exact: true }));
      await expect(page).toHaveURL(/\/$/);
    },
  },
];

const baseline = readBaseline();

for (const { journey, ...page } of PAGES) {
  test(`${page.name}, ${page.path}`, async ({ browser, baseURL }, testInfo) => {
    const visits: Measurement[] = [];
    for (let visit = 1; visit <= VISITS; visit++) {
      visits.push(
        await test.step(`visit ${visit} of ${VISITS}`, () =>
          measure(browser, baseURL!, { ...page, journey })),
      );
    }
    const result = summarise(page, visits);
    await testInfo.attach(ATTACHMENT, {
      body: JSON.stringify(result),
      contentType: 'application/json',
    });

    const base = baseline.pages[page.key];
    if (!base) {
      testInfo.annotations.push({
        type: 'notice',
        description: 'No baseline yet: measured, not judged',
      });
      return;
    }
    for (const metric of METRICS) {
      const value = result.median[metric];
      const typical = visits.find((visit) => visit[metric].value === value)![metric];
      expect
        .soft(
          value,
          `${metric} ${format(metric, value)} against a baseline of ${format(metric, base[metric])}, ${explain(metric, typical)}`,
        )
        .toBeLessThanOrEqual(limitOf(metric, base[metric]));
    }
  });
}
