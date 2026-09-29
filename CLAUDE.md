# Faultline

A live seismograph of the planet: Angular 22 with SSR, an Express BFF over the USGS earthquake feeds. Read `README.md` for what the app does and why; this file is how to work on it.

## Commands

- `pnpm dev` — dev server with SSR and the BFF, http://localhost:4200
- `pnpm run ci` — format check, lint, types, unit tests with coverage. Must pass before any change is done.
- `pnpm e2e` — production build, then Playwright (desktop and mobile) against a USGS stub, with an axe audit of every page in both themes. Must pass before any change to a page is done.
- `pnpm build` then `pnpm preview` — production build served by the real Express server on :4000
- `pnpm basemap` — regenerates `public/maps/earth.svg` from Natural Earth and PB2002

Node is pinned by `devEngines` (24.15+, required by the Angular 22 CLI). Always run through `pnpm`, never a bare `ng` or `node`, or the machine's older Node is used.

## Architecture rules

Layers are enforced by ESLint (`eslint.config.js`); do not weaken the rules to make an import pass.

- `src/shared` — domain, contracts, projection. Plain TypeScript: no Angular, no Node, no RxJS.
- `src/server` — the BFF. Node and Zod; never Angular. All USGS access goes through `usgs/catalogue.ts`, validated by `usgs/schema.ts`.
- `src/app/ui` — design system. Must not know about earthquakes (`@shared/*` is off limits).
- `src/app` — the Angular app. Reaches the BFF over HTTP (`core/api/quakes.ts`). The single exception is `core/api/in-process-backend.ts`, provided only in `app.config.server.ts`.

## Conventions

- Angular 22 idioms: standalone components (never set `standalone`), OnPush is the default (never set it), `input()`/`output()`, signals and `computed()`, `@if`/`@for`, `inject()`, `@Service()` for new singletons, host bindings in `host: {}`.
- Data: `httpResource` via `core/api/quakes.ts`; read values behind `hasValue()`. No stores: URL state goes through router input binding.
- Styles: component CSS reads semantic tokens only (`src/styles/tokens.css`). New colours are added as primitives and exposed through a semantic token with `light-dark()`. No Tailwind, no component library.
- Selectors: `fl-` for app components, `ui-` for design-system components.
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

## Design changes

A new screen, or a visible change to an existing one, starts as a static mock or screenshots the owner approves. Only then is it built, and the build is checked against the approved version, in both themes and at mobile width.
