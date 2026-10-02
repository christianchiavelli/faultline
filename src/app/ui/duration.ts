const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "25 minutes", "3 hours", "1 day": a span in words, in the largest unit that
 * fits and the reader's language. For running text; `formatAgo` is the terse
 * form that sits next to a timestamp. Rounds down, like `formatAgo`, so a day
 * never shows as 24 hours.
 */
export function formatDuration(ms: number, locale: string): string {
  const span = Math.max(0, ms);
  if (span < MINUTE) {
    return $localize`:a span shorter than a minute, as in "revised under a minute after the event":under a minute`;
  }
  const [value, unit] =
    span < HOUR
      ? [Math.floor(span / MINUTE), 'minute']
      : span < DAY
        ? [Math.floor(span / HOUR), 'hour']
        : [Math.floor(span / DAY), 'day'];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}
