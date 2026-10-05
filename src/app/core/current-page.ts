import { Location } from '@angular/common';
import { computed, inject, type Signal } from '@angular/core';
import { Router } from '@angular/router';

/**
 * The page the reader is on, its path and its filters, as the router writes
 * it: `/quakes/us7000big`, `/?mag=any`. Read from the address, not from
 * `Router.url`, which is `/` until the first navigation has landed: a link
 * made from that while the page hydrates would lead home. Needs an injection
 * context.
 */
export function currentPage(): Signal<string> {
  const router = inject(Router);
  const location = inject(Location);
  return computed(() => {
    // The address changes with each navigation, and this with it.
    router.lastSuccessfulNavigation();
    return router.serializeUrl(router.parseUrl(location.path()));
  });
}
