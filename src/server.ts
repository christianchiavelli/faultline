import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { join } from 'node:path';
import { apiHandler } from './server/api/express';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.disable('x-powered-by');

/**
 * The page embeds the day's feed for hydration, so a render is ~230 kB of
 * HTML and ~40 kB compressed. A CDN in front would compress it too; this makes
 * the server correct on its own rather than correct behind the right proxy.
 */
app.use(compression());

app.use((_req, res, next) => {
  res.set({
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});

/** The BFF. Pages rendered on this server reach it in-process, never over HTTP. */
app.use('/api', apiHandler());

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

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) throw error;
    console.log(`Faultline listening on http://localhost:${port}`);
  });
}

/** Used by the Angular CLI dev server and at build time. */
export const reqHandler = createNodeRequestHandler(app);
