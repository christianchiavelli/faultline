# Faultline

A live seismograph of the planet. Every event the [USGS](https://earthquake.usgs.gov/earthquakes/feed/) catalogued in the last 24 hours, drawn the way a drum seismograph draws it: one line per hour, one burst per event.

Angular 22 (zoneless, signals, SSR with incremental hydration) and an Express backend-for-frontend, on public-domain data with no API key.

![The live page: a 24-hour helicorder with the day's largest events labelled in red](docs/screenshots/live-paper.png)

<details>
<summary>More screens</summary>

**The same record on film, the dark theme**

![The helicorder in the dark theme: a light trace on a dark photographic record](docs/screenshots/live-film.png)

**One event, with its uncertainty**

![An M5.4 north of Svalbard: magnitude scale, depth fixed by the analyst, location error and energy](docs/screenshots/quake-paper.png)

</details>

---

## Setup

Any Node.js recent enough to start pnpm, and pnpm itself. No API key, no account, no `.env`.

```bash
pnpm install
pnpm dev
```

The app runs on Node.js 24.15 or newer, which the Angular 22 CLI requires. It is pinned in `package.json` under `devEngines`: the first install downloads that exact runtime, checked against the lockfile, and every script runs on it.

To run the production server:

```bash
pnpm build
NG_ALLOWED_HOSTS=faultline.example.com PORT=4000 pnpm preview
```

Angular's server refuses requests for hostnames it was not told about, as protection against server-side request forgery. `localhost` is allowed in `angular.json`; anything else comes from `NG_ALLOWED_HOSTS`.

---

## Why this data set

The USGS feed is live, public domain and regenerated every minute, and it is honest about how unsure it is. That is the point of using it: most of the work here is in not flattening that uncertainty into a tidy dashboard.

- **Magnitude is not one scale.** A week of the feed mixes eight or more (`ML`, `Md`, `mb`, `Mww`…), measured from different parts of the seismogram and valid over different sizes. Every value carries its scale, and the scale explains itself.
- **A third or more of the feed is provisional**, the newest events most of all. Automatic solutions can still move, change size or be deleted. Reviewed and automatic events look different everywhere they appear, and the day's reviewed share is a headline number.
- **Depths lie in two directions.** Many are fixed by an analyst when the data cannot constrain them, often at exactly 10 km, and some are negative: shallow events under high ground are located relative to sea level. The detail page says which, instead of printing a number.
- **The feed mixes event kinds.** Quarry blasts and explosions are seismic events but not earthquakes; they are counted and labelled, and never become "the largest earthquake of the day".
- **Energy is logarithmic.** Each whole magnitude step is about 32 times the energy, so one event usually dominates the day. The page states that share outright rather than letting a bar chart imply otherwise.

---

## How it is built

- **A BFF, not a proxy.** Express routes, mounted in the Angular SSR server, fetch the USGS once per minute however many people are reading, validate every record with Zod at the boundary, and hand the app one contract (`src/shared/api/contracts.ts`). A malformed record costs one row, not the feed, and the response says how many were skipped.
- **SSR never calls itself over HTTP.** During a server render, `HttpClient` requests to `/api/*` are answered in-process by the same router Express uses, through a replacement `HttpBackend`. Behind a load balancer, the alternative is every page render leaving the machine to ask the same process for data it already holds. Because the swap happens below the interceptors, Angular's transfer cache still hands the response to the browser, which does not refetch on hydration.
- **Stale-while-revalidate, single-flight, and honest about failure.** Concurrent misses share one upstream call. When the USGS stops answering, the last good copy is served and flagged, and the page says how old it is.
- **The helicorder is synthetic, deterministic and says so.** No station hears the whole planet and the feed carries no waveforms, so each event becomes a burst placed at its origin time and sized from its magnitude, on a compressed scale the legend states. The paths are a pure function of the events and the clock, so the server and the browser draw the same thing.
- **The map is a file, not a library.** Coastlines and plate boundaries are projected to Equal Earth once, by `pnpm basemap`, into a static SVG the page references with `<use>`: cached once, outside the JavaScript bundle, and coloured by the theme through CSS. Equal Earth keeps every region at its true area, which Mercator would not for Alaska, the busiest corner of the feed.
- **Filter state lives in the URL.** `?min=4.5` is a link, bound to the page through the router; the back button and sharing work with nothing written for them.
- **The design system is tokens and cascade layers.** Colours are OKLCH, declared once each with `light-dark()`, so a theme is nothing more than a `color-scheme`. The theme is a cookie the server reads, so the first paint is already right, with no inline script.
- **Boundaries are enforced, not agreed.** ESLint rejects imports that cross layers: `src/shared` is framework-free, `src/server` never imports Angular, `src/app/ui` knows nothing about earthquakes, and the browser code only reaches the BFF over HTTP.

```
src/
  shared/    domain, contracts and the projection; plain TypeScript
  server/    the BFF: USGS client, cache, API router, Express adapter
  app/
    core/    data access, clock, theme, polling
    ui/      design system components, no domain knowledge
    shell/   top bar and footer
    features/
  styles/    tokens, reset, base, layout and component layers
scripts/     basemap generation
```

---

## Testing

```bash
pnpm run ci    # format, lint, types, and the unit specs with coverage
```

Vitest, through the Angular CLI's own runner. The domain, the USGS mapping, the cache, the API router and the helicorder geometry are tested as plain functions; components are tested through the DOM they render.

---

## Licence

Code under MIT. Earthquake data: U.S. Geological Survey, public domain. Plate boundaries: Bird (2003), PB2002, compiled by Hugo Ahlenius, Nordpil, under the [Open Data Commons Attribution License](https://opendatacommons.org/licenses/by/1-0/). Coastlines: [Natural Earth](https://www.naturalearthdata.com), public domain.

Nothing here is an alert. For warnings, follow your national seismic or tsunami authority.
