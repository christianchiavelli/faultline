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
        // A loop never lands: the pen breathes for as long as it is there.
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        // One cut short, or on an element since removed, rejects: it has landed too.
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

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

/**
 * Delivers more events with the page's next poll of the feed, the way a quake
 * that has just happened reaches an open page. Needs the page clock installed
 * before the page loads, to bring that poll forward.
 */
export async function arrive(
  page: Page,
  ...quakes: readonly { readonly id: string; readonly place: string; readonly magnitude: number }[]
): Promise<void> {
  await page.route('**/api/quakes/recent?window=day', async (route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { quakes: unknown[] };
    body.quakes.unshift(
      ...quakes.map((quake) => ({
        id: quake.id,
        time: Date.now() - 60_000,
        magnitude: { value: quake.magnitude, type: 'md' },
        place: quake.place,
        location: { latitude: 38.8, longitude: -122.75, depthKm: 2.1 },
        review: 'automatic',
        kind: 'earthquake',
      })),
    );
    await route.fulfill({ response, json: body });
  });
  await page.clock.fastForward('01:00');
}
