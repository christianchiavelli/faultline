import { DOCUMENT } from '@angular/common';
import { Component, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { linkAlternateLanguages, pageInEveryLanguage } from './languages';

@Component({ template: '' })
class Blank {}

/** Each test reads the languages from a page of its own, as a component would. */
@Component({ template: '' })
class Reader {
  readonly languages = pageInEveryLanguage();

  constructor() {
    linkAlternateLanguages();
  }
}

async function open(url: string, locale = 'en-GB') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Blank },
        { path: 'quakes/:id', component: Blank },
      ]),
      { provide: LOCALE_ID, useValue: locale },
    ],
  });
  const harness = await RouterTestingHarness.create(url);
  const reader = TestBed.createComponent(Reader);
  await reader.whenStable();
  return { harness, reader };
}

const alternates = () =>
  [...TestBed.inject(DOCUMENT).head.querySelectorAll('link[rel="alternate"]')].map((link) => [
    link.getAttribute('hreflang'),
    link.getAttribute('href'),
  ]);

afterEach(() => {
  for (const link of document.head.querySelectorAll('link[rel="alternate"]')) link.remove();
});

describe('pageInEveryLanguage', () => {
  it('gives the page in each language, its filters kept, and marks the one it is in', async () => {
    const { reader } = await open('/?mag=4.5&q=alaska');

    expect(
      reader.componentInstance
        .languages()
        .map(({ short, href, current }) => [short, href, current]),
    ).toEqual([
      ['EN', '/?mag=4.5&q=alaska', true],
      ['PT', '/pt/?mag=4.5&q=alaska', false],
    ]);
  });

  it('knows the Portuguese build for what it is', async () => {
    const { reader } = await open('/quakes/us7000abcd', 'pt-BR');

    expect(reader.componentInstance.languages().find((language) => language.current)).toMatchObject(
      { short: 'PT', href: '/pt/quakes/us7000abcd' },
    );
  });

  it('follows the reader from page to page', async () => {
    const { harness, reader } = await open('/');

    await harness.navigateByUrl('/quakes/us7000abcd');

    expect(reader.componentInstance.languages().map(({ href }) => href)).toEqual([
      '/quakes/us7000abcd',
      '/pt/quakes/us7000abcd',
    ]);
  });
});

describe('linkAlternateLanguages', () => {
  it('points search engines to the page in every language, English for the rest', async () => {
    const { harness, reader } = await open('/quakes/us7000abcd');
    const { origin } = TestBed.inject(DOCUMENT).location;

    expect(alternates()).toEqual([
      ['en', `${origin}/quakes/us7000abcd`],
      ['pt', `${origin}/pt/quakes/us7000abcd`],
      ['x-default', `${origin}/quakes/us7000abcd`],
    ]);

    await harness.navigateByUrl('/');
    await reader.whenStable();

    expect(alternates()).toEqual([
      ['en', `${origin}/`],
      ['pt', `${origin}/pt/`],
      ['x-default', `${origin}/`],
    ]);
  });
});
