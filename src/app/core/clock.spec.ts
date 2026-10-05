import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Clock } from './clock';

const START = Date.parse('2026-10-04T12:00:00.400Z');

describe('Clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ticks on the second, then every second, so no digit is skipped or shown twice', () => {
    const clock = TestBed.inject(Clock);
    expect(clock.now()).toBe(START);

    vi.advanceTimersByTime(599);
    expect(clock.now()).toBe(START);

    vi.advanceTimersByTime(1);
    expect(clock.now()).toBe(Date.parse('2026-10-04T12:00:01Z'));

    vi.advanceTimersByTime(1_000);
    expect(clock.now()).toBe(Date.parse('2026-10-04T12:00:02Z'));
  });

  it('stops with the app', () => {
    const clock = TestBed.inject(Clock);

    TestBed.resetTestingModule();
    vi.advanceTimersByTime(5_000);

    expect(clock.now()).toBe(START);
  });

  it('holds the moment the request arrived on the server, where no timer may outlive it', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const clock = TestBed.inject(Clock);

    vi.advanceTimersByTime(5_000);

    expect(clock.now()).toBe(START);
    expect(vi.getTimerCount()).toBe(0);
  });
});
