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
import { chromium, type Page } from '@playwright/test';
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
}

const SHOTS: readonly Shot[] = [
  { name: 'live-paper', path: '/', scheme: 'light' },
  { name: 'live-film', path: '/', scheme: 'dark' },
  { name: 'live-full-paper', path: '/', scheme: 'light', fullPage: true },
  // M5.4 north of Svalbard: reviewed, depth fixed by the analyst, full uncertainty.
  { name: 'quake-paper', path: '/quakes/us6000ty57', scheme: 'light' },
  { name: 'live-phone-film', path: '/', scheme: 'dark', viewport: PHONE },
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

  await page.screenshot({ path: `${OUT_DIR}/${shot.name}.png`, fullPage: shot.fullPage ?? false });
  console.log(`captured ${shot.name}`);

  await context.close();
}

await browser.close();
