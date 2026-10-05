import { Location } from '@angular/common';
import { MOCK_PLATFORM_LOCATION_CONFIG } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { currentPage } from './current-page';

@Component({ template: '' })
class Blank {}

/** The page as the Portuguese build reads it, the browser's address at `url`. */
function setUp(url = 'http://localhost/pt/') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: Blank },
        { path: 'quakes/:id', component: Blank },
      ]),
      { provide: MOCK_PLATFORM_LOCATION_CONFIG, useValue: { startUrl: url, appBaseHref: '/pt/' } },
    ],
  });
  return TestBed.runInInjectionContext(currentPage);
}

describe('currentPage', () => {
  it('reads the page from the address before the first navigation has landed', () => {
    expect(setUp('http://localhost/pt/quakes/us7000big?from=log')()).toBe(
      '/quakes/us7000big?from=log',
    );
  });

  it('writes the home page, filters and all, the way the router does', () => {
    expect(setUp('http://localhost/pt/?mag=any')()).toBe('/?mag=any');
    TestBed.resetTestingModule();
    expect(setUp('http://localhost/pt/')()).toBe('/');
  });

  it('follows each navigation, and leaves a jump within the page out', async () => {
    const page = setUp();
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/quakes/us7000big?from=log');
    expect(page()).toBe('/quakes/us7000big?from=log');

    TestBed.inject(Location).go('/quakes/us7000big?from=log#main');
    await router.navigateByUrl('/quakes/us7000big?from=log#main');
    expect(page()).toBe('/quakes/us7000big?from=log');
  });
});
