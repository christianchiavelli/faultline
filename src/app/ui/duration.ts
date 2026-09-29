const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "25 minutes", "3 hours", "1 day": a span in words, in the largest unit that
 * fits. For running text; `formatAgo` is the terse form that sits next to a
 * timestamp. Rounds down, like `formatAgo`, so a day never shows as 24 hours.
 */
export function formatDuration(ms: number): string {
  const span = Math.max(0, ms);
  if (span < MINUTE) return 'under a minute';
  if (span < HOUR) return count(Math.floor(span / MINUTE), 'minute');
  if (span < DAY) return count(Math.floor(span / HOUR), 'hour');
  return count(Math.floor(span / DAY), 'day');
}

function count(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? '' : 's'}`;
}
