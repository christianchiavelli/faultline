import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { scrollThrough } from './support/page';

const PAGES = ['/', '/?min=all', '/quakes/us7000big', '/quakes/us7000tonga', '/quakes/zz404'];
const THEMES = ['paper', 'film'] as const;

for (const theme of THEMES) {
  for (const path of PAGES) {
    test(`${path} meets WCAG 2.2 AA on ${theme}`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: 'fl-theme', value: theme, url: baseURL! }]);
      await page.goto(path);
      await scrollThrough(page);

      const { violations } = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();

      // Readable on failure: which rule, and where.
      expect(
        violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map((node) => node.target.join(' ')),
        })),
      ).toEqual([]);
    });
  }
}
