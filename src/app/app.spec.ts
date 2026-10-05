import { APP_BASE_HREF, ViewportScroller } from '@angular/common';
import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Scroll, provideRouter, withInMemoryScrolling } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { App } from './app';

@Component({ template: '<p>A page</p>' })
class Page {}

async function render(baseHref = '/') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: '', component: Page },
          { path: 'quakes/:id', component: Page },
        ],
        withInMemoryScrolling(),
      ),
      { provide: APP_BASE_HREF, useValue: baseHref },
    ],
  });
  const app = TestBed.inject(ApplicationRef);
  const router = TestBed.inject(Router);
  const scrolls = vi.spyOn(TestBed.inject(ViewportScroller), 'scrollToPosition');
  const scrolled = () =>
    firstValueFrom(router.events.pipe(filter((event) => event instanceof Scroll)));

  // Bootstrapped rather than created: the router starts, and starts reporting
  // where to scroll, when the root component is bootstrapped.
  const host = document.body.appendChild(document.createElement('fl-root'));
  const started = scrolled();
  app.bootstrap(App, host);
  await started;
  await app.whenStable();

  /** Navigates, and waits for the router's Scroll event, a frame after the page has rendered. */
  const go = async (url: string) => {
    const done = scrolled();
    await router.navigateByUrl(url);
    await done;
    await app.whenStable();
  };

  return { element: host, main: host.querySelector('main')!, go, scrolls };
}

describe('App', () => {
  beforeEach(() => {
    // The theme menu in the bar asks the device which scheme it prefers.
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.querySelector('fl-root')?.remove();
    history.replaceState(null, '', '/');
  });

  it('links past the bar to the content of the page it is on, not to the base', async () => {
    const { element, go } = await render('/pt/');

    await go('/quakes/us7000abcd?from=log');

    expect(element.querySelector('.skip-link')?.getAttribute('href')).toBe(
      '/pt/quakes/us7000abcd?from=log#main',
    );
  });

  it('opens a new page at its top, and takes focus to its content', async () => {
    const { main, go, scrolls } = await render();

    await go('/quakes/us7000abcd');

    expect(scrolls).toHaveBeenCalledWith([0, 0]);
    expect(document.activeElement).toBe(main);
  });

  it('leaves the reader where they are when only the filters change', async () => {
    const { main, go, scrolls } = await render();

    await go('/?mag=any');

    expect(scrolls).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(main);
  });

  it('leaves a jump within the page to the browser, which has made it', async () => {
    const { main, go, scrolls } = await render();
    await go('/quakes/us7000abcd');
    scrolls.mockClear();
    main.blur();

    await go('/quakes/us7000abcd#main');

    expect(scrolls).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(main);
  });
});
