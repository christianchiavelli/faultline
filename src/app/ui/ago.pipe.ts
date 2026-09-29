import { Pipe, type PipeTransform } from '@angular/core';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "12 s ago", "3 min ago", "5 h ago". Terse on purpose: it sits next to an exact UTC time. */
export function formatAgo(time: number, now: number): string {
  const elapsed = Math.max(0, now - time);
  if (elapsed < 5 * SECOND) return 'just now';
  if (elapsed < MINUTE) return `${Math.floor(elapsed / SECOND)} s ago`;
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
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
