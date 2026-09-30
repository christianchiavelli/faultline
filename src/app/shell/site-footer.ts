import { Component } from '@angular/core';

@Component({
  selector: 'fl-site-footer',
  template: `
    <footer class="page footer">
      <p>
        Earthquake data from the
        <a href="https://earthquake.usgs.gov/earthquakes/feed/" rel="external"
          >U.S. Geological Survey</a
        >, public domain. Plate boundaries: Bird (2003), compiled by Hugo Ahlenius, Nordpil, under
        <a href="https://opendatacommons.org/licenses/by/1-0/" rel="external">ODC-By 1.0</a>.
        Coastlines: <a href="https://www.naturalearthdata.com" rel="external">Natural Earth</a>.
      </p>
      <p>
        Nothing here is an alert. For warnings, follow your national seismic or tsunami authority.
      </p>
    </footer>
  `,
  styles: `
    :host {
      display: block;
      margin-block-start: var(--space-20);
      border-top: var(--hairline) solid var(--rule-strong);
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
export class SiteFooter {}
