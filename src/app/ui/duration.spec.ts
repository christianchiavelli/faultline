import { formatDuration } from './duration';

describe('formatDuration', () => {
  it.each([
    [30_000, 'under a minute'],
    [60_000, '1 minute'],
    [43.5 * 60_000, '43 minutes'],
    [3 * 3_600_000 + 50 * 60_000, '3 hours'],
    [1_445 * 60_000, '1 day'],
    [3 * 86_400_000, '3 days'],
  ])('reads %i ms as "%s"', (span, expected) => {
    expect(formatDuration(span)).toBe(expected);
  });

  it('does not report a negative span', () => {
    expect(formatDuration(-5_000)).toBe('under a minute');
  });
});
