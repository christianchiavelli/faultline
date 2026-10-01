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
- Data: `httpResource` via `core/api/quakes.ts`; read values behind `hasValue()`. No stores: URL state goes through router input binding. The log's is one `LogQuery` (`event-log/log-query.ts`): a parameter per filter, named after what it sets, holding a word that reads on its own, defaults left out and the rest written in one order. Server state that needs a client cache, like the export's live count, is TanStack Query, provided through `QUERY_CLIENT` in the lazy chunk that uses it, never in the app config.
- Styles: component CSS reads semantic tokens only (`src/styles/tokens.css`). New colours are added as primitives and exposed through a semantic token with `light-dark()`. No Tailwind, no component library.
- Motion: every duration is a role from `tokens.css` (feedback, enter and exit, navigate, pulse, wait), never a number of its own; the lint fails on one, and reduced motion zeroes the roles that move, there and nowhere else. What only the browser shows, like a popover, the dialog or the trace's card, comes in with `@starting-style`; content that may come from the server comes in with `animate.enter` through `arrival()` (`ui/arrival.ts`).
- A page waiting on its data shows its shape, not a sentence: its own markup, `aria-hidden`, a `ui-skeleton` for each line to come, and the words a screen reader hears beside it (see `quake-page.html`). An instrument draws itself without its data (`fl-helicorder` given `null`), and a deferred section's placeholder is laid out like the section (see `live-page.html`).
- Layout: a page of sections is `.page-bands`, and each section a `.page-band`, edge to edge, its content on the page's column through a subgrid (`layout.css`). The bands take turns: the page's own colour, then `.page-band--raised`, then the page's again (see `live-page.html`, `quake-page.html`). Never give a band's content a width of its own to line it up with the page; the subgrid already does. Sections side by side share their rows through a subgrid too, so their headings and frames line up across them (see `quake-page.css`).
- Selectors: `fl-` for app components, `ui-` for design-system components.
- Dialogs: `ui-dialog`, on the native `<dialog>`; never a hand-built overlay. A dialog's code is its own chunk, rendered with `@defer (when open(); prefetch on idle)`.
- A panel that opens from a button and leaves the page in use, like the theme menu, is `ui-popover`: the native popover, anchored to its button in CSS (see `theme-menu.ts`). The log's regions open the same way, written in place because their button is a line of the index (see `log-facets.html`).
- Filters that are links show the count their view would hold, the other filters kept (see `facets.ts`); an option that would empty the list is text, not a link.
- Live lists never move under the reader: an arrival waits behind a count while the list is on screen or scrolled past, and comes in when asked for (see `event-log.ts`).
- Charts: SVG drawn by a pure module beside the component (`trace.ts`, `distribution.ts`), so the server and the browser draw the same thing. The drawing is `aria-hidden`, and what it says is also in text: a caption, and where the numbers matter a visually hidden table.
- A note on a chart goes in open paper, placed against the line it names. It never covers a bar, a count or a line, and never sits on a plate that hides what is behind it; where a screen has no such room, it joins the caption (see `magnitude-chart.css`, measured at several widths in `live.spec.ts`).
- Icons: drawn for the app, no icon library. Each is one path in `ui/icons.ts`, the centre line of its strokes on a 16 px grid inside a two-unit margin; `ui-icon` strokes it with the wordmark's square ends. Beside a word an icon is decoration; a control that has only an icon, like a dialog's close button, carries an `aria-label`. A standalone link to another site ends with the external-link icon; a link inside running text does not.
- Honest data: a missing value renders as `—`, never as zero; provisional and reviewed values must look different; scales and uncertainties are shown next to the numbers they qualify.
- Comments explain why, at the line that needs it. No comments that restate the code.
- UI copy is English (British spelling, as in the rest of the app).
- Tab titles read `<page> | Faultline`, and the home page just `Faultline`. Static pages set the route `title`; pages titled by their data call `pageTitle()` from `core/page-title.ts`. Never write the suffix by hand.

## Gotchas

- The server DOM throws on `document.cookie`; read cookies from the `REQUEST` headers on the server (see `core/theme.ts`).
- The footer takes its gap and its rule from `--footer-space` and `--footer-rule`, which a page whose last band is raised sets to nothing (`layout.css`): that band already ends it. A page that ends on its own colour, as a page in bands does while it loads, keeps both.
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
- A library pipe or directive used only inside a `@defer` block is imported through its package's whole namespace, which keeps every export of it in the first load. Put the block's content in a component of the app instead (see `log-sheet.ts`).
- A `<table>` restyled with `display: grid` or `block` loses its semantics in some browsers. The log's spells out its roles in the markup so the phone layout can restyle it (see `event-log.html`).
- A USGS place name is a locality, then the region after the last comma; the Californian networks write `CA` and `MX`, and a remote event has only a Flinn–Engdahl region. Read it with `splitPlace()` in `shared/domain/place.ts`, never by hand.
- A class in `src/styles` applies to every element of that name, whatever component it is in: a global name must be one no component uses for something else. The page bands were `.band` until they padded the trace's reading band out to five lines.
- A schema in `src/shared` writes its own error messages. `zod/mini` has no locale, and the first classic schema the server builds registers English for the whole process, so a default message reads differently in the browser and the BFF, and in a spec depends on what ran before it (see `export.ts`).
- In a unit spec, a TanStack query in flight is a pending task, so `whenStable()` waits for an answer the spec has yet to give. Render with `TestBed.tick()` instead (see `export-dialog.spec.ts`). An `httpResource` in flight is one too: a page's waiting state is checked after `TestBed.tick()` (see `quake-page.spec.ts`).
- Angular plays `animate.enter` while it hydrates, on what the server drew, which blanks the page for a moment just after it appears. Content that can come from the server enters through `arrival()`, never a bare class.
- The router hands `onViewTransitionCreated` the roots of its route trees, which match no segment: read a page's path down `firstChild` (see `core/view-transitions.ts`). Read off the roots, every path was empty and every cross-fade was skipped as a change of filter.
- A component's styles are unlayered, so they beat everything in `src/styles` whatever its specificity. A global rule that has to override one, like a waiting readout's hint on a phone, needs `!important` (see `ui.css`).

## Design changes

A new screen, or a visible change to an existing one, starts as a static mock or screenshots the owner approves. Only then is it built, and the build is checked against the approved version, in both themes and at mobile width.
