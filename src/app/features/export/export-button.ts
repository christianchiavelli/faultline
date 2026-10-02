import { Component, input, signal } from '@angular/core';
import type { QuakeSummary } from '@shared/domain/quake';
import { Icon } from '@ui/icon';
import { ExportDialog } from './export-dialog';
import { DEFAULT_PRESET, type ExportPreset } from './export-request';

/**
 * The way into an export: a tool button in the event log, or, given an
 * `event`, a link under that event's map. The dialog behind it is a separate
 * chunk, rendered closed while the browser is idle, so that a tap only has to
 * show it: building it, its form and its query takes a phone longer than a
 * tap can wait for its answer.
 *
 * It also renders when `open` turns true rather than on an interaction
 * trigger: a click that lands before the log has hydrated, or before the
 * browser was idle, is replayed to the handler, never to a trigger's
 * listener, and would otherwise open nothing.
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
      @if (event()) {
        <ng-container i18n="button under an event's map that opens the export"
          >Export the events near this one…</ng-container
        >
      } @else {
        <ng-container i18n="button over the log that opens the export">Export…</ng-container>
      }
    </button>

    @defer (on idle; when open()) {
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
