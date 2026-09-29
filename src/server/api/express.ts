import type { RequestHandler } from 'express';
import { handleApiRequest } from './router';

/** Express is only the transport here; routing and caching live in `router.ts`. */
export function apiHandler(): RequestHandler {
  return (req, res, next) => {
    const url = new URL(req.originalUrl, 'http://localhost');

    handleApiRequest(req.method, url, req.get('if-none-match') ?? null)
      .then((result) => {
        res.status(result.status).set(result.headers);
        if (result.body === undefined || req.method === 'HEAD') res.end();
        else res.send(JSON.stringify(result.body));
      })
      .catch(next);
  };
}
