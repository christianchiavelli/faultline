import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  linkedSignal,
  viewChild,
  type ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Icon } from '@ui/icon';
import { logParams, normaliseSearch, type LogQuery } from './log-query';

/** A pause this long means the reader has stopped typing, for now. */
const TYPING_MS = 250;

/**
 * The search of the log by place name, kept in the address like the filters.
 * Before the page hydrates it is a plain form: Enter sends it with the rest of
 * the view, and the server renders the answer.
 */
@Component({
  selector: 'fl-log-search',
  imports: [Icon],
  templateUrl: './log-search.html',
  styleUrl: './log-search.css',
  host: { '(document:keydown)': 'shortcut($event)' },
})
export class LogSearch {
  readonly query = input.required<LogQuery>();

  readonly #router = inject(Router);
  readonly #document = inject(DOCUMENT);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** What the field holds, which runs ahead of the address while the reader types. */
  protected readonly draft = linkedSignal(() => this.query().search);

  /** The rest of the view, carried by a search sent before the page has hydrated. */
  protected readonly carried = computed(() =>
    Object.entries(logParams({ ...this.query(), search: '' })).map(([name, value]) => ({
      name,
      value: String(value),
    })),
  );

  constructor() {
    // Back, or Clear filters, changes the search under the field. It follows, unless the reader is typing in it.
    afterRenderEffect(() => {
      const search = this.query().search;
      const field = this.field().nativeElement;
      if (this.#document.activeElement !== field && field.value !== search) field.value = search;
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.#timer));
  }

  protected typed(value: string): void {
    this.draft.set(value);
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#send(value), TYPING_MS);
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    clearTimeout(this.#timer);
    this.#send(this.field().nativeElement.value);
  }

  protected clear(): void {
    const field = this.field().nativeElement;
    field.value = '';
    this.draft.set('');
    clearTimeout(this.#timer);
    this.#send('');
    field.focus();
  }

  /** `/` puts the reader in the search from anywhere on the page, as on most sites that have one. */
  protected shortcut(event: KeyboardEvent): void {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target : null;
    const typing = target?.closest('input, textarea, select, [contenteditable]');
    if (typing || this.#document.querySelector('dialog[open]')) return;
    event.preventDefault();
    const field = this.field().nativeElement;
    field.focus();
    field.select();
  }

  #send(value: string): void {
    const search = normaliseSearch(value);
    const query = this.query();
    if (search === query.search) return;
    // Starting a search is a step Back undoes; each word typed after it is not another.
    void this.#router.navigate([], {
      queryParams: logParams({ ...query, search }),
      replaceUrl: query.search !== '',
    });
  }
}
