import { Component, LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Languages } from './languages';

@Component({ template: '' })
class Blank {}

async function render(locale: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'quakes/:id', component: Blank }]),
      { provide: LOCALE_ID, useValue: locale },
    ],
  });
  await RouterTestingHarness.create('/quakes/us7000abcd');
  const fixture = TestBed.createComponent(Languages);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/** What a sighted reader sees: the text less what is there for screen readers alone. */
function shown(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.visually-hidden').forEach((node) => node.remove());
  return copy.textContent?.replace(/\s+/g, '') ?? '';
}

describe('Languages', () => {
  it('marks the language of the page, and links the other in its own words', async () => {
    const element = await render('en-GB');
    const current = element.querySelector('.current')!;
    const other = element.querySelector('a')!;

    expect(shown(element)).toBe('EN·PT');
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(current.getAttribute('lang')).toBe('en-GB');
    expect(other.getAttribute('href')).toBe('/pt/quakes/us7000abcd');
    expect(other.getAttribute('hreflang')).toBe('pt');
    expect(other.getAttribute('lang')).toBe('pt-BR');
    // Its name starts with what it shows, so "PT" said to a voice control finds it.
    expect(other.textContent).toBe('PT, Ler em português');
  });

  it('links back to English from a Portuguese page', async () => {
    const element = await render('pt-BR');

    expect(element.querySelector('.current')?.textContent?.trim()).toBe('PT');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/quakes/us7000abcd');
    expect(element.querySelector('a')?.textContent).toBe('EN, Read in English');
  });
});
