import { Pipe, type PipeTransform } from '@angular/core';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "12 s ago", "3 min ago", "5 h ago". Terse on purpose: it sits next to an exact UTC time. */
export function formatAgo(time: number, now: number): string {
  const elapsed = Math.max(0, now - time);
  if (elapsed < 5 * SECOND) return $localize`:time since, under five seconds:just now`;
  if (elapsed < MINUTE) {
    return $localize`:time since, in seconds:${Math.floor(elapsed / SECOND)}:seconds: s ago`;
  }
  if (elapsed < HOUR) {
    return $localize`:time since, in minutes:${Math.floor(elapsed / MINUTE)}:minutes: min ago`;
  }
  if (elapsed < DAY) {
    return $localize`:time since, in hours:${Math.floor(elapsed / HOUR)}:hours: h ago`;
  }
  return $localize`:time since, in days:${Math.floor(elapsed / DAY)}:days: d ago`;
}

/**
 * Pure: `now` is an argument rather than read inside, so the pipe re-runs
 * when the clock signal ticks and never on unrelated change detection.
 */
@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(time: number, now: number): string {
    return formatAgo(time, now);
  }
}
