import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { magnitudeScale } from '@shared/domain/magnitude';
import { isNotable, type QuakeSummary } from '@shared/domain/quake';
import {
  HOUR_MS,
  ROW_HEIGHT,
  ROW_WIDTH,
  buildTrace,
  burstDuration,
  type TraceEvent,
} from './trace';

const HOURS = 24;
const LABELLED = 6;
const FIVE_MINUTES = ROW_WIDTH / 12;

interface Marker {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly text: string;
  readonly label: string;
}

@Component({
  selector: 'fl-helicorder',
  imports: [RouterLink],
  templateUrl: './helicorder.html',
  styleUrl: './helicorder.css',
})
export class Helicorder {
  readonly quakes = input.required<readonly QuakeSummary[]>();
  readonly now = input.required<number>();

  /**
   * The trace is redrawn every five seconds, not every clock tick: at this
   * width five seconds is under two pixels, and each redraw recomputes the
   * current row's path.
   */
  readonly #drawnAt = computed(() => Math.floor(this.now() / 5_000) * 5_000);

  readonly #events = computed<readonly TraceEvent[]>(() =>
    this.quakes().map((quake) => ({
      id: quake.id,
      time: quake.time,
      magnitude: quake.magnitude?.value ?? null,
      highlighted: isNotable(quake),
    })),
  );

  readonly rows = computed(() => buildTrace(this.#events(), this.#drawnAt(), HOURS));
  readonly viewBox = `0 0 ${ROW_WIDTH} ${HOURS * ROW_HEIGHT}`;
  readonly gridLines = Array.from({ length: 11 }, (_, i) => (i + 1) * FIVE_MINUTES);
  readonly quarterHour = FIVE_MINUTES * 3;
  readonly height = HOURS * ROW_HEIGHT;

  /** Where the pen is now: the right end of the bottom row. */
  readonly pen = computed(() => {
    const rows = this.rows();
    const last = rows.at(-1);
    return {
      left: last ? ((this.#drawnAt() - last.start) / HOUR_MS) * 100 : 0,
      top: ((rows.length - 0.5) / rows.length) * 100,
    };
  });

  /** The largest notable events get a label on the trace; the log lists the rest. */
  readonly markers = computed<readonly Marker[]>(() => {
    const rows = this.rows();
    const first = rows[0]?.start ?? 0;
    return this.quakes()
      .filter(isNotable)
      .sort((a, b) => (b.magnitude?.value ?? 0) - (a.magnitude?.value ?? 0))
      .slice(0, LABELLED)
      .filter((quake) => quake.time >= first)
      .map((quake) => {
        const magnitude = quake.magnitude!;
        const scale = magnitudeScale(magnitude.type);
        // Anchored where the burst ends, which can be on the next row.
        const end = quake.time + burstDuration(magnitude.value) - first;
        const row = Math.min(rows.length - 1, Math.floor(end / HOUR_MS));
        return {
          id: quake.id,
          left: Math.min(100, ((end - row * HOUR_MS) / HOUR_MS) * 100),
          top: ((row + 0.5) / rows.length) * 100,
          text: `M${magnitude.value.toFixed(1)}`,
          label: `M${magnitude.value.toFixed(1)} ${scale.code}, ${quake.place ?? 'unknown location'}`,
        };
      });
  });

  readonly hourLabels = computed(() =>
    this.rows().map((row, index, rows) => ({
      start: row.start,
      text: new Date(row.start).toISOString().slice(11, 13),
      current: index === rows.length - 1,
    })),
  );
}
