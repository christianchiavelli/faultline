import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Service, inject, signal } from '@angular/core';

/**
 * Wall-clock time as a signal, one tick per second in the browser.
 *
 * On the server it stays at the moment the request arrived. An interval there
 * would outlive the request: the platform is torn down after the render, the
 * timer is not.
 */
@Service()
export class Clock {
  readonly #now = signal(Date.now());
  readonly now = this.#now.asReadonly();

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    const tick = () => this.#now.set(Date.now());

    // Aligned to the second, so a displayed clock never skips or repeats a digit.
    const alignment = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 1000);
      },
      1000 - (Date.now() % 1000),
    );

    inject(DestroyRef).onDestroy(() => {
      clearTimeout(alignment);
      clearInterval(interval);
    });
  }
}
