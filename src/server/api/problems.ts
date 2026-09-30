import type { ZodError } from 'zod';
import { problem, type ApiResult } from '../http/result';
import { UpstreamBusyError, UpstreamError } from '../http/upstream';

/**
 * What a failure below the API means to whoever asked, as an RFC 9457 problem.
 * Shared by the router and the export, so the same failure reads the same
 * wherever it surfaces.
 */
export function upstreamProblem(error: unknown, path: string): ApiResult {
  if (error instanceof UpstreamBusyError) {
    const busy = problem(
      503,
      'Too many lookups right now',
      'This server is pacing its requests to the USGS. Try again in a few seconds.',
    );
    return {
      ...busy,
      headers: { ...busy.headers, 'retry-after': String(error.retryAfterSeconds) },
    };
  }
  if (error instanceof UpstreamError) {
    console.warn(`[api] ${path}: ${error.message}`);
    return problem(
      502,
      'The USGS did not answer',
      'Try again in a minute; the USGS usually recovers on its own.',
    );
  }
  console.error(`[api] ${path}`, error);
  return problem(500, 'Something went wrong on our side');
}

/** Every reason a query was refused, in one sentence per reason. */
export function issuesDetail(error: ZodError): string {
  return error.issues.map((issue) => issue.message).join(' ');
}
