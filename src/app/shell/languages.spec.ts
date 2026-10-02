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

describe('Languages', () => {
  it('marks the language of the page, and links the other in its own words', async () => {
    const element = await render('en-GB');
    const current = element.querySelector('.current')!;
    const other = element.querySelector('a')!;

    expect(element.textContent?.replace(/\s+/g, '')).toBe('EN·PT');
    expect(current.getAttribute('aria-current')).toBe('true');
    expect(current.getAttribute('lang')).toBe('en-GB');
    expect(other.getAttribute('href')).toBe('/pt/quakes/us7000abcd');
    expect(other.getAttribute('hreflang')).toBe('pt');
    expect(other.getAttribute('lang')).toBe('pt-BR');
    expect(other.getAttribute('aria-label')).toBe('Ler em português');
  });

  it('links back to English from a Portuguese page', async () => {
    const element = await render('pt-BR');

    expect(element.querySelector('.current')?.textContent?.trim()).toBe('PT');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/quakes/us7000abcd');
    expect(element.querySelector('a')?.getAttribute('aria-label')).toBe('Read in English');
  });
});
