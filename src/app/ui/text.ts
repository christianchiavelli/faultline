/**
 * Upstream strings such as "south of the Fiji Islands" start lowercase because
 * they are written to follow a magnitude ("M4.4 - south of…"). Standing alone
 * as a heading or a table cell, they need a capital.
 */
export function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase('en') + text.slice(1);
}

/** Lowercase and without accents, the way a search compares text: "pahala" finds "Pāhala". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** The words of a search, folded: each one must appear, in any order. */
export function searchWords(search: string): string[] {
  return fold(search).split(/\s+/).filter(Boolean);
}
