import { DEFAULT_LOG_QUERY, logParams, parseLogQuery } from './log-query';

describe('parseLogQuery', () => {
  it('reads an empty address as the default view', () => {
    expect(parseLogQuery({})).toEqual(DEFAULT_LOG_QUERY);
  });

  it('reads the magnitude floor and the unfolded log', () => {
    expect(parseLogQuery({ mag: 'any', rows: 'all' })).toEqual({
      magnitude: 'any',
      unfolded: true,
    });
    expect(parseLogQuery({ mag: '4.5' }).magnitude).toBe('4.5');
  });

  it('reads a value it does not know as the default, rather than failing the page', () => {
    expect(parseLogQuery({ mag: '7', rows: 'some' })).toEqual(DEFAULT_LOG_QUERY);
  });
});

describe('logParams', () => {
  it('leaves defaults out of the address', () => {
    expect(logParams(DEFAULT_LOG_QUERY)).toEqual({});
  });

  it('writes what differs from the default, and reads back as the same view', () => {
    const query = { magnitude: 'any', unfolded: true } as const;

    expect(logParams(query)).toEqual({ mag: 'any', rows: 'all' });
    expect(parseLogQuery(logParams(query))).toEqual(query);
  });
});
