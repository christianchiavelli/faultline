/**
 * Upstream strings such as "south of the Fiji Islands" start lowercase because
 * they are written to follow a magnitude ("M4.4 - south of…"). Standing alone
 * as a heading or a table cell, they need a capital.
 */
export function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase('en') + text.slice(1);
}
