import { expect, type Locator, type Page } from '@playwright/test';

/** The value and hint under a readout label, e.g. "Events" or "Depth". */
export function readout(page: Page, label: string): Locator {
  return page
    .locator('.readout')
    .filter({ has: page.locator('dt', { hasText: label }) })
    .locator('dd');
}

/** Every `/api/` request the page makes from now on. */
export function recordApiCalls(page: Page): readonly string[] {
  const calls: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) calls.push(url.pathname + url.search);
  });
  return calls;
}

/**
 * Every error the page reports from now on, thrown or logged. A document the
 * server answered with an error status logs that it failed to load: that is
 * the page saying what it was told, not a fault of its own.
 */
export function recordErrors(page: Page): readonly string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  return errors;
}

/** The UTC clock only ticks in the browser, so a new time means the app has hydrated. */
export async function waitForHydration(page: Page): Promise<void> {
  const clock = page.locator('.clock');
  await expect(clock).not.toHaveText((await clock.textContent()) ?? '');
}

/**
 * A deferred section is server-rendered long before it hydrates, and until it
 * does, nothing in it runs. Angular drops the component's `ngh` marker once it
 * has hydrated.
 */
export async function waitForHydrationOf(section: Locator): Promise<void> {
  await section.scrollIntoViewIfNeeded();
  await expect(section).not.toHaveAttribute('ngh');
}

/** Two frames: long enough for an IntersectionObserver to report a scroll. */
export async function nextFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Brings every deferred section into view so it renders and hydrates, the way
 * a reader scrolling down would.
 */
export async function scrollThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    window.scrollTo(0, 0);
  });
}

/** Waits out the transitions under `locator`, so what is measured or audited is where it lands. */
export async function settled(locator: Locator): Promise<void> {
  await locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        // A loop never lands: the pen, or a line still on its way, breathes while it is there.
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        // One cut short, or on an element since removed, rejects: it has landed too.
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/**
 * Holds the answers to every request matching `pattern` until released, the
 * way a slow network would, so what a page shows while it waits stays on the
 * screen to be looked at. Released, later requests pass straight through.
 */
export async function hold(page: Page, pattern: string | RegExp): Promise<() => void> {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    await released;
    await route.fulfill({ response });
  });
  return release;
}

/**
 * Goes to `path` as Back or Forward would to a history entry holding nothing,
 * like one from before a link could hand over what it knew: the page there
 * starts from nothing, and waits for all of its data.
 */
export async function arriveEmptyHanded(page: Page, path: string): Promise<void> {
  await page.evaluate((path) => {
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate', { state: null }));
  }, path);
}

/** One event, asked of the API: not the day's feed, nor the export's count or its file. */
export const EVENT_API = /\/api\/quakes\/(?!recent|count|export)[^/?]+$/;

const HOUR = 3_600_000;

/**
 * Where an event's origin sits on the helicorder, in page coordinates: the
 * point a reader would move a pointer to, or tap. The drum's lines are read
 * off the page itself, so an hour turning mid-test cannot shift them.
 */
export async function traceOrigin(page: Page, id: string): Promise<{ x: number; y: number }> {
  const time = await page.evaluate(async (id) => {
    const body = await (await fetch('/api/quakes/recent?window=day')).json();
    return (body.quakes as { id: string; time: number }[]).find((quake) => quake.id === id)!.time;
  }, id);
  return tracePoint(page, time);
}

/** Where a moment of the last 24 hours sits on the helicorder, as `traceOrigin()` places an event. */
export async function tracePoint(page: Page, time: number): Promise<{ x: number; y: number }> {
  const current = Number(await page.locator('fl-helicorder .hours__current').textContent());
  let last = Math.floor(Date.now() / HOUR) * HOUR;
  if (new Date(last).getUTCHours() !== current) last -= HOUR;

  const paper = page.locator('fl-helicorder .paper');
  await paper.evaluate((element) => element.scrollIntoView({ block: 'center' }));
  const box = (await paper.boundingBox())!;
  const since = time - (last - 23 * HOUR);
  const row = Math.floor(since / HOUR);
  return {
    x: box.x + ((since - row * HOUR) / HOUR) * box.width,
    y: box.y + ((row + 0.5) / 24) * box.height,
  };
}

/** The feed's stream, whatever the copy a page follows it from. */
export const FEED_STREAM = /\/api\/quakes\/recent\/stream\?/;

export interface Arrival {
  readonly id: string;
  readonly place: string;
  readonly magnitude: number;
}

/**
 * Holds the feed's stream until the function it returns is called, then has
 * it push more events, the way a quake that has just happened reaches an open
 * page. Call it before the page loads: a page follows the feed from the moment
 * it hydrates.
 */
export async function holdStream(
  page: Page,
): Promise<(...quakes: readonly Arrival[]) => Promise<void>> {
  let push!: (body: string) => void;
  const pushed = new Promise<string>((resolve) => (push = resolve));
  await page.route(FEED_STREAM, async (route) =>
    route.fulfill({ contentType: 'text/event-stream', body: await pushed }),
  );

  return async (...quakes) => {
    const feed = (await (await page.request.get('/api/quakes/recent?window=day')).json()) as {
      generatedAt: number;
      skipped: number;
    };
    const change = {
      generatedAt: feed.generatedAt,
      stale: false,
      skipped: feed.skipped,
      upserted: quakes.map((quake) => ({
        id: quake.id,
        time: Date.now() - 60_000,
        magnitude: { value: quake.magnitude, type: 'md' },
        place: quake.place,
        location: { latitude: 38.8, longitude: -122.75, depthKm: 2.1 },
        review: 'automatic',
        kind: 'earthquake',
      })),
      removed: [],
    };
    // The body ends with the message, so the browser reconnects: not for an hour, or the real
    // stream would answer and take the arrivals away again.
    push(
      `retry: 3600000\n\nevent: change\nid: ${feed.generatedAt}-f\ndata: ${JSON.stringify(change)}\n\n`,
    );
  };
}
