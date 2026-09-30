import { DecimalPipe, I18nPluralPipe, formatDate } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, model, untracked } from '@angular/core';
import {
  FormField,
  applyWhen,
  form,
  validate,
  validateStandardSchema,
  type FieldTree,
} from '@angular/forms/signals';
import { exportUrl, injectExportCount } from '@core/api/export';
import { QUERY_CLIENT } from '@core/api/query-client';
import { Clock } from '@core/clock';
import { EXPORT_COLUMNS, EXPORT_LIMIT, exportDateRangeSchema } from '@shared/api/export';
import type { QuakeSummary } from '@shared/domain/quake';
import { provideTanStackQuery } from '@tanstack/angular-query-experimental';
import { Dialog } from '@ui/dialog';
import { Icon } from '@ui/icon';
import {
  DEFAULT_PRESET,
  DEPTH_CHOICES,
  KIND_CHOICES,
  MAGNITUDE_CHOICES,
  RADIUS_CHOICES,
  REVIEW_CHOICES,
  describeFile,
  describeLeftOut,
  describePeriod,
  initialForm,
  isoDay,
  periodChoices,
  suggestionsFor,
  toAnchor,
  toQuery,
  type ExportPreset,
  type Suggestion,
} from './export-request';

type Footer =
  | { readonly kind: 'invalid' | 'counting' | 'error' }
  | {
      readonly kind: 'empty' | 'ready' | 'over';
      readonly count: number;
      readonly settled: boolean;
    };

/**
 * The export dialog: a search of the whole catalogue, counted as it is
 * narrowed, and downloaded as one file when it fits in one. Loaded with the
 * first click on an export button, so none of it, TanStack Query and Zod
 * included, weighs on the pages that never open it.
 */
@Component({
  selector: 'fl-export-dialog',
  imports: [Dialog, Icon, FormField, DecimalPipe, I18nPluralPipe],
  providers: [provideTanStackQuery(QUERY_CLIENT)],
  templateUrl: './export-dialog.html',
  styleUrl: './export-dialog.css',
})
export class ExportDialog {
  readonly open = model(false);
  /** The event the export is centred on, when opened from its page. */
  readonly event = input<QuakeSummary | null>(null);
  /** The log's filters, when opened from the log. */
  readonly preset = input<ExportPreset>(DEFAULT_PRESET);

  readonly #now = inject(Clock).now;
  /** The counts are for this minute: the clock ticks every second, the query only when this moves. */
  readonly #minute = computed(() => Math.ceil(this.#now() / 60_000) * 60_000);

  protected readonly anchor = computed(() => {
    const event = this.event();
    return event ? toAnchor(event) : null;
  });

  /** Starts again from the defaults when the page it was opened from changes, and not before. */
  protected readonly model = linkedSignal(() =>
    initialForm(this.anchor(), this.preset(), untracked(this.#now)),
  );

  protected readonly form = form(this.model, (path) => {
    applyWhen(
      path,
      ({ valueOf }) => valueOf(path.period) === 'custom',
      (custom) => {
        // The same rules the BFF applies, from the same schema.
        validateStandardSchema(custom.custom, exportDateRangeSchema);
        validate(custom.custom.to, ({ value }) =>
          value() > isoDay(this.#now())
            ? { kind: 'future', message: 'Pick a day up to today.' }
            : null,
        );
      },
    );
  });

  protected readonly periods = computed(() => periodChoices(this.anchor()));
  protected readonly magnitudes = MAGNITUDE_CHOICES;
  protected readonly depths = DEPTH_CHOICES;
  protected readonly radii = RADIUS_CHOICES;
  protected readonly reviews = REVIEW_CHOICES;
  protected readonly kinds = KIND_CHOICES;
  protected readonly columns = EXPORT_COLUMNS.length;
  protected readonly limit = EXPORT_LIMIT;
  protected readonly events = { '=1': 'event', other: 'events' };

  protected readonly query = computed(() =>
    this.form().valid() ? toQuery(this.model(), this.anchor(), this.#minute()) : null,
  );

  protected readonly count = injectExportCount(() => (this.open() ? this.query() : null));

  protected readonly footer = computed((): Footer => {
    if (!this.query()) return { kind: 'invalid' };
    if (this.count.isError()) return { kind: 'error' };
    const data = this.count.data();
    if (!data) return { kind: 'counting' };
    const settled = !this.count.isPlaceholderData();
    if (data.count === 0) return { kind: 'empty', count: 0, settled };
    return { kind: data.count > data.limit ? 'over' : 'ready', count: data.count, settled };
  });

  protected readonly lede = computed(() => {
    const anchor = this.anchor();
    if (!anchor) {
      return 'A file for a spreadsheet or a map, straight from the USGS catalogue. Times are UTC.';
    }
    const when = formatDate(anchor.time, "d MMM yyyy 'at' HH:mm", 'en-US', 'UTC');
    return `Around ${anchor.description}, on ${when} UTC.`;
  });

  /** What the log filtered by and the catalogue cannot, said before the reader counts on it. */
  protected readonly leftOut = computed(() => describeLeftOut(this.preset().leftOut));

  protected readonly periodText = computed(() => {
    const query = this.query();
    return query ? describePeriod(this.model(), query) : '';
  });

  protected readonly fileText = computed(() => {
    const query = this.query();
    const footer = this.footer();
    return query && 'count' in footer ? describeFile(query, footer.count, this.model().format) : '';
  });

  protected readonly downloadUrl = computed(() => {
    const query = this.query();
    return query ? exportUrl(query, this.model().format) : null;
  });

  protected readonly fromError = computed(() => this.#errorOf(this.form.custom.from));
  protected readonly toError = computed(() => this.#errorOf(this.form.custom.to));

  /** Only the candidates of a search that is too large; each is counted before it is offered. */
  readonly #candidates = computed((): readonly Suggestion[] => {
    const footer = this.footer();
    const query = this.query();
    return footer.kind === 'over' && footer.settled && query
      ? suggestionsFor(this.model(), query, footer.count, this.anchor())
      : [];
  });

  readonly #candidateCounts = [0, 1].map((index) =>
    injectExportCount(() => {
      const candidate = this.#candidates()[index];
      return candidate
        ? toQuery({ ...this.model(), ...candidate.change }, this.anchor(), this.#minute())
        : null;
    }),
  );

  protected readonly suggestions = computed(() =>
    this.#candidates().flatMap((candidate, index) => {
      const count = this.#candidateCounts[index]?.data()?.count;
      return count !== undefined && count > 0 && count <= EXPORT_LIMIT
        ? [{ ...candidate, count }]
        : [];
    }),
  );

  protected apply(suggestion: Suggestion): void {
    this.model.update((current) => ({ ...current, ...suggestion.change }));
  }

  protected close(): void {
    this.open.set(false);
  }

  #errorOf(field: FieldTree<string>): string | null {
    const state = field();
    if (!state.dirty() && !state.touched()) return null;
    return state.errors()[0]?.message ?? null;
  }
}
