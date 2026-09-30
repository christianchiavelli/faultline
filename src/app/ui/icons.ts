import {
  faArrowUpRightFromSquare,
  faDownload,
  faXmark,
  type IconDefinition,
} from '@fortawesome/free-solid-svg-icons';

/**
 * Every icon the design system can draw, from Font Awesome's solid set, keyed
 * by Font Awesome's own names. Named imports keep the bundle to these alone;
 * a new icon is one line here.
 */
export const ICONS = {
  'arrow-up-right-from-square': faArrowUpRightFromSquare,
  download: faDownload,
  xmark: faXmark,
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;
