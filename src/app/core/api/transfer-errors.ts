import { isPlatformServer } from '@angular/common';
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { catchError, throwError } from 'rxjs';

interface TransferredError {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Angular's transfer cache hands only successful responses to the browser. A
 * page rendered from an API error, such as a missing event or a feed outage,
 * would ask for it again while hydrating and show its loading state on top of
 * the answer it already has.
 *
 * The server records each failed API call in the transfer state. The browser
 * replays it once, for the request hydration makes, and goes to the network
 * for every request after that, so "Try again" still tries again.
 */
export const transferApiErrors: HttpInterceptorFn = (request, next) => {
  if (request.method !== 'GET' || !request.url.startsWith('/api/')) return next(request);

  const state = inject(TransferState);
  const key = makeStateKey<TransferredError>(`api-error:${request.urlWithParams}`);

  if (isPlatformServer(inject(PLATFORM_ID))) {
    return next(request).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          state.set(key, { status: error.status, body: error.error });
        }
        return throwError(() => error);
      }),
    );
  }

  const transferred = state.get(key, null);
  if (!transferred) return next(request);

  state.remove(key);
  const { status, body } = transferred;
  return throwError(
    () => new HttpErrorResponse({ status, error: body, url: request.urlWithParams }),
  );
};
