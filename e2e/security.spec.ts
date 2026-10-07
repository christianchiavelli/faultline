import { expect, test, type Page } from '@playwright/test';
import { waitForHydration } from './support/page';

const PAGES = [
  '/',
  '/quakes/us7000big',
  '/quakes/zz404',
  '/nowhere',
  '/pt/',
  '/pt/quakes/us7000big',
];

function blocked(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { violations: string[] }).violations);
}

/** Opens `path` and returns what the page's policy blocked on its way to hydrating. */
async function violationsOn(page: Page, path: string): Promise<string[]> {
  await page.goto(path);
  // Hydrating means the app's own scripts ran, under the policy.
  await waitForHydration(page);
  return blocked(page);
}

const nonceIn = (policy: string | undefined) => /'nonce-([^']+)'/.exec(policy ?? '')?.[1];

test.describe('the content security policy', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const violations: string[] = [];
      Object.assign(window, { violations });
      document.addEventListener('securitypolicyviolation', (event) =>
        violations.push(
          `${event.effectiveDirective} ${event.blockedURI} at ${event.sourceFile}:${event.lineNumber} “${event.sample}”`,
        ),
      );
    });
  });

  test('gives every page a nonce of its own, in its markup and in its policy', async ({
    request,
  }) => {
    const [first, second] = await Promise.all([request.get('/'), request.get('/')]);
    const nonce = nonceIn(first.headers()['content-security-policy']);
    const html = await first.text();

    expect(nonce).toBeTruthy();
    expect(html).toContain(`nonce="${nonce}"`);
    expect(html).not.toContain('__CSP_NONCE__');
    expect(nonceIn(second.headers()['content-security-policy'])).not.toBe(nonce);
  });

  for (const path of PAGES) {
    test(`lets ${path} run with nothing blocked`, async ({ page }) => {
      expect(await violationsOn(page, path)).toEqual([]);
    });
  }

  test('lets a dialog load its code and styles with nothing blocked', async ({ page }) => {
    await violationsOn(page, '/?mag=any');

    await page.getByRole('button', { name: 'Export…' }).click();
    await expect(page.getByRole('heading', { name: 'Export events' })).toBeVisible();

    expect(await blocked(page)).toEqual([]);
  });
});
