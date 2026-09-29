import { backoffDelay, getJson, UpstreamError } from './upstream';

const noWait = () => Promise.resolve();

function respond(status: number, body = ''): Response {
  return new Response(body || null, { status });
}

describe('getJson', () => {
  it('parses a successful body', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, '{"ok":true}'));

    expect(await getJson('https://usgs.test', { fetchFn, sleep: noWait })).toEqual({
      status: 200,
      body: { ok: true },
    });
  });

  it('retries a 503 and succeeds on the next attempt', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200, '[]'));

    expect((await getJson('https://usgs.test', { fetchFn, sleep: noWait })).body).toEqual([]);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last retry with an UpstreamError', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(502));

    await expect(
      getJson('https://usgs.test', { fetchFn, sleep: noWait, retries: 2 }),
    ).rejects.toBeInstanceOf(UpstreamError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('retries network failures too', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(respond(200, '{}'));

    expect((await getJson('https://usgs.test', { fetchFn, sleep: noWait })).status).toBe(200);
  });

  it('returns a 404 as an answer, not a failure, so the caller can say "no such event"', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(404, 'Error 404: Not Found'));

    expect(await getJson('https://usgs.test', { fetchFn, sleep: noWait })).toEqual({
      status: 404,
      body: 'Error 404: Not Found',
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe('backoffDelay', () => {
  it('draws from a window that doubles per attempt and stops growing at two seconds', () => {
    expect(backoffDelay(0, () => 1)).toBe(250);
    expect(backoffDelay(1, () => 1)).toBe(500);
    expect(backoffDelay(10, () => 1)).toBe(2_000);
    expect(backoffDelay(3, () => 0)).toBe(0);
  });
});
