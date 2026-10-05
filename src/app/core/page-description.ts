import { DestroyRef, effect, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

/** What a search result says of the site, in the language of the page it leads to. */
export const SITE_DESCRIPTION = $localize`:meta description of the site, shown under it in search results:Every earthquake the USGS recorded in the last 24 hours, drawn as a drum seismograph: one line per hour, one burst per event.`;

/**
 * What a search result says of a page with something of its own to tell, such
 * as an event, kept to its data as it loads: the site's until then, and again
 * once the reader leaves it. Needs an injection context.
 */
export function describePage(description: () => string | null): void {
  const meta = inject(Meta);
  const describe = (content: string) => meta.updateTag({ name: 'description', content });

  effect(() => describe(description() ?? SITE_DESCRIPTION));
  inject(DestroyRef).onDestroy(() => describe(SITE_DESCRIPTION));
}
