import { expect, test, type Locator, type Page } from '@playwright/test';
import { waitForHydration } from './support/page';

/** How long `locator` takes to change, read off its style: the durations of its transitions. */
const transitionOf = (locator: Locator) =>
  locator.evaluate((element) => [
    ...new Set(getComputedStyle(element).transitionDuration.split(', ')),
  ]);

/** The loops running on the page, by what they move and how long one breath lasts. */
const loops = (page: Page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations === Infinity)
      .filter((animation) => animation.playState === 'running')
      .map((animation) => {
        const target = (animation.effect as KeyframeEffect).target as Element;
        return { on: target.className, every: animation.effect?.getTiming().duration };
      }),
  );

/**
 * Whether each page change since the page loaded cross-faded, carried the
 * magnitude read into the new page's title as it did, or was skipped.
 */
async function watchPageChanges(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const start = document.startViewTransition.bind(document);
    const outcomes: Promise<string>[] = [];
    Object.assign(window, { pageChanges: outcomes });
    document.startViewTransition = ((update: Parameters<typeof start>[0]) => {
      const transition = start(update);
      outcomes.push(
        transition.ready.then(
          () =>
            document
              .getAnimations()
              .some(
                (animation) =>
                  (animation.effect as KeyframeEffect | null)?.pseudoElement ===
                  '::view-transition-group(magnitude)',
              )
              ? 'cross-faded, the magnitude flying'
              : 'cross-faded',
          () => 'skipped',
        ),
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
  return () =>
    page.evaluate(() =>
      Promise.all((window as unknown as { pageChanges: Promise<string>[] }).pageChanges),
    );
}

test.describe('motion', () => {
  test('moves each thing at the pace of its part', async ({ page }) => {
    const changes = await watchPageChanges(page);
    await page.goto('/');
    await waitForHydration(page);

    // Live: the pen and the Live dot breathe together, one breath every 2.4 s.
    expect(await loops(page)).toEqual(
      expect.arrayContaining([
        { on: 'pen-head', every: 2400 },
        { on: 'status__dot', every: 2400 },
      ]),
    );

    // Presence: a menu comes in at the enter pace, and leaves faster than it came.
    const menu = page.locator('fl-theme-menu [popover]');
    await page.getByRole('button', { name: /^Theme:/ }).click();
    await expect(menu).toBeVisible();
    expect(await transitionOf(menu)).toEqual(['0.2s']);
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    expect(await transitionOf(menu)).toEqual(['0.14s']);

    // Navigation: a new page cross-fades in, an event's carrying in the magnitude read off its
    // label, and a change of filter swaps in place.
    await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).click();
    await expect(page).toHaveURL(/\/quakes\/us7000big$/);
    await page.getByRole('link', { name: 'Live', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '24 hours of a restless planet',
    );
    expect(await changes()).toEqual(['cross-faded, the magnitude flying', 'cross-faded']);
  });

  test('keeps every change and drops the movement under reduced motion', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    const changes = await watchPageChanges(page);
    await page.goto('/');
    await waitForHydration(page);

    // Nothing loops: the pen and the Live dot hold still.
    expect(await loops(page)).toEqual([]);

    // A menu is there at once, and gone at once.
    const menu = page.locator('fl-theme-menu [popover]');
    await page.getByRole('button', { name: /^Theme:/ }).click();
    await expect(menu).toBeVisible();
    expect(await transitionOf(menu)).toEqual(['0s']);

    // A page swaps without a cross-fade, and so without the snapshots one takes.
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'M6.2 Mww, South of the Fiji Islands' }).click();
    await expect(page).toHaveURL(/\/quakes\/us7000big$/);
    expect(await changes()).toEqual(['skipped']);

    // A control's feedback is colour, which moves nothing: it still eases.
    expect(await transitionOf(page.getByRole('link', { name: 'Live', exact: true }))).toEqual([
      '0.12s',
    ]);
    await context.close();
  });
});
