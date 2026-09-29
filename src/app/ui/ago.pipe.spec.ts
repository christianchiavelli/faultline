import { formatAgo } from './ago.pipe';

describe('formatAgo', () => {
  const now = Date.UTC(2026, 8, 29, 6, 0, 0);

  it.each([
    [2_000, 'just now'],
    [12_000, '12 s ago'],
    [3 * 60_000, '3 min ago'],
    [5 * 3_600_000, '5 h ago'],
    [2 * 86_400_000, '2 d ago'],
  ])('reads %i ms as "%s"', (elapsed, expected) => {
    expect(formatAgo(now - elapsed, now)).toBe(expected);
  });

  it('does not report the future as negative time', () => {
    expect(formatAgo(now + 10_000, now)).toBe('just now');
  });
});
