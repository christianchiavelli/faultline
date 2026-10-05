import { DecimalPipe, formatDate } from '@angular/common';
import {
  Component,
  LOCALE_ID,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  untracked,
} from '@angular/core';
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
import { DATES } from '@ui/dates';
import { Dialog } from '@ui/dialog';
import { Icon } from '@ui/icon';
import {
  DEFAULT_PRESET,
  DEPTH_CHOICES,
  KIND_CHOICES,
  RADIUS_CHOICES,
  REVIEW_CHOICES,
  describeFile,
  describeLeftOut,
  describePeriod,
  initialForm,
  isoDay,
  magnitudeChoices,
  periodChoices,
  sameAnchor,
  samePreset,
  suggestionsFor,
  toAnchor,
  toQuery,
  type ExportPreset,
  type Suggestion,
} from './export-request';

/** The custom period's rules, the BFF's own, worded for the reader. */
const DATE_RANGE = exportDateRangeSchema({
  missing: $localize`:error under a date field of the export that holds no date:Enter a date.`,
  beforeRecord: $localize`:error under a date field of the export, before the catalogue starts:The catalogue starts in 1900.`,
  inverted: $localize`:error under the end date of a period that ends before it starts:End on or after the start.`,
});

type Footer =
  | { readonly kind: 'invalid' | 'counting' | 'error' }
  | {
      readonly kind: 'empty' | 'ready' | 'over';
      readonly count: number;
      readonly settled: boolean;
    };

/**
 * The export dialog: a search of the whole catalogue, counted as it is
 * narrowed, and downloaded as one file when it fits in one. A chunk of its
 * own, built closed once the page is idle (see `export-button.ts`), so none
 * of it, TanStack Query and Zod included, weighs on the page's first load.
 */
@Component({
  selector: 'fl-export-dialog',
  imports: [Dialog, Icon, FormField, DecimalPipe],
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
  readonly #locale = inject(LOCALE_ID);
  /** The counts are for this minute: the clock ticks every second, the query only when this moves. */
  readonly #minute = computed(() => Math.ceil(this.#now() / 60_000) * 60_000);

  protected readonly anchor = computed(
    () => {
      const event = this.event();
      return event ? toAnchor(event, this.#locale) : null;
    },
    { equal: sameAnchor },
  );
  readonly #preset = computed(() => this.preset(), { equal: samePreset });

  /**
   * Starts again from the defaults when what it was opened on changes, and not
   * before: built while the page is idle, it outlives a change of the log's
   * order, which hands it a new preset with the same filters.
   */
  protected readonly model = linkedSignal(() =>
    initialForm(this.anchor(), this.#preset(), untracked(this.#now)),
  );

  protected readonly form = form(this.model, (path) => {
    applyWhen(
      path,
      ({ valueOf }) => valueOf(path.period) === 'custom',
      (custom) => {
        // The same rules the BFF applies, from the same schema.
        validateStandardSchema(custom.custom, DATE_RANGE);
        validate(custom.custom.to, ({ value }) =>
          value() > isoDay(this.#now())
            ? {
                kind: 'future',
                message: $localize`:error under the end date of the export, a day still to come:Pick a day up to today.`,
              }
            : null,
        );
      },
    );
  });

  protected readonly periods = computed(() => periodChoices(this.anchor()));
  protected readonly magnitudes = magnitudeChoices(this.#locale);
  protected readonly depths = DEPTH_CHOICES;
  protected readonly radii = RADIUS_CHOICES;
  protected readonly reviews = REVIEW_CHOICES;
  protected readonly kinds = KIND_CHOICES;
  protected readonly columns = EXPORT_COLUMNS.length;
  protected readonly limit = EXPORT_LIMIT;

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
      return $localize`:lede of the export dialog, opened from the log:A file for a spreadsheet or a map, straight from the USGS catalogue. Times are UTC.`;
    }
    const when = formatDate(anchor.time, DATES.dateAtTime, this.#locale, 'UTC');
    return $localize`:lede of the export dialog opened from an event, as in Around the M7.8 66 km NNW of Ende, Indonesia, on 14 Aug 2026 at 21.58 UTC:Around ${anchor.description}:event:, on ${when}:when: UTC.`;
  });

  /** What the log filtered by and the catalogue cannot, said before the reader counts on it. */
  protected readonly leftOut = computed(() => describeLeftOut(this.preset().leftOut, this.#locale));

  protected readonly periodText = computed(() => {
    const query = this.query();
    return query ? describePeriod(this.model(), query, this.#locale) : '';
  });

  protected readonly fileText = computed(() => {
    const query = this.query();
    const footer = this.footer();
    return query && 'count' in footer
      ? describeFile(query, footer.count, this.model().format, this.#locale)
      : '';
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
      ? suggestionsFor(this.model(), query, footer.count, this.anchor(), this.#locale)
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
