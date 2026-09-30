# Faultline

A live seismograph of the planet, on top of the [USGS earthquake catalogue](https://earthquake.usgs.gov/earthquakes/feed/), which gathers what the global and US regional seismic networks locate: around two hundred events on an ordinary day.

Read the last 24 hours the way a drum seismograph draws them, one line per hour and one burst per event, filter the log by magnitude, then open any event for its magnitude scale, how its depth was found, the uncertainty of its location and the energy it released. Any search of the catalogue, an event's aftershocks included, exports as a spreadsheet or as map data.

Angular 22, zoneless with signals, SSR with incremental hydration, and an Express backend-for-frontend.

![The live page: a 24-hour helicorder with the day's largest events labelled in red](docs/screenshots/live-paper.png)

<details>
<summary>More screens</summary>

**The same record on film, the dark theme**

![The helicorder in the dark theme: a light trace on a dark photographic record](docs/screenshots/live-film.png)

**The whole page: readouts, the map and every event**

![The full live page: the helicorder, the day's readouts, an Equal Earth map with plate boundaries and the event log](docs/screenshots/live-full-paper.png)

**One event, with its uncertainty**

![An M5.4 north of Svalbard: magnitude scale, depth fixed by the analyst, location error and energy](docs/screenshots/quake-paper.png)

**On a phone, dark theme**

![The live page on a phone in the dark theme, the helicorder narrowed to the screen](docs/screenshots/live-phone-film.png)

**Exporting the aftershocks of an event**

![The export dialog on an event page: every event within 100 km of the M7.8 near Ende since it happened, counted before the download](docs/screenshots/export-paper.png)

**A search too large for one file, dark theme**

![The export dialog past its limit: over 180,000 events, and two narrower searches that fit, each already counted](docs/screenshots/export-too-many-film.png)

Regenerate with `pnpm run screenshots` against a production build.

</details>

---

## Setup

Node.js 22.13 or newer and pnpm. No API key or account.

```bash
pnpm install
pnpm dev
```

The app itself runs on Node.js 24.15 or newer, which the Angular 22 CLI requires, pinned in `package.json` under `devEngines`. The first install downloads that exact version, checked against the hash in the lockfile, and every script runs on it, so the Node on the machine only has to start pnpm.

To run the production server:

```bash
pnpm build
NG_ALLOWED_HOSTS=faultline.example.com pnpm preview
```

Angular's server refuses requests for hostnames it was not told about, as protection against server-side request forgery. `localhost` is allowed in `angular.json`; anything else comes from `NG_ALLOWED_HOSTS`. Everything else has a default:

| Variable | Default | What it is for |
| --- | --- | --- |
| `PORT` | `4000` | The port the server listens on |
| `NG_ALLOWED_HOSTS` | none | Hostnames to answer for besides `localhost`, comma-separated |
| `TRUST_PROXY` | off | Express `trust proxy`. Set it behind a proxy, or every client shares the proxy's address and its rate limit |
| `RATE_LIMIT_BURST` | `60` | Requests one client can make at once, page renders and API calls alike |
| `RATE_LIMIT_PER_SECOND` | `1` | How fast that allowance refills |
| `USGS_BASE_URL` | `https://earthquake.usgs.gov` | Where the USGS is. The end-to-end suite points it at a stub |
| `UPSTREAM_USER_AGENT` | `Faultline/0.1 (+repo URL)` | Sent with every USGS request, so the provider can reach the operator before reaching for a block list |

---

## Why this data set

The USGS catalogue is live, public domain and regenerated every minute, and it is honest about how unsure it is. That was the point of picking it. Most of what is interesting in this repository comes from carrying that uncertainty through to the page instead of flattening it into a tidy dashboard.

Magnitude is not one scale. A single day of the feed mixes six of them, measured from different parts of the seismogram and valid over different sizes, so a 3.1 from a Californian network and a 3.1 from the global one are not the same statement. Every value here carries its scale, and the scale explains itself. About half of the same day is still provisional: automatic solutions can move, change size or be deleted, so reviewed and automatic events look different everywhere they appear.

Depths are unsure in two directions. Many are fixed by an analyst when the data cannot constrain them, typically at 10 km, and some are negative, because shallow events under high ground are located relative to sea level. The event page says which, instead of printing a number as if it had been measured.

---

## Screens

| Route | What it is |
| --- | --- |
| `/` | The last 24 hours: the helicorder, the day's readouts, the map and every event, and an export of any search |
| `/?min=4.5` | The same page with the log at another threshold: `all`, `2.5` (the default) or `4.5` |
| `/quakes/:id` | One event: magnitude and its scale, depth and how it was found, location uncertainty, energy, impact alert, and an export of the events around it |

---

## How it is built

- **A BFF, not a proxy.** Express routes, mounted in the Angular SSR server, read two USGS services that answer the same questions differently, validate every record with Zod at the boundary, and hand the app one contract (`src/shared/api/contracts.ts`). A malformed record costs one row, not the feed, and the response says how many were skipped.
- **The domain comes first.** `src/shared/domain` owes nothing to the feed's field names. Magnitude scales follow the USGS's own definitions, energy is computed from magnitude, about 32 times more per whole step, and an explosion is counted as a seismic event but never ranked as the largest earthquake of the day.
- **SSR never calls itself over HTTP.** During a server render, `HttpClient` requests to `/api/*` are answered in-process by the same router Express uses, through a replacement `HttpBackend`. Behind a load balancer, the alternative is every page render leaving the machine to ask the same process for data it already holds. Because the swap happens below the interceptors, Angular's transfer cache still hands the response to the browser, which does not refetch on hydration. That cache drops error responses, so a small interceptor hands those over too: a missing event or a feed outage hydrates as it was rendered, with the status it was rendered with.
- **Cached, paced and honest about failure.** Each feed is fetched at most once a minute however many people are reading, and concurrent misses share one upstream call. When the USGS stops answering, the last good copy is served and flagged, and the page says how old it is. Each client address gets a token bucket, bursts of 60 and then one request a second, and every USGS call the cache cannot answer, event lookups, counts and export pages alike, shares one budget for the whole process, so however many addresses a script rotates through, the USGS sees at most ten calls at once and two a second after that.
- **An export holds every match, or it does not start.** The dialog counts a search as it is narrowed, and one past 100,000 events is refused before the first byte, with two narrower searches that fit, each counted before it is offered. The file streams from the BFF as the USGS pages arrive, keyed by time rather than offset, since events landing mid-export would shift every offset after them, and a failure halfway cuts the connection, so a truncated file never passes for a whole one. The CSV opens in Excel with its accents intact, and a cell that starts like a formula is written as text.
- **The helicorder is synthetic, deterministic and says so.** No station hears the whole planet and the feed carries no waveforms, so each event becomes a burst placed at its origin time and sized from its magnitude, on a compressed scale the legend states. The paths are a pure function of the events and the clock, so the server and the browser draw the same thing.
- **The map is a file, not a library.** Coastlines and plate boundaries are projected to Equal Earth once, by `pnpm basemap`, into a static SVG the page references with `<use>`: cached once, outside the JavaScript bundle, and coloured by the theme through CSS. Equal Earth keeps every region at its true area, which Mercator would not for Alaska, the busiest corner of the feed.
- **Dialogs are the platform's.** `ui-dialog` is the native `<dialog>`, opened with `showModal()`: the page behind is inert, Escape and a click outside close it, and focus returns to the button that opened it, none of it reimplemented. It fades in with `@starting-style`, fills the screen on a phone with its actions under the thumb, and its code is a separate chunk, fetched when the browser is idle and rendered on the first click.
- **Server state is TanStack Query, only where it is used.** The live count is one query per search, so going back to a choice answers from memory, and the last count stays up, marked provisional, while the next one loads. The query client is provided inside the dialog's chunk through an injection token, not in the app config, so the library never reaches the first load. The custom period is a Signal Form checked by the same Zod schema the BFF applies, imported as `zod/mini`, because the classic API cannot be tree-shaken.
- **Filter state lives in the URL.** `?min=4.5` is a link, bound to the page through the router. No store, no watcher. Sharing, bookmarking and the back button work with nothing written for them, and changing the filter keeps the reader where they were instead of throwing them back to the top.
- **Missing data is a value, never a zero.** A magnitude not computed yet shows an em-dash, a depth fixed by an analyst says so instead of posing as a measurement, and every uncertainty sits next to the number it qualifies.
- **The design system is tokens and cascade layers.** Colours are OKLCH, declared once each with `light-dark()`, so a theme is nothing more than a `color-scheme`. The theme is a cookie the server reads, so the first paint is already right, with no inline script. Archivo and Martian Mono are self-hosted under content-hashed names, preloaded, and backed by local fallbacks whose metrics are matched with Capsize, so the swap does not move the layout. Icons are Font Awesome's, inlined as SVG by one component, and decoration wherever a word already says the same.
- **Two dependencies are patched, each with its reason.** TanStack Query read one symbol off the whole `@angular/core` namespace, which kept every export of Angular in the first load: 160 kB more on every page, caught by the bundle budget, since tightened to catch the next one. Angular's incremental hydration dropped a click that landed on a section already hydrating, which cost the log's Export button its first press on a slow connection. Both are `pnpm patch`es, explained in `pnpm-workspace.yaml`, and keyed so that an upgrade touching either file fails the install rather than dropping the fix.
- **Boundaries are enforced, not agreed.** ESLint rejects imports that cross layers: `src/shared` is framework-free, `src/server` never imports Angular, `src/app/ui` knows nothing about earthquakes, and the browser code only reaches the BFF over HTTP.

---

## Testing

```bash
pnpm run ci    # format, lint, types, and the unit specs with coverage
pnpm run e2e   # Playwright across two viewports, on a production build
```

The suites divide by what they can see. Vitest covers the domain, the USGS mapping, the cache, the API router, the export's paging and CSV, and the helicorder geometry as plain functions, and components through the DOM they render. Playwright owns what only a browser and the real server can answer: whether the page is complete before any script runs, whether hydration asks the API again, which status a crawler gets for a missing event, what an outage looks like, and what a downloaded file really holds. It runs the production server against a stub of the USGS serving a small, awkward day, searchable and exportable like the real service, and audits every page and the export dialog with axe against WCAG 2.2 AA in both themes. Three things were broken until the suite caught them: error pages refetched while hydrating, the top bar and footer sat outside any landmark, and the Export button lost a press that landed while its section was hydrating.

The first run needs the browser: `pnpm exec playwright install chromium`.

---

## Reading further

[docs/upstream-api.md](docs/upstream-api.md) compares the two USGS services the BFF reads, the summary feeds and the FDSN event service, gathered by probing the live endpoints, because they signal the same things in different ways: an event that never existed, one deleted since, and a search that matched nothing all answer differently.

Everything else is documented where it applies: a trap is a comment on the line that works around it, and the rules for changing the code are in [CLAUDE.md](CLAUDE.md).

---

## Licence

Code under MIT. Earthquake data: U.S. Geological Survey, public domain. Plate boundaries: Bird (2003), PB2002, compiled by Hugo Ahlenius, Nordpil, under the [Open Data Commons Attribution License](https://opendatacommons.org/licenses/by/1-0/). Coastlines: [Natural Earth](https://www.naturalearthdata.com), public domain.

Nothing here is an alert. For warnings, follow your national seismic or tsunami authority.
