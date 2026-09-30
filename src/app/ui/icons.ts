/**
 * Every icon the design system can draw, drawn for it rather than borrowed:
 * straight strokes with square ends, the pen of the wordmark, so an icon reads
 * as part of the type beside it.
 *
 * Each is the centre line of its strokes on a 16 px grid, kept inside a
 * two-unit margin so they all look one size; `ui-icon` gives the line its
 * width and its ends. A new icon is one path here, drawn to the same grid.
 */
export const ICONS = {
  'arrow-down': 'M8 2.5V12.5M4.5 9L8 12.5L11.5 9',
  'chevron-down': 'M4.5 6.5L8 10L11.5 6.5',
  close: 'M3.5 3.5L12.5 12.5M12.5 3.5L3.5 12.5',
  download: 'M8 2V10.5M4.5 7.5L8 11L11.5 7.5M2.5 14H13.5',
  'external-link': 'M9 2.5H13.5V7M13.5 2.5L7.5 8.5M11.5 9.5V13.5H2.5V4.5H6.5',
  search: 'M11 7A4 4 0 1 1 3 7A4 4 0 1 1 11 7ZM10 10L13.5 13.5',
  sliders: 'M2.5 5H13.5M2.5 11H13.5M6 3V7M10 9V13',
  sort: 'M5.5 6L8 3.5L10.5 6M5.5 10L8 12.5L10.5 10',
} as const satisfies Record<string, string>;

export type IconName = keyof typeof ICONS;
