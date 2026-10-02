/**
 * How the app writes a date for a reader: `DatePipe` patterns, each
 * translated into its language's order and words, so "Thu 1 Oct 2026,
 * 20:00:34" reads "qui., 1 de out. de 2026, 20:00:34" in Portuguese. A clock
 * time is the same in both and stays in its template; a machine-readable one
 * is never translated.
 */
export const DATES = {
  /** A day heading in a list, as in "Thursday 1 October". */
  day: $localize`:Angular DatePipe pattern for a day heading in a list, as in Thursday 1 October:EEEE d MMMM`,
  /** An event's moment, to the second, as in "Thu 1 Oct 2026, 20:00:34". */
  moment: $localize`:Angular DatePipe pattern for an event's moment to the second, with its weekday:EEE d MMM yyyy, HH:mm:ss`,
  /** A moment within the year, as in "29 Sep, 05:00". */
  dayAndTime: $localize`:Angular DatePipe pattern for a day and a time within the year, to the minute:d MMM, HH:mm`,
  /** A date, as in "1 Oct 2026". */
  date: $localize`:Angular DatePipe pattern for a date, as in 1 Oct 2026:d MMM yyyy`,
  /** A date and time in a sentence, as in "1 Oct 2026 at 20:00". */
  dateAtTime: $localize`:Angular DatePipe pattern for a date and a time in a sentence, to the minute:d MMM yyyy 'at' HH:mm`,
} as const;
