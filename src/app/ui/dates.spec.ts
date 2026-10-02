import { formatDate } from '@angular/common';
import { DATES } from './dates';

const MOMENT = Date.UTC(2026, 9, 1, 20, 0, 34);

describe('DATES', () => {
  it('writes each date the way its comment says', () => {
    const format = (pattern: string) => formatDate(MOMENT, pattern, 'en-GB', 'UTC');

    expect(format(DATES.day)).toBe('Thursday 1 October');
    expect(format(DATES.moment)).toBe('Thu 1 Oct 2026, 20:00:34');
    expect(format(DATES.dayAndTime)).toBe('1 Oct, 20:00');
    expect(format(DATES.date)).toBe('1 Oct 2026');
    expect(format(DATES.dateAtTime)).toBe('1 Oct 2026 at 20:00');
  });
});
