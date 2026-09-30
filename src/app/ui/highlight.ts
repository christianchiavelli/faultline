import { Component, computed, input } from '@angular/core';
import { fold, searchWords } from './text';

export interface HighlightPart {
  readonly text: string;
  readonly hit: boolean;
}

/**
 * The text cut where the words of a search occur, compared the way the search
 * compares them: "pahala" marks the "Pāhala" of the original, accent and all.
 */
export function highlight(text: string, search: string): HighlightPart[] {
  const words = searchWords(search);
  if (!words.length || !text) return [{ text, hit: false }];

  // Folded one character at a time, so a match in the folded text maps back to the original.
  let folded = '';
  const origin: number[] = [];
  for (let index = 0; index < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(index)!);
    const letters = fold(char);
    // One entry per UTF-16 unit, as `indexOf` counts them.
    origin.push(...new Array<number>(letters.length).fill(index));
    folded += letters;
    index += char.length;
  }

  const hit = new Array<boolean>(text.length).fill(false);
  for (const word of words) {
    for (let at = folded.indexOf(word); at >= 0; at = folded.indexOf(word, at + word.length)) {
      let end = at + word.length < folded.length ? origin[at + word.length]! : text.length;
      // Accents written as separate marks stay with the letter they sit on.
      while (end < text.length && /\p{M}/u.test(text[end]!)) end++;
      hit.fill(true, origin[at]!, end);
    }
  }

  const parts: HighlightPart[] = [];
  for (let start = 0; start < text.length;) {
    let end = start + 1;
    while (end < text.length && hit[end] === hit[start]) end++;
    parts.push({ text: text.slice(start, end), hit: hit[start]! });
    start = end;
  }
  return parts;
}

/**
 * Text with the words of a search marked in it. Each part is an element of
 * its own, so the template adds no space between them.
 */
@Component({
  selector: 'ui-highlight',
  template: `
    @for (part of parts(); track $index) {
      @if (part.hit) {
        <mark>{{ part.text }}</mark>
      } @else {
        <span>{{ part.text }}</span>
      }
    }
  `,
  styles: `
    mark {
      background: var(--surface-accent);
      color: inherit;
    }
  `,
})
export class Highlight {
  readonly text = input.required<string>();
  readonly search = input('');

  protected readonly parts = computed(() => highlight(this.text(), this.search()));
}
