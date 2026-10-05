/**
 * Captures the README screenshots from the production build, served by the
 * real server against the real USGS, as a reader sees it:
 *
 *   pnpm screenshots              builds, then every shot
 *   pnpm screenshots quake-paper  builds, then only the ones named
 *
 * The server is started here, on a port nothing else holds, and stopped when
 * the captures are done: nothing left running from an older build can answer
 * instead.
 *
 * The live page shows whatever the planet did today. The event page shows a
 * past event instead, which the USGS keeps for good, so that screenshot and
 * the README text describing it stay true.
 *
 * Theme comes from the emulated colour scheme: the app follows the system
 * until a reader picks one, so `dark` is the film theme.
 */
import { chromium, type Browser, type Locator, type Page } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { scrollThrough } from '../e2e/support/page.ts';

const SERVER = 'dist/faultline/server/server.mjs';
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
  // The same event in Portuguese: its words, numbers and date the Portuguese way, its place the catalogue's.
  { name: 'quake-pt-paper', path: '/pt/quakes/us6000ty57', scheme: 'light' },
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

/** A port the system has just handed out, so free a moment ago. */
async function freePort(): Promise<number> {
  const probe = createServer().listen(0);
  await once(probe, 'listening');
  const { port } = probe.address() as { port: number };
  probe.close();
  return port;
}

/** Starts the production server, and resolves once it answers a page. */
async function serve(): Promise<{ readonly url: string; readonly stop: () => Promise<void> }> {
  const port = await freePort();
  const server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const exited = once(server, 'exit');
  const url = `http://localhost:${port}`;
  const stop = async () => {
    if (server.exitCode !== null) return;
    server.kill();
    await exited;
  };

  const answers = () =>
    fetch(url).then(
      ({ ok }) => ok,
      () => false,
    );
  const deadline = Date.now() + 60_000;
  while (!(await answers())) {
    if (server.exitCode !== null) throw new Error(`${SERVER} exited with ${server.exitCode}`);
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`${SERVER} did not answer on ${url} within a minute`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { url, stop };
}

async function capture(browser: Browser, url: string, shot: Shot): Promise<void> {
  const context = await browser.newContext({
    viewport: shot.viewport ?? DESKTOP,
    colorScheme: shot.scheme,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });
  // A screenshot is a still. The live page keeps the copy it was rendered with, and its stream,
  // held open, would keep the network from ever falling quiet.
  await context.route(/\/api\/quakes\/recent\/stream\?/, (route) => route.fulfill({ status: 204 }));
  const page = await context.newPage();
  await page.goto(`${url}${shot.path}`, { waitUntil: 'networkidle' });

  // A screenshot has no scrollbar over its gutter, where the page's bands would stop short of the edge.
  await page.addStyleTag({ content: 'html { scrollbar-width: none; }' });
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

const only = new Set(process.argv.slice(2));
const unknown = [...only].filter((name) => !SHOTS.some((shot) => shot.name === name));
if (unknown.length) throw new Error(`No such shot: ${unknown.join(', ')}`);

await mkdir(OUT_DIR, { recursive: true });
const server = await serve();
try {
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS.filter(({ name }) => only.size === 0 || only.has(name))) {
      await capture(browser, server.url, shot);
    }
  } finally {
    await browser.close();
  }
} finally {
  await server.stop();
}
