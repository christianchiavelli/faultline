import { readServerConfig } from './config';

describe('readServerConfig', () => {
  it('runs on its defaults with nothing set', () => {
    expect(readServerConfig({})).toMatchObject({
      trustProxy: false,
      clientRate: { capacity: 60, refillPerSecond: 1 },
      streamsPerClient: 20,
    });
  });

  it('reads what is set, a rate below one a second included', () => {
    expect(
      readServerConfig({
        RATE_LIMIT_BURST: '100',
        RATE_LIMIT_PER_SECOND: '0.5',
        STREAMS_PER_CLIENT: '4',
        TRUST_PROXY: '1',
      }),
    ).toMatchObject({
      trustProxy: 1,
      clientRate: { capacity: 100, refillPerSecond: 0.5 },
      streamsPerClient: 4,
    });
  });

  it.each([
    [{ RATE_LIMIT_BURST: 'sixty' }, 'RATE_LIMIT_BURST must be a number above zero, not "sixty"'],
    [{ RATE_LIMIT_PER_SECOND: '0' }, 'RATE_LIMIT_PER_SECOND must be a number above zero, not "0"'],
    [{ STREAMS_PER_CLIENT: '2.5' }, 'STREAMS_PER_CLIENT must be a whole number, not "2.5"'],
  ])('stops the server on a setting it cannot be, rather than its default: %o', (env, message) => {
    expect(() => readServerConfig(env)).toThrow(message);
  });
});
