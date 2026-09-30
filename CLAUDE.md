# Faultline

A live seismograph of the planet: Angular 22 with SSR, an Express BFF over the USGS earthquake feeds. Read `README.md` for what the app does and why; this file is how to work on it.

## Commands

- `pnpm dev` — dev server with SSR and the BFF, http://localhost:4200
- `pnpm run ci` — format check, lint, types, unit tests with coverage. Must pass before any change is done.
- `pnpm e2e` — production build, then Playwright (desktop and mobile) against a USGS stub, with an axe audit of every page in both themes. Must pass before any change to a page is done.
- `pnpm build` then `pnpm preview` — production build served by the real Express server on :4000
- `pnpm basemap` — regenerates `public/maps/earth.svg` from Natural Earth and PB2002
- `pnpm screenshots` — recaptures `docs/screenshots` from a running production server (`pnpm build`, then `pnpm preview`)
- `docs/upstream-api.md` — how the two USGS services really behave, probed live. Read it before touching `src/server/usgs`, and update it when a probe says otherwise

Node is pinned by `devEngines` (24.15+, required by the Angular 22 CLI). Always run through `pnpm`, never a bare `ng` or `node`, or the machine's older Node is used.

## Architecture rules

Layers are enforced by ESLint (`eslint.config.js`); do not weaken the rules to make an import pass.

- `src/shared` — domain, contracts, projection. Plain TypeScript: no Angular, no Node, no RxJS. Schemas here import `zod/mini`: they ship to the browser, where the classic API cannot be tree-shaken.
- `src/server` — the BFF. Node and Zod; never Angular. All USGS access goes through `usgs/catalogue.ts`, validated by `usgs/schema.ts`.
- `src/app/ui` — design system. Must not know about earthquakes (`@shared/*` is off limits).
- `src/app` — the Angular app. Reaches the BFF over HTTP (`core/api/quakes.ts`). The single exception is `core/api/in-process-backend.ts`, provided only in `app.config.server.ts`.

## Conventions

- Angular 22 idioms: standalone components (never set `standalone`), OnPush is the default (never set it), `input()`/`output()`, signals and `computed()`, `@if`/`@for`, `inject()`, `@Service()` for new singletons, host bindings in `host: {}`.
- Data: `httpResource` via `core/api/quakes.ts`; read values behind `hasValue()`. No stores: URL state goes through router input binding. Server state that needs a client cache, like the export's live count, is TanStack Query, provided through `QUERY_CLIENT` in the lazy chunk that uses it, never in the app config.
- Styles: component CSS reads semantic tokens only (`src/styles/tokens.css`). New colours are added as primitives and exposed through a semantic token with `light-dark()`. No Tailwind, no component library.
- Selectors: `fl-` for app components, `ui-` for design-system components.
- Dialogs: `ui-dialog`, on the native `<dialog>`; never a hand-built overlay. A dialog's code is its own chunk, rendered with `@defer (when open(); prefetch on idle)`.
- Live lists never move under the reader: an arrival waits behind a count while the list is on screen or scrolled past, and comes in when asked for (see `event-log.ts`).
- Charts: SVG drawn by a pure module beside the component (`trace.ts`, `distribution.ts`), so the server and the browser draw the same thing. The drawing is `aria-hidden`, and what it says is also in text: a caption, and where the numbers matter a visually hidden table.
- Icons: drawn for the app, no icon library. Each is one path in `ui/icons.ts`, the centre line of its strokes on a 16 px grid inside a two-unit margin; `ui-icon` strokes it with the wordmark's square ends. Beside a word an icon is decoration; a control that has only an icon, like a dialog's close button, carries an `aria-label`. A standalone link to another site ends with the external-link icon; a link inside running text does not.
- Honest data: a missing value renders as `—`, never as zero; provisional and reviewed values must look different; scales and uncertainties are shown next to the numbers they qualify.
- Comments explain why, at the line that needs it. No comments that restate the code.
- UI copy is English (British spelling, as in the rest of the app).
- Tab titles read `<page> | Faultline`, and the home page just `Faultline`. Static pages set the route `title`; pages titled by their data call `pageTitle()` from `core/page-title.ts`. Never write the suffix by hand.

## Gotchas

- The server DOM throws on `document.cookie`; read cookies from the `REQUEST` headers on the server (see `core/theme.ts`).
- Nothing may start a timer on the server. Browser-only work goes in `afterNextRender` (see `core/poll.ts`, `core/clock.ts`).
- SVGs that must fill a sized box are positioned absolutely: an SVG's intrinsic aspect ratio otherwise sizes the grid row (see `helicorder.css`).
- The USGS FDSN service answers 404 for unknown ids and 409 for deleted events; the API maps them to 404 and 410.
- Angular's transfer cache hands only successful responses to the browser. `core/api/transfer-errors.ts` hands over API errors too; without it an error page refetches while hydrating.
- A page that renders without its data sets the failure status through `RESPONSE_INIT` (see `live-page.ts`, `quake-page.ts`).
- Inside a block with `hydrate` triggers, a nested `@defer` renders on the state its handler sets (`when open()`), not `on interaction`: a click replayed after hydration reaches `(click)` handlers, never a trigger's own listener (see `export-button.ts`).
- Two dependencies are patched (`patches/`, reasons in `pnpm-workspace.yaml`). An install that fails to apply one means the file changed upstream: check whether the fix shipped before re-creating the patch.
- In an e2e spec, a deferred section's server HTML is on the page long before its code runs. Wait with `waitForHydrationOf()` before anything that needs the code, like a live update (see `e2e/support/page.ts`).
- A visually hidden `<table>` still widens the page, since a table grows to fit its cells whatever width it is given: hide a wrapper `div` instead (see `magnitude-chart.html`).
- The trace is a target of its own, so every label on it is a target beside another, and WCAG 2.5.8 then wants it 24 px tall. The labels keep their look by masking only the band behind their text (see `helicorder.css`).
- The initial bundle budget is tight on purpose, 400 kB to warn and 450 kB to fail. A library that drags all of Angular into the first load shows up there first: find the cause with `pnpm build --stats-json` rather than raise the budget.
- In a unit spec, a TanStack query in flight is a pending task, so `whenStable()` waits for an answer the spec has yet to give. Render with `TestBed.tick()` instead (see `export-dialog.spec.ts`).

## Design changes

A new screen, or a visible change to an existing one, starts as a static mock or screenshots the owner approves. Only then is it built, and the build is checked against the approved version, in both themes and at mobile width.
