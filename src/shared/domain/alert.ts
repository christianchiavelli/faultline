import type { AlertLevel } from './quake';

/**
 * PAGER estimates impact from the shaking and the population exposed to it,
 * within minutes of an event. The levels summarise its fatality and economic
 * loss estimates; they are a forecast, not a count.
 */
const MEANING: Readonly<Record<AlertLevel, string>> = {
  green: 'Little or no damage or loss of life expected.',
  yellow: 'Some damage and a few casualties possible.',
  orange: 'Significant damage and casualties likely.',
  red: 'Extensive damage and many casualties likely.',
};

export function alertMeaning(level: AlertLevel): string {
  return MEANING[level];
}
