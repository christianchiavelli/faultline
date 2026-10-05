import { gracefulShutdown } from './shutdown';

describe('gracefulShutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => vi.useRealTimers());

  function setUp() {
    let closed: (() => void) | undefined;
    const server = {
      close: vi.fn((done?: () => void) => {
        closed = done;
        return server;
      }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
    };
    const streams = { close: vi.fn() };
    const exit = vi.fn();
    const shutDown = gracefulShutdown(server as never, streams, { graceMs: 10_000, exit });
    return { server, streams, exit, shutDown, finish: () => closed?.() };
  }

  it('stops taking connections, ends the streams and lets idle connections go at once', () => {
    const { server, streams, exit, shutDown } = setUp();

    shutDown('SIGTERM');

    expect(server.close).toHaveBeenCalled();
    expect(streams.close).toHaveBeenCalled();
    expect(server.closeIdleConnections).toHaveBeenCalled();
    expect(server.closeAllConnections).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits once what was in flight has finished', () => {
    const { exit, shutDown, finish } = setUp();

    shutDown('SIGTERM');
    finish();

    expect(exit).toHaveBeenCalledWith(0);
  });

  it('cuts what is still open after the grace period', () => {
    const { server, shutDown } = setUp();

    shutDown('SIGINT');
    vi.advanceTimersByTime(9_999);
    expect(server.closeAllConnections).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(server.closeAllConnections).toHaveBeenCalled();
  });
});
