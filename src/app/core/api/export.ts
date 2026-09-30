import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import {
  exportSearchParams,
  type ExportCount,
  type ExportFormat,
  type ExportQuery,
} from '@shared/api/export';
import { injectQuery, keepPreviousData } from '@tanstack/angular-query-experimental';
import { fromEvent, lastValueFrom, takeUntil } from 'rxjs';

/**
 * How many events an export would hold. Cached per query, so going back to a
 * choice already made answers at once, and the last count stays on screen
 * while the next one loads instead of blinking to empty. `null` asks nothing.
 *
 * Needs a `QueryClient` from `QUERY_CLIENT`, provided where it is used.
 */
export function injectExportCount(query: () => ExportQuery | null) {
  const http = inject(HttpClient);

  return injectQuery(() => {
    const current = query();
    const params = current ? exportSearchParams(current).toString() : '';
    return {
      queryKey: ['export-count', params],
      enabled: current !== null,
      placeholderData: keepPreviousData,
      queryFn: ({ signal }) =>
        lastValueFrom(
          // Unsubscribing aborts the request, so a count nobody waits for any more lets go of its connection.
          http
            .get<ExportCount>(`/api/quakes/count?${params}`)
            .pipe(takeUntil(fromEvent(signal, 'abort'))),
        ),
    };
  });
}

/** The download link. A plain link, so the browser's own download manager shows the progress. */
export function exportUrl(query: ExportQuery, format: ExportFormat): string {
  const params = exportSearchParams(query);
  params.set('format', format);
  return `/api/quakes/export?${params}`;
}
