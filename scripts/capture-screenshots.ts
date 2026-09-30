/**
 * Captures the README screenshots from a running production server:
 *
 *   pnpm build && pnpm preview    then, in another terminal:
 *   pnpm screenshots              every shot
 *   pnpm screenshots quake-paper  only the ones named
 *
 * The live page shows whatever the planet did today. The event page shows a
 * past event instead, which the USGS keeps for good, so that screenshot and
 * the README text describing it stay true.
 *
 * Theme comes from the emulated colour scheme: the app follows the system
 * until a reader picks one, so `dark` is the film theme.
 */
import { chromium, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env['SCREENSHOT_BASE_URL'] ?? 'http://localhost:4000';
const OUT_DIR = 'docs/screenshots';

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 412, height: 915 };

interface Shot {
  readonly name: string;
  readonly path: string;
  readonly scheme: 'light' | 'dark';
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly fullPage?: boolean;
  /** Captures only this element, across the full width, scrolled into view before `prepare`. */
  readonly area?: string;
  /** Brings the page to the state shown, once it has rendered and hydrated. */
  readonly prepare?: (page: Page) => Promise<void>;
}

async function openExport(page: Page, button: string): Promise<Locator> {
  await page.getByRole('button', { name: button }).click();
  const dialog = page.getByRole('dialog', { name: 'Export events' });
  await dialog.waitFor();
  return dialog;
}

/** Points at a small event mid-drum, the kind the card is for: its burst barely moves the line. */
async function readSmallEvent(page: Page): Promise<void> {
  const target = await page.locator('fl-helicorder .paper').evaluate(async (paper) => {
    const body = await (await fetch('/api/quakes/recent?window=day')).json();
    const quakes = body.quakes as { time: number; magnitude: { value: number } | null }[];
    const hour = 3_600_000;
    const first = Math.floor(Date.now() / hour) * hour - 23 * hour;
    const box = paper.getBoundingClientRect();
    for (const { time, magnitude } of quakes) {
      const row = Math.floor((time - first) / hour);
      const at = (time - first) / hour - row;
      if (magnitude && magnitude.value < 3 && row >= 8 && row <= 16 && at > 0.25 && at < 0.75) {
        return { x: box.x + at * box.width, y: box.y + ((row + 0.5) / 24) * box.height };
      }
    }
    return null;
  });
  if (!target) throw new Error('No small event mid-drum to read today; try again later.');
  await page.mouse.move(target.x, target.y);
  await page.locator('fl-helicorder .card').waitFor();
}

const SHOTS: readonly Shot[] = [
  { name: 'live-paper', path: '/', scheme: 'light' },
  { name: 'live-film', path: '/', scheme: 'dark' },
  { name: 'live-full-paper', path: '/', scheme: 'light', fullPage: true },
  {
    name: 'live-reading-paper',
    path: '/',
    scheme: 'light',
    area: 'fl-helicorder',
    prepare: readSmallEvent,
  },
  { name: 'sizes-film', path: '/', scheme: 'dark', area: 'section.sizes' },
  // M5.4 north of Svalbard: reviewed, depth fixed by the analyst, full uncertainty.
  { name: 'quake-paper', path: '/quakes/us6000ty57', scheme: 'light' },
  { name: 'live-phone-film', path: '/', scheme: 'dark', viewport: PHONE },
  // Every Californian event of the day, largest first: the facets counted, the order in the heading.
  {
    name: 'log-film',
    path: '/?mag=any&region=california&sort=largest',
    scheme: 'dark',
    area: 'fl-event-log',
  },
  // The filters of a phone, in their sheet over the log they filter.
  {
    name: 'log-phone-paper',
    path: '/?depth=shallow',
    scheme: 'light',
    viewport: PHONE,
    prepare: async (page) => {
      await page.locator('fl-event-log').evaluate((log) => log.scrollIntoView({ block: 'start' }));
      await page.getByRole('button', { name: /^Filters/ }).click();
      await page.getByRole('dialog', { name: 'Filters' }).waitFor();
    },
  },
  // The M7.8 near Ende, 14 August 2026, and its aftershocks since.
  {
    name: 'export-paper',
    path: '/quakes/us6000tkt2',
    scheme: 'light',
    prepare: async (page) => {
      const dialog = await openExport(page, 'Export the events near this one…');
      await dialog.locator('a[download]').waitFor({ timeout: 60_000 });
    },
  },
  // A fixed past range, so the counts, and the suggestions made from them, hold still.
  {
    name: 'export-too-many-film',
    path: '/',
    scheme: 'dark',
    prepare: async (page) => {
      const dialog = await openExport(page, 'Export…');
      await dialog.locator('label').filter({ hasText: 'Custom' }).click();
      await dialog.locator('label').filter({ hasText: '4.5+' }).click();
      const [from, to] = await dialog.locator('input[type=date]').all();
      await from!.fill('2000-01-01');
      await to!.fill('2025-12-31');
      await to!.blur();
      await dialog.locator('.suggestion').nth(1).waitFor({ timeout: 60_000 });
    },
  },
];

/**
 * Scrolls the page end to end, so every deferred section renders and hydrates
 * the way it does for a reader, then back to the top.
 */
async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo(0, 0);
  });
}

const only = new Set(process.argv.slice(2));
const unknown = [...only].filter((name) => !SHOTS.some((shot) => shot.name === name));
if (unknown.length) throw new Error(`No such shot: ${unknown.join(', ')}`);

await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();

for (const shot of SHOTS.filter(({ name }) => only.size === 0 || only.has(name))) {
  const context = await browser.newContext({
    viewport: shot.viewport ?? DESKTOP,
    colorScheme: shot.scheme,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}${shot.path}`, { waitUntil: 'networkidle' });

  // Tokens are custom properties, so an unset one means the stylesheet never arrived.
  const styled = await page.evaluate(
    () => getComputedStyle(document.documentElement).getPropertyValue('--surface-page') !== '',
  );
  if (!styled) {
    throw new Error(
      `${shot.name}: the page loaded without its stylesheet. Restart the production ` +
        `server so it serves the current build, then run this again.`,
    );
  }

  await scrollThrough(page);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForLoadState('networkidle');
  const area = shot.area ? page.locator(shot.area) : null;
  // Before `prepare`: scrolling afterwards would move the page under a pointer it placed.
  await area?.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  if (shot.prepare) {
    await shot.prepare(page);
    await page.waitForLoadState('networkidle');
  }

  const box = await area?.boundingBox();
  await page.screenshot({
    path: `${OUT_DIR}/${shot.name}.png`,
    fullPage: shot.fullPage ?? false,
    clip: box
      ? { x: 0, y: box.y - 32, width: page.viewportSize()!.width, height: box.height + 64 }
      : undefined,
  });
  console.log(`captured ${shot.name}`);

  await context.close();
}

await browser.close();
