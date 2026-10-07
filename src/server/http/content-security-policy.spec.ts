import {
  NONCE_PLACEHOLDER,
  contentSecurityPolicy,
  withContentSecurityPolicy,
} from './content-security-policy';

const PAGE = `<fl-root ngCspNonce="${NONCE_PLACEHOLDER}"></fl-root><script nonce="${NONCE_PLACEHOLDER}">boot()</script>`;

function page(body = PAGE, headers: Record<string, string> = {}) {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html;charset=UTF-8', 'content-length': '999', ...headers },
  });
}

describe('contentSecurityPolicy', () => {
  const directive = (name: string) =>
    contentSecurityPolicy('abc')
      .split('; ')
      .find((entry) => entry.startsWith(`${name} `))
      ?.slice(name.length + 1);

  it('runs the app’s own files and what carries the nonce, nothing else', () => {
    expect(directive('script-src')).toBe("'self' 'nonce-abc'");
    expect(directive('style-src')).toBe("'self' 'nonce-abc'");
  });

  it('refuses plugins and framing, and keeps the base and forms at home', () => {
    expect(directive('object-src')).toBe("'none'");
    expect(directive('frame-ancestors')).toBe("'none'");
    expect(directive('base-uri')).toBe("'self'");
    expect(directive('form-action')).toBe("'self'");
  });
});

describe('withContentSecurityPolicy', () => {
  it('puts the same nonce in the markup and in the policy', async () => {
    const response = await withContentSecurityPolicy(page(), 'n0nce');

    expect(await response.text()).toBe(
      '<fl-root ngCspNonce="n0nce"></fl-root><script nonce="n0nce">boot()</script>',
    );
    expect(response.headers.get('content-security-policy')).toContain("'nonce-n0nce'");
  });

  it('draws a new nonce for every page', async () => {
    const policies = await Promise.all(
      [page(), page()].map(async (response) =>
        (await withContentSecurityPolicy(response)).headers.get('content-security-policy'),
      ),
    );

    expect(policies[0]).not.toBe(policies[1]);
  });

  it('keeps the status and headers, minus a length the swap made wrong', async () => {
    const response = await withContentSecurityPolicy(page(PAGE, { 'x-test': 'kept' }), 'n');

    expect(response.status).toBe(200);
    expect(response.headers.get('x-test')).toBe('kept');
    expect(response.headers.get('content-length')).toBeNull();
  });

  it('passes anything that is not a page through untouched', async () => {
    const json = new Response('{}', { headers: { 'content-type': 'application/json' } });

    expect(await withContentSecurityPolicy(json)).toBe(json);
  });
});
