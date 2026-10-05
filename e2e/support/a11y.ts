import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/** Every WCAG 2.2 AA violation on the page, readable on failure: which rule, and where. */
export async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  return violations.map(({ id, nodes }) => ({
    id,
    targets: nodes.map((node) => node.target.join(' ')),
  }));
}
