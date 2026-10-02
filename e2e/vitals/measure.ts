import { readFileSync } from 'node:fs';
import type { Browser, BrowserContextOptions, Locator, Page } from '@playwright/test';
import type * as WebVitals from 'web-vitals/attribution';
import { waitForHydration } from '../support/page';
import type { Measurement, Metric, Page as MeasuredPage, Reading } from './report';

declare global {
  interface Window {
    webVitals: typeof WebVitals;
    vitals: Partial<Record<Metric, Reading>>;
  }
}

/**
 * The phone of Lighthouse's mobile run, a Moto G Power, on its connection:
 * slow 4G, with a CPU four times slower than the machine's. The latency and
 * throughputs are the ones Lighthouse uses when DevTools applies the
 * throttling, which delays each request rather than each packet, and so takes
 * a longer round trip to match 150 ms.
 */
const PHONE: BrowserContextOptions = {
  viewport: { width: 412, height: 823 },
  deviceScaleFactor: 1.75,
  isMobile: true,
  hasTouch: true,
};
const NETWORK = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1474.56 * 1024) / 8,
  uploadThroughput: (675 * 1024) / 8,
};
const CPU_SLOWDOWN = 4;

/**
 * web-vitals as a script for the page: the build with attribution, which says
 * what each number is about. Playwright runs an init script in a scope of its
 * own, where the build's `var` stays, so it is handed to the page by name.
 */
const WEB_VITALS = `${readFileSync(
  new URL('web-vitals.attribution.iife.js', import.meta.resolve('web-vitals')),
  'utf8',
)}\nself.webVitals = webVitals;`;

/**
 * Keeps the latest value web-vitals reports for each metric, with what it is
 * about. Every change is reported, not only a final value, since a visit ends
 * with its context closed rather than its tab hidden. Runs in the page.
 */
function record(): void {
  // An element named the way a reader would find it: its tag, its first class, the start of its text.
  const describe = (node: Node | null): string | undefined => {
    if (!(node instanceof Element)) return undefined;
    const name = node.classList[0] ? `${node.localName}.${node.classList[0]}` : node.localName;
    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    return text ? `${name} “${text.length > 40 ? `${text.slice(0, 39)}…` : text}”` : name;
  };
  const vitals: Window['vitals'] = (window.vitals = {});
  const { onCLS, onINP, onLCP } = window.webVitals;
  const options = { reportAllChanges: true, generateTarget: describe };

  // DevTools adds the connection's latency after the first byte, so the time to it and the
  // render delay split the wait wrongly here: only an image's own load says something.
  onLCP(({ value, attribution }) => {
    vitals.LCP = {
      value,
      target: attribution.url
        ? `${attribution.target} from ${attribution.url}`
        : attribution.target,
      parts: attribution.url ? { 'loading it': attribution.resourceLoadDuration } : {},
    };
  }, options);
  onCLS(({ value, attribution }) => {
    vitals.CLS = {
      value,
      target: attribution.largestShiftTarget,
      parts:
        attribution.largestShiftTime === undefined
          ? {}
          : { 'into the visit': attribution.largestShiftTime },
    };
  }, options);
  onINP(
    ({ value, attribution }) => {
      vitals.INP = {
        value,
        target:
          attribution.interactionTarget &&
          `${attribution.interactionType} on ${attribution.interactionTarget}`,
        parts: {
          'input delay': attribution.inputDelay,
          processing: attribution.processingDuration,
          'until the next paint': attribution.presentationDelay,
          ...(attribution.totalScriptDuration === undefined
            ? {}
            : { 'of it in script': attribution.totalScriptDuration }),
          ...(attribution.totalStyleAndLayoutDuration === undefined
            ? {}
            : { 'in style and layout': attribution.totalStyleAndLayoutDuration }),
        },
      };
    },
    // Down to 16 ms, the least the browser reports, so the fast interactions count too.
    { ...options, durationThreshold: 16 },
  );
}

async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
}

/**
 * Waits for the page to go quiet: a second without a long frame, then the
 * first moment the main thread has nothing to do. What the last input set off
 * has painted, been measured, and been cleared up after, by the collector
 * too, which can trail a large render by a second or more. A reader takes
 * longer to look before touching the page again, and an interaction measured
 * on the tail of the one before would blame it for that one's work.
 */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let quiet: ReturnType<typeof setTimeout> | undefined;
        const done = () => {
          clearTimeout(quiet);
          clearTimeout(limit);
          observer.disconnect();
          requestIdleCallback(() => resolve(), { timeout: 2_000 });
        };
        const wait = () => {
          clearTimeout(quiet);
          quiet = setTimeout(done, 1_000);
        };
        const observer = new PerformanceObserver(wait);
        observer.observe({ type: 'long-animation-frame' });
        wait();
        // A page that is never quiet is measured anyway, after as long as a reader would wait.
        const limit = setTimeout(done, 5_000);
      }),
  );
}

/** Taps `target`, then waits for the page to answer, as a reader would. */
export async function tap(target: Locator): Promise<void> {
  await target.tap();
  await settle(target.page());
}

/** Types `text` into `field` a key at a time, at the pace of thumbs on a phone. */
export async function typeInto(field: Locator, text: string): Promise<void> {
  await tap(field);
  await field.pressSequentially(text, { delay: 150 });
  await settle(field.page());
}

/**
 * Down the page a screen at a time, the way a reader goes, and back up: each
 * deferred section renders as it comes into view, and one that moves what is
 * on the screen counts as shift. A second on each screen gives a section's
 * code time to arrive over the slow connection, as it would while it is read.
 */
async function readThrough(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const dwell = () => new Promise((resolve) => setTimeout(resolve, 1_000));
    const end = () => document.documentElement.scrollHeight - innerHeight;
    for (let last = -1; scrollY > last && scrollY < end();) {
      last = scrollY;
      scrollBy(0, innerHeight * 0.8);
      await dwell();
    }
    scrollTo(0, 0);
    await dwell();
  });
}

export interface Visit extends MeasuredPage {
  /** What a reader does once the page is up: INP is the slowest of these interactions. */
  readonly journey: (page: Page) => Promise<void>;
}

/**
 * One visit, the way a reader arriving cold makes it: nothing cached, the
 * page loaded and hydrated, read to the end, then used. LCP is read before
 * the first scroll, as a reader's first input ends it; CLS and INP as they
 * leave.
 */
export async function measure(
  browser: Browser,
  baseURL: string,
  visit: Visit,
): Promise<Measurement> {
  const context = await browser.newContext({ ...PHONE, baseURL });
  try {
    const page = await context.newPage();
    await page.addInitScript({ content: WEB_VITALS });
    await page.addInitScript(record);
    await throttle(page);

    await page.goto(visit.path);
    await waitForHydration(page);
    await settle(page);
    const { LCP } = await page.evaluate(() => window.vitals);

    await readThrough(page);
    await visit.journey(page);
    await settle(page);
    const { CLS, INP } = await page.evaluate(() => window.vitals);

    if (!LCP || !CLS || !INP) {
      throw new Error(
        `${visit.path}: web-vitals reported ${LCP ? '' : 'no LCP '}${CLS ? '' : 'no CLS '}${INP ? '' : 'no INP'}`,
      );
    }
    return { LCP, CLS, INP };
  } finally {
    await context.close();
  }
}
