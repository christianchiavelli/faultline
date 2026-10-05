# Faultline

A live seismograph of the planet, built on the [USGS earthquake catalogue](https://earthquake.usgs.gov/earthquakes/feed/): around two hundred events on an ordinary day.

Read the last 24 hours the way a drum seismograph draws them, one line per hour and one burst per event, and point at any burst to see what it was. Filter, search and sort every event of the day, open one for its magnitude scale, depth and location uncertainty, and export any search of the catalogue as CSV or GeoJSON.

Angular 22, zoneless with signals, server-rendered with incremental hydration in English and Portuguese, and an Express backend-for-frontend.

![The live page: a 24-hour helicorder with the day's largest events labelled in red](docs/screenshots/live-paper.png)

<details>
<summary>More screens</summary>

**Dark theme**

![The helicorder in the dark theme, a light trace on a dark record](docs/screenshots/live-film.png)

**The whole live page**

![The helicorder, the day's readouts, a world map with plate boundaries, the day's sizes and the event log](docs/screenshots/live-full-paper.png)

**The log, filtered to one region and sorted by size**

![Every Californian event of the day, largest first, with each filter option counted](docs/screenshots/log-film.png)

**The filters on a phone**

![The filters in a sheet over the log, with a button that says how many events they leave](docs/screenshots/log-phone-paper.png)

**Reading an event off the trace**

![A card on the helicorder naming a small event: magnitude, place, time, depth and review status](docs/screenshots/live-reading-paper.png)

**The day's sizes against an average day**

![The day's earthquakes by magnitude, with the Gutenberg–Richter law across them](docs/screenshots/sizes-film.png)

**One event, with its uncertainty**

![An M5.4 north of Svalbard: magnitude scale, a depth fixed by the analyst, location error and energy](docs/screenshots/quake-paper.png)

**The same event in Portuguese**

![The same event in Portuguese, with a decimal comma and Portuguese dates](docs/screenshots/quake-pt-paper.png)

**On a phone**

![The live page on a phone, in the dark theme](docs/screenshots/live-phone-film.png)

**Exporting an event's aftershocks**

![The export dialog counting every event within 100 km of an M7.8 since it happened](docs/screenshots/export-paper.png)

**A search too large for one file**

![The export dialog past its limit, offering two narrower searches that fit](docs/screenshots/export-too-many-film.png)

Regenerate with `pnpm screenshots`.

</details>

---

## Setup

Node.js 22.13 or newer and pnpm. No API key or account.

```bash
pnpm install
pnpm dev
```

`pnpm storybook` opens the design system on its own: the tokens, every component and the charts, drawn from a recorded day in both themes.

The scripts run on Node.js 24.15, which the Angular 22 CLI requires. It is pinned in `package.json` under `devEngines` and downloaded on the first install.

For the production server:

```bash
pnpm build
NG_ALLOWED_HOSTS=faultline.example.com pnpm preview
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port the server listens on |
| `NG_ALLOWED_HOSTS` | none | Hostnames served besides `localhost`, comma-separated |
| `TRUST_PROXY` | off | Set behind a proxy, so limits see each client's own address |
| `RATE_LIMIT_BURST` | `60` | Requests a client can make at once |
| `RATE_LIMIT_PER_SECOND` | `1` | How fast that allowance refills |
| `STREAMS_PER_CLIENT` | `20` | Live feeds a client can follow at once |
| `USGS_BASE_URL` | `https://earthquake.usgs.gov` | The USGS, or the test suite's stub |
| `UPSTREAM_USER_AGENT` | `Faultline/0.1 (+repo URL)` | Identifies the server to the USGS |

An invalid value stops the server at start-up instead of falling back to the default.

---

## Why this data set

The USGS catalogue is live, public domain and regenerated every minute, and it is honest about how unsure it is. Most of what is interesting here comes from carrying that uncertainty through to the page instead of flattening it into a tidy dashboard.

Magnitude is not one scale: a single day mixes six, so every value carries its scale. About half of a day is still provisional, so reviewed and automatic events look different everywhere. Many depths are fixed by an analyst rather than measured, and the event page says so. A missing value is a dash, never a zero.

---

## Screens

| Route | What it is |
| --- | --- |
| `/` | The last 24 hours: helicorder, readouts, map, the day's sizes and every event |
| `/?mag=any&region=alaska&sort=largest` | The same page with the log filtered, searched or sorted |
| `/quakes/:id` | One event: magnitude and scale, depth, location uncertainty, energy |
| `/pt/…` | Any page in Portuguese |

---

## How it is built

- **A BFF, not a proxy.** Express routes inside the Angular SSR server read two USGS services, validate every record with Zod and hand the app one contract. A malformed record costs one row, not the feed.
- **SSR never calls itself over HTTP.** During a render, API requests are answered in-process by a replacement `HttpBackend`, and the transfer cache, errors included, means hydration never fetches again.
- **Pushed, never polled.** Each open tab receives server-sent events with only what changed since the copy it holds, resumes after a dropped connection, and closes its stream while hidden.
- **Cached, paced and honest about failure.** Each feed is fetched at most once a minute however many people read it. When the USGS fails, the last good copy is served and marked as stale. Per-client rate limits and one shared USGS budget keep the load on the upstream bounded.
- **An export holds every match, or it does not start.** A search is counted as it is narrowed, capped at 100,000 events and streamed as the USGS pages arrive. A failure halfway cuts the download, so a partial file never passes for a whole one.
- **The view lives in the URL.** Filters, search and order are query parameters bound through the router, so sharing, bookmarking and Back work for free, and every filter works before the page hydrates.
- **An event opens at once.** A link hands the page what the list already knows, and the magnitude flies into the title with the View Transitions API while the rest of the record loads.
- **Two languages, each rendered on the server.** British English and Brazilian Portuguese are two builds of Angular's compile-time i18n, with local number and date formats and `hreflang` links between them.
- **Accessible by default.** The helicorder is a keyboard slider over the day's events, new events never move the list under its reader, and every page is audited against WCAG 2.2 AA.
- **The platform first.** Dialogs are the native `<dialog>`, menus the native popover with CSS anchor positioning, and every animation is a motion token that reduced motion turns off in one place.
- **A design system of tokens.** OKLCH colours with `light-dark()`, a theme cookie the server reads so the first paint is already right, and font fallbacks matched to the web fonts' metrics, so nothing shifts when they load.
- **Boundaries are enforced, not agreed.** ESLint rejects imports across layers: `src/shared` is framework-free, the server never imports Angular, and the design system knows nothing about earthquakes.

---

## Testing

```bash
pnpm run ci           # format, lint, types, and unit tests with coverage
pnpm storybook:test   # every story in Chromium, its interactions played and audited by axe
pnpm run e2e          # Playwright on desktop and mobile, against a production build
pnpm vitals           # the Core Web Vitals of each page, against a production build
```

Vitest covers the domain, the USGS mapping, the cache, the API and the components, and the build fails if coverage drops under its floor. Playwright runs the production server against a USGS stub and checks what only a browser can: the page before any script runs, hydration without refetching, the live stream, exports, both languages, and an axe audit of every page in both themes.

Every push also measures LCP, CLS and INP on the phone and connection Lighthouse emulates for mobile, against a real recorded day, and fails when a page measures worse than its baseline.

<!-- web-vitals -->

| Page            | LCP    | CLS   | INP    |
| --------------- | ------ | ----- | ------ |
| The live page   | 0.86 s | 0.000 | 172 ms |
| An event's page | 0.83 s | 0.000 | 96 ms  |

Measured on 2 October 2026, the median of two runs in CI ([1](https://github.com/christianchiavelli/faultline/actions/runs/37071099109), [2](https://github.com/christianchiavelli/faultline/actions/runs/37071771417)).
<!-- /web-vitals -->

The first run needs the browser: `pnpm exec playwright install chromium`.

---

## Reading further

[docs/upstream-api.md](docs/upstream-api.md) compares the two USGS services the BFF reads, probed live, because they report the same things differently. The rules for changing the code are in [CLAUDE.md](CLAUDE.md).

---

## Licence

Code under MIT. Earthquake data: U.S. Geological Survey, public domain. Plate boundaries: Bird (2003), PB2002, compiled by Hugo Ahlenius, Nordpil, under the [Open Data Commons Attribution License](https://opendatacommons.org/licenses/by/1-0/). Coastlines: [Natural Earth](https://www.naturalearthdata.com), public domain.

Nothing here is an alert. For warnings, follow your national seismic or tsunami authority.
