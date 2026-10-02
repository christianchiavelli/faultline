import { expect, test, type Page } from '@playwright/test';

interface Message {
  readonly event: string;
  readonly id: string;
  /** Events in it: the whole day's, or those a change brings. */
  readonly quakes: number;
}

/** The first message the day's stream sends a reader holding `since`, or `null` within a second. */
function firstMessage(page: Page, since?: string): Promise<Message | null> {
  return page.evaluate(async (since) => {
    const params = new URLSearchParams(since ? { window: 'day', since } : { window: 'day' });
    const source = new EventSource(`/api/quakes/recent/stream?${params}`);
    try {
      return await new Promise<Message | null>((resolve) => {
        setTimeout(() => resolve(null), 1_000);
        source.addEventListener('feed', (event) =>
          resolve({
            event: 'feed',
            id: event.lastEventId,
            quakes: JSON.parse(event.data).quakes.length,
          }),
        );
        source.addEventListener('change', (event) =>
          resolve({
            event: 'change',
            id: event.lastEventId,
            quakes: JSON.parse(event.data).upserted.length,
          }),
        );
      });
    } finally {
      source.close();
    }
  }, since);
}

test('streams the day to a reader holding none, and nothing already held to one holding it', async ({
  page,
}) => {
  await page.goto('/quakes/us7000big');

  const first = await firstMessage(page);
  expect(first).toEqual({ event: 'feed', id: expect.stringMatching(/^\d+-f$/), quakes: 14 });

  // A change is still news, should the feed move on meanwhile; the whole day again would not be.
  expect((await firstMessage(page, first!.id))?.event).not.toBe('feed');
});

test('compresses the stream, and still sends each message the moment it is written', async ({
  page,
}) => {
  await page.goto('/quakes/us7000big');

  const headers = await page.evaluate(async () => {
    const controller = new AbortController();
    const response = await fetch('/api/quakes/recent/stream?window=day', {
      signal: controller.signal,
    });
    controller.abort();
    return {
      type: response.headers.get('content-type'),
      encoding: response.headers.get('content-encoding'),
      cache: response.headers.get('cache-control'),
    };
  });

  expect(headers).toEqual({
    type: 'text/event-stream; charset=utf-8',
    // Brotli, to a browser that takes it.
    encoding: expect.stringMatching(/^(br|gzip)$/),
    cache: 'no-store',
  });
  // Held in the compressor's buffer, the day would not arrive within the second.
  expect(await firstMessage(page)).not.toBeNull();
});
