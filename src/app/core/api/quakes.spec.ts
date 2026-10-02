import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { FeedChange, RecentQuakesResponse } from '@shared/api/contracts';
import { feedVersion } from '@shared/api/feed-change';
import { aQuake } from '@shared/testing/quake-fixture';
import { FakeEventSource } from '../testing/fake-event-source';
import { liveQuakesResource } from './quakes';

@Component({ template: '' })
class Reader {
  readonly feed = liveQuakesResource('day');
}

const NOW = Date.UTC(2026, 9, 1, 12);

const day: RecentQuakesResponse = {
  window: 'day',
  generatedAt: NOW,
  stale: false,
  skipped: 0,
  quakes: [aQuake({ id: 'us1tonga', time: NOW - 3_600_000 })],
};

const fresh = aQuake({ id: 'nc1fresh', time: NOW + 30_000 });

const aMinuteOn: FeedChange = {
  generatedAt: NOW + 60_000,
  stale: false,
  skipped: 0,
  upserted: [fresh],
  removed: [],
};

let visibility: DocumentVisibilityState = 'visible';

function show(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

/** A component reading the day, its first copy asked for and not yet answered. */
function start() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const fixture = TestBed.createComponent(Reader);
  TestBed.tick();
  const request = TestBed.inject(HttpTestingController).expectOne(
    (request) => request.url === '/api/quakes/recent',
  );
  return { fixture, feed: fixture.componentInstance.feed, request };
}

/** The same, handed the day. */
async function following() {
  const reading = start();
  reading.request.flush(day);
  await reading.fixture.whenStable();
  return reading;
}

const latest = () => FakeEventSource.opened.at(-1)!;

describe('liveQuakesResource', () => {
  beforeEach(() => {
    vi.stubGlobal('EventSource', FakeEventSource);
    FakeEventSource.reset();
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('follows the feed from the copy it holds, and waits for that copy to do so', async () => {
    const { fixture, request } = start();
    expect(FakeEventSource.opened).toEqual([]);

    request.flush(day);
    await fixture.whenStable();

    expect(FakeEventSource.opened.map((source) => source.url)).toEqual([
      `/api/quakes/recent/stream?window=day&since=${feedVersion(day)}`,
    ]);
  });

  it('brings its copy up to date with each change the stream pushes', async () => {
    const { feed } = await following();

    latest().send('change', aMinuteOn);

    expect(feed.value()?.generatedAt).toBe(NOW + 60_000);
    expect(feed.value()?.quakes.map((quake) => quake.id)).toEqual(['nc1fresh', 'us1tonga']);
  });

  it('follows from nothing when its copy failed, and recovers once the stream has the feed', async () => {
    const { fixture, feed, request } = start();
    request.flush({ title: 'The USGS did not answer' }, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    expect(latest().url).toBe('/api/quakes/recent/stream?window=day');

    latest().send('feed', day);

    expect(feed.error()).toBeUndefined();
    expect(feed.value()).toEqual(day);
  });

  it('lets the stream go while the tab is hidden, and picks up from its copy once it is back', async () => {
    const { feed } = await following();
    latest().send('change', aMinuteOn);
    const before = latest();

    show('hidden');
    expect(before.readyState).toBe(FakeEventSource.CLOSED);

    show('visible');
    expect(latest()).not.toBe(before);
    expect(latest().url).toBe(
      `/api/quakes/recent/stream?window=day&since=${feedVersion(feed.value()!)}`,
    );
  });

  it('leaves a dropped stream to the browser, and opens a refused one again a minute later', async () => {
    await following();
    vi.useFakeTimers();

    latest().fail({ closed: false });
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.opened).toHaveLength(1);

    latest().fail({ closed: true });
    vi.advanceTimersByTime(59_000);
    expect(FakeEventSource.opened).toHaveLength(1);
    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.opened).toHaveLength(2);
  });

  it('closes the stream with the page', async () => {
    const { fixture } = await following();

    fixture.destroy();

    expect(latest().readyState).toBe(FakeEventSource.CLOSED);
  });
});
