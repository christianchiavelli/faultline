import {
  FetchBackend,
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse,
  type HttpEvent,
  type HttpRequest,
} from '@angular/common/http';
import { Service } from '@angular/core';
import { handleApiRequest } from '@server/api/router';
import { defer, mergeMap, of, throwError, type Observable } from 'rxjs';

/**
 * Serves `/api/*` requests made during server-side rendering by calling the API
 * router in-process, instead of letting HttpClient go out to the network.
 *
 * Without it, a render requests its own origin over HTTP. Behind a load
 * balancer that origin is the public hostname, so every page view would leave
 * the machine and come back through the proxy to ask this same process for data
 * it already holds in memory.
 *
 * It replaces the backend rather than adding an interceptor on purpose: the
 * transfer cache that hands SSR responses to the browser is itself an
 * interceptor, and it only records what comes back from below it. Down here,
 * under every interceptor, it records this too.
 *
 * It extends `FetchBackend` so every other request still goes out through
 * `fetch`, and so Angular's development check still recognises the fetch
 * backend instead of warning that SSR runs on XHR.
 *
 * Server-only: provided in `app.config.server.ts`, never bundled for the browser.
 */
@Service({ autoProvided: false })
export class InProcessApiBackend extends FetchBackend {
  override handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    const url = new URL(request.urlWithParams, 'http://in-process.invalid');
    if (!url.pathname.startsWith('/api/')) return super.handle(request);

    return defer(() => handleApiRequest(request.method, url)).pipe(
      mergeMap((result) => {
        const init = {
          status: result.status,
          headers: new HttpHeaders({ ...result.headers }),
          url: request.urlWithParams,
        };
        return result.status >= 400
          ? throwError(() => new HttpErrorResponse({ ...init, error: result.body }))
          : of(new HttpResponse({ ...init, body: result.body ?? null }));
      }),
    );
  }
}
