import { Component, input, signal } from '@angular/core';
import type { QuakeSummary } from '@shared/domain/quake';
import { Icon } from '@ui/icon';
import { ExportDialog } from './export-dialog';
import { DEFAULT_PRESET, type ExportPreset } from './export-request';

/**
 * The way into an export: a tool button in the event log, or, given an
 * `event`, a link under that event's map. The dialog behind it is a separate
 * chunk, fetched when the browser is idle and rendered on the first click.
 *
 * It renders when `open` turns true rather than on an interaction trigger:
 * a click that lands before the log has hydrated is replayed to the handler,
 * never to a trigger's listener, and would otherwise open nothing.
 */
@Component({
  selector: 'fl-export-button',
  imports: [Icon, ExportDialog],
  template: `
    <button
      type="button"
      [class]="event() ? 'text-button' : 'tool-button'"
      aria-haspopup="dialog"
      (click)="open.set(true)"
    >
      <ui-icon name="download" />
      {{ event() ? 'Export the events near this one…' : 'Export…' }}
    </button>

    @defer (when open(); prefetch on idle) {
      <fl-export-dialog [(open)]="open" [event]="event()" [preset]="preset()" />
    }
  `,
})
export class ExportButton {
  readonly event = input<QuakeSummary | null>(null);
  /** The log's filters, which the dialog opens with. */
  readonly preset = input<ExportPreset>(DEFAULT_PRESET);

  protected readonly open = signal(false);
}
