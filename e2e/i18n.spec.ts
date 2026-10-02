import { expect, test } from '@playwright/test';
import { readout, waitForHydration } from './support/page';

/**
 * Two builds, one per language: British English at the root, Brazilian
 * Portuguese under /pt. Each is rendered on the server in its own language,
 * says where the other one is, and leaves a reader on the same page, its
 * filters kept, when they switch.
 */

test.describe('rendered on the server', () => {
  test.use({ javaScriptEnabled: false });

  test('serves Portuguese under /pt, its numbers written the Portuguese way', async ({ page }) => {
    const response = await page.goto('/pt/');

    expect(response?.headers()['content-language']).toBe('pt-BR');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '24 horas de um planeta inquieto',
    );
    await expect(readout(page, 'Maior')).toContainText('M6,2Mww');
    await expect(page.getByRole('region', { name: 'Todos os eventos' })).toContainText(
      'M2,5 ou mais',
    );
  });

  test('keeps the place names of the catalogue, and says why', async ({ page }) => {
    await page.goto('/pt/');

    await expect(
      page.getByRole('link', { name: 'South of the Fiji Islands' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText(
      'Os nomes de lugares são os do próprio catálogo do USGS, em inglês.',
    );
  });

  test('says nothing of the kind in English', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expect(page.getByRole('contentinfo')).not.toContainText('Place names');
  });

  test('points search engines to the page in each language, English for any other', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/pt/quakes/us7000big');
    const alternates = await page
      .locator('link[rel="alternate"][hreflang]')
      .evaluateAll((links) =>
        links.map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]),
      );

    expect(alternates).toEqual([
      ['en', `${baseURL}/quakes/us7000big`],
      ['pt', `${baseURL}/pt/quakes/us7000big`],
      ['x-default', `${baseURL}/quakes/us7000big`],
    ]);
  });

  test('answers a missing event in Portuguese, with the status it has in English', async ({
    page,
  }) => {
    const response = await page.goto('/pt/quakes/zz404');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Evento inexistente');
    await expect(
      page.getByText('O catálogo do USGS não tem nenhum evento com o id zz404.'),
    ).toBeVisible();
  });
});

test('switches language from the bar, on the same page with the same filters', async ({ page }) => {
  await page.goto('/?mag=4.5&q=neiafu');
  await waitForHydration(page);

  await page.getByRole('link', { name: 'Ler em português' }).click();

  await expect(page).toHaveURL(/\/pt\/\?mag=4\.5&q=neiafu$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('searchbox', { name: 'Buscar lugares' })).toHaveValue('neiafu');
  await expect(page.locator('.tally')).toHaveText('1 de 14 eventos · M4,5 ou mais');

  await page.getByRole('link', { name: 'Read in English' }).click();

  await expect(page).toHaveURL(/\/\?mag=4\.5&q=neiafu$/);
  await expect(page.locator('.tally')).toHaveText('1 of 14 events · M4.5 and up');
});

test('reads an event in Portuguese: its numbers, its date and its record', async ({ page }) => {
  await page.goto('/pt/quakes/us7000big');
  await waitForHydration(page);

  // The weekday and the month in their Portuguese abbreviations, as in "sex., 2 de out. de 2026".
  await expect(page.locator('.when time')).toHaveText(
    /^\s*\p{L}{3}\., \d{1,2} de \p{L}{3}\. de \d{4}, \d\d:\d\d:\d\d UTC\s*$/u,
  );
  await expect(readout(page, 'Profundidade')).toContainText('560,2km');
  await expect(readout(page, 'Epicentro')).toContainText('−24,300; −178,100');
  await expect(page.getByRole('region', { name: 'O registro' })).toContainText('depois do evento');
});
