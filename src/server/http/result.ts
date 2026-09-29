import type { Problem } from '@shared/api/contracts';

/**
 * A transport-neutral response. The API router returns these, and two adapters
 * turn them into bytes: Express for the network, and the in-process backend
 * for HttpClient calls made during server-side rendering.
 */
export interface ApiResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  /** Absent for 304 and HEAD. */
  readonly body?: unknown;
}

export function json(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): ApiResult {
  return {
    status,
    body,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  };
}

export function problem(status: number, title: string, detail?: string): ApiResult {
  const body: Problem = { type: 'about:blank', title, status, ...(detail ? { detail } : {}) };
  return {
    status,
    body,
    headers: {
      'content-type': 'application/problem+json; charset=utf-8',
      'cache-control': 'no-store',
    },
  };
}

/**
 * Weak validator: the body is regenerated on every request, so it is only
 * semantically equivalent between two responses, never byte-identical.
 */
export function withEtag(result: ApiResult, tag: string, ifNoneMatch: string | null): ApiResult {
  const etag = `W/"${tag}"`;
  const headers = { ...result.headers, etag };
  const matches = ifNoneMatch?.split(',').some((candidate) => candidate.trim() === etag) ?? false;
  return matches ? { status: 304, headers: omitContentType(headers) } : { ...result, headers };
}

function omitContentType(headers: Record<string, string>): Record<string, string> {
  const { ['content-type']: _omitted, ...rest } = headers;
  return rest;
}
