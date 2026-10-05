import { backoffDelay, describeError, getJson, getText, UpstreamError } from './upstream';

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

  it('retries a body cut off halfway, like an answer that never came', async () => {
    const cut = respond(200, '{}');
    vi.spyOn(cut, 'text').mockRejectedValue(new TypeError('terminated'));
    const fetchFn = vi.fn().mockResolvedValueOnce(cut).mockResolvedValueOnce(respond(200, '{}'));

    expect((await getJson('https://usgs.test', { fetchFn, sleep: noWait })).body).toEqual({});
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('puts JSON it cannot read down to the USGS, not to a fault of its own', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, '<html>Service Unavailable</html>'));

    const failure = getJson('https://usgs.test', { fetchFn, sleep: noWait });

    await expect(failure).rejects.toBeInstanceOf(UpstreamError);
    await expect(failure).rejects.toMatchObject({ status: 200 });
  });

  it('spends a call from the budget before every attempt, retries included', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(503));
    const beforeAttempt = vi.fn();

    await expect(
      getJson('https://usgs.test', { fetchFn, sleep: noWait, retries: 2, beforeAttempt }),
    ).rejects.toBeInstanceOf(UpstreamError);
    expect(beforeAttempt).toHaveBeenCalledTimes(3);
  });

  it('tries a heavy search once against a timeout or the USGS gateway timing out', async () => {
    const options = { sleep: noWait, retryTimeouts: false, timeoutMs: 10 };
    const gatewayTimeout = vi.fn().mockResolvedValue(respond(504, 'Gateway Timeout'));
    const hanging = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason)),
        ),
    );

    expect(await getJson('https://usgs.test', { ...options, fetchFn: gatewayTimeout })).toEqual({
      status: 504,
      body: 'Gateway Timeout',
    });
    await expect(
      getJson('https://usgs.test', { ...options, fetchFn: hanging as typeof fetch }),
    ).rejects.toThrow('USGS did not answer within 10 ms');
    expect(gatewayTimeout).toHaveBeenCalledTimes(1);
    expect(hanging).toHaveBeenCalledTimes(1);
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

describe('getText', () => {
  it('hands back the body as it came, for formats that are not JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(respond(200, 'time,latitude\n'));

    expect(await getText('https://usgs.test', { fetchFn, sleep: noWait })).toEqual({
      status: 200,
      text: 'time,latitude\n',
    });
  });

  it('stops at once when the caller gives up, without retrying or blaming the USGS', async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
    });

    const error: unknown = await getText('https://usgs.test', {
      fetchFn,
      sleep: noWait,
      signal: controller.signal,
    }).catch((reason: unknown) => reason);

    expect(error).not.toBeInstanceOf(UpstreamError);
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

describe('describeError', () => {
  it('puts an error and every cause under it on one line', () => {
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:9');
    const failed = new TypeError('fetch failed', { cause: refused });

    expect(
      describeError(new UpstreamError('USGS did not answer', undefined, { cause: failed })),
    ).toBe('USGS did not answer ← fetch failed ← connect ECONNREFUSED 127.0.0.1:9');
    expect(describeError('down')).toBe('down');
  });
});
