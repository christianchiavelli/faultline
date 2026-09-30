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
  /** Brings the page to the state shown, once it has rendered and hydrated. */
  readonly prepare?: (page: Page) => Promise<void>;
}

async function openExport(page: Page, button: string): Promise<Locator> {
  await page.getByRole('button', { name: button }).click();
  const dialog = page.getByRole('dialog', { name: 'Export events' });
  await dialog.waitFor();
  return dialog;
}

const SHOTS: readonly Shot[] = [
  { name: 'live-paper', path: '/', scheme: 'light' },
  { name: 'live-film', path: '/', scheme: 'dark' },
  { name: 'live-full-paper', path: '/', scheme: 'light', fullPage: true },
  // M5.4 north of Svalbard: reviewed, depth fixed by the analyst, full uncertainty.
  { name: 'quake-paper', path: '/quakes/us6000ty57', scheme: 'light' },
  { name: 'live-phone-film', path: '/', scheme: 'dark', viewport: PHONE },
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
  if (shot.prepare) {
    await shot.prepare(page);
    await page.waitForLoadState('networkidle');
  }

  await page.screenshot({ path: `${OUT_DIR}/${shot.name}.png`, fullPage: shot.fullPage ?? false });
  console.log(`captured ${shot.name}`);

  await context.close();
}

await browser.close();
