import { Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fl-site-footer',
  template: `
    <footer class="page footer">
      <p i18n="credits for the data and the map, with links to their sources">
        Earthquake data from the
        <a href="https://earthquake.usgs.gov/earthquakes/feed/" rel="external"
          >U.S. Geological Survey</a
        >, public domain. Plate boundaries: Bird (2003), compiled by Hugo Ahlenius, Nordpil, under
        <a href="https://opendatacommons.org/licenses/by/1-0/" rel="external">ODC-By 1.0</a>.
        Coastlines: <a href="https://www.naturalearthdata.com" rel="external">Natural Earth</a>.
      </p>
      @if (translated) {
        <p i18n="a note on a page in another language than English">
          Place names are the USGS catalogue's own, in English.
        </p>
      }
      <p i18n="disclaimer: the site does not warn of earthquakes or tsunamis">
        Nothing here is an alert. For warnings, follow your national seismic or tsunami authority.
      </p>
    </footer>
  `,
  styles: `
    /* A page in bands sets both to nothing: its last band already ends it (see layout.css). */
    :host {
      display: block;
      margin-block-start: var(--footer-space, var(--space-20));
      border-top: var(--footer-rule, var(--hairline) solid var(--rule-strong));
    }

    .footer {
      display: grid;
      gap: var(--space-2) var(--space-12);
      padding-block: var(--space-6) var(--space-10);
      font-size: var(--text-xs);
      color: var(--content-tertiary);
    }

    /* One low band on a wide screen: the credits, and the warning on one line at the right. */
    @media (width >= 80rem) {
      .footer {
        grid-template-columns: minmax(0, 1fr) auto;
      }
    }
  `,
})
export class SiteFooter {
  /** A page in another language says why its place names are still English: the catalogue writes them so. */
  protected readonly translated = !inject(LOCALE_ID).startsWith('en');
}
