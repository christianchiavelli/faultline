import { InjectionToken } from '@angular/core';
import { QueryClient } from '@tanstack/angular-query-experimental';

/**
 * TanStack Query's cache, created by the first lazy chunk that asks for it and
 * kept for the session. A token provided in that chunk, rather than
 * `provideTanStackQuery` in the app config, keeps the library out of the main
 * bundle: only the export dialog uses it, and only once it opens.
 */
export const QUERY_CLIENT = new InjectionToken<QueryClient>('QueryClient', {
  providedIn: 'root',
  factory: () =>
    new QueryClient({
      defaultOptions: {
        // A count is good for a minute: the catalogue does not change faster than a reader.
        queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false },
      },
    }),
});
