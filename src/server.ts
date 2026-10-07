import { isDevMode } from '@angular/core';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import {
  apiHandler,
  clientRateLimit,
  errorHandler,
  exportHandler,
  feedStreamHandler,
} from './server/api/express';
import { createFeedStreams } from './server/api/feed-stream';
import { serverConfig } from './server/config';
import { withContentSecurityPolicy } from './server/http/content-security-policy';
import { createRateLimiter } from './server/http/rate-limit';
import { gracefulShutdown } from './server/http/shutdown';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
// Behind the proxy `TRUST_PROXY` names, the page's own address is the one the
// reader asked for, https and the public host: what its language links are
// written from. `allowedHosts` still vets the host.
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: serverConfig.trustProxy
    ? ['x-forwarded-host', 'x-forwarded-proto']
    : undefined,
});

app.disable('x-powered-by');
app.set('trust proxy', serverConfig.trustProxy);

const clients = createRateLimiter(serverConfig.clientRate);

/**
 * The page embeds the day's feed for hydration, so a render is ~190 kB of
 * HTML and ~33 kB compressed. A CDN in front would compress it too; this makes
 * the server correct on its own rather than correct behind the right proxy.
 */
app.use(compression());

app.use((_req, res, next) => {
  res.set({
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    'cross-origin-opener-policy': 'same-origin',
    // For what is not a page: a rendered page gets a policy of its own, its
    // scripts and styles listed by nonce (`withContentSecurityPolicy`).
    'content-security-policy':
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  });
  next();
});

const streams = createFeedStreams({ perClient: serverConfig.streamsPerClient });

/** The BFF. Pages rendered on this server reach it in-process, never over HTTP. */
app.get('/api/quakes/export', clientRateLimit(clients), exportHandler());
app.get('/api/quakes/recent/stream', clientRateLimit(clients), feedStreamHandler(streams));
app.use('/api', clientRateLimit(clients), apiHandler());

/**
 * Only fingerprinted build output is immutable. Files copied from `public/`
 * keep their names across deploys, and a year-long cache on those would pin
 * returning visitors to an old basemap.
 */
const FINGERPRINTED = /-[A-Za-z0-9]{8}\.(?:js|css|woff2)$/;

app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: (res, path) => {
      res.setHeader(
        'cache-control',
        FINGERPRINTED.test(path) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
      );
    },
  }),
);

// After the static files, so only page renders count against the limit.
app.use(clientRateLimit(clients));

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then(async (response) => {
      if (!response) return next();
      // The dev server's own scripts and styles carry no nonce.
      await writeResponseToNodeResponse(
        isDevMode() ? response : await withContentSecurityPolicy(response),
        res,
      );
    })
    .catch(next);
});

app.use(errorHandler());

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  const server = app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Faultline listening on http://localhost:${port}`);
  });
  // A deploy's SIGTERM, or Ctrl+C: what is in flight finishes first (see `shutdown.ts`).
  const shutDown = gracefulShutdown(server, streams);
  process.once('SIGTERM', shutDown);
  process.once('SIGINT', shutDown);
}

/** Used by the Angular CLI dev server and at build time. */
export const reqHandler = createNodeRequestHandler(app);
