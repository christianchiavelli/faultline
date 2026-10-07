import { randomBytes } from 'node:crypto';

/**
 * What `index.html` puts on the root element in place of a nonce. Angular reads it there and
 * repeats it on every inline script and style it renders, so swapping the placeholder for a
 * fresh value is all a response needs.
 */
export const NONCE_PLACEHOLDER = '__CSP_NONCE__';

export function contentSecurityPolicy(nonce: string): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`],
    'style-src': ["'self'", `'nonce-${nonce}'`],
    // Angular writes style bindings into the server-rendered page as attributes.
    'style-src-attr': ["'unsafe-inline'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Gives a rendered page a nonce of its own, in its markup and in the policy that names it.
 * Every page is rendered for the request in hand, so no two readers ever share one.
 */
export async function withContentSecurityPolicy(
  response: Response,
  nonce = randomBytes(16).toString('base64'),
): Promise<Response> {
  if (!response.headers.get('content-type')?.startsWith('text/html')) return response;

  const html = (await response.text()).replaceAll(NONCE_PLACEHOLDER, nonce);
  const headers = new Headers(response.headers);
  headers.set('content-security-policy', contentSecurityPolicy(nonce));
  headers.delete('content-length');

  return new Response(html, { status: response.status, statusText: response.statusText, headers });
}
