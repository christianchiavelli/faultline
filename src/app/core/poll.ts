import { DOCUMENT } from '@angular/common';
import { DestroyRef, afterNextRender, inject } from '@angular/core';

/**
 * Reloads a resource on an interval while the page is visible, and once more
 * when it becomes visible again after missing a beat. A background tab polling
 * every minute is load on the USGS for a page nobody is looking at.
 *
 * Browser-only by construction (`afterNextRender` never runs on the server).
 * Needs an injection context.
 */
export function pollWhileVisible(resource: { reload(): boolean }, intervalMs: number): void {
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);

  afterNextRender(() => {
    let lastReload = Date.now();
    const reload = () => {
      lastReload = Date.now();
      resource.reload();
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') reload();
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastReload >= intervalMs) reload();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    destroyRef.onDestroy(() => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  });
}
