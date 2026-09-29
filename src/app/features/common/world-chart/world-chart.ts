import { Component, computed, input } from '@angular/core';
import { MAP_HEIGHT, MAP_WIDTH, toMap } from '@shared/geo/equal-earth';
import { isNotable, type QuakeSummary } from '@shared/domain/quake';

/**
 * Dot radius in map units. Grows ~1.6x per magnitude step, so area grows ~2.6x:
 * compressed like the helicorder, and for the same reason.
 */
export function dotRadius(magnitude: number | null): number {
  return Math.min(24, Math.max(1.3, 0.9 * 1.62 ** (magnitude ?? 0)));
}

const LEGEND = [3, 5, 7] as const;

interface Frame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

@Component({
  selector: 'fl-world-chart',
  templateUrl: './world-chart.html',
  styleUrl: './world-chart.css',
})
export class WorldChart {
  readonly quakes = input.required<readonly QuakeSummary[]>();
  /** An event to ring, e.g. the one a detail page is about. */
  readonly focus = input<string | null>(null);
  /** Magnification around the focused event. 1 is the whole world. */
  readonly zoom = input(1);
  readonly showLegend = input(true);

  readonly legend = LEGEND.map((magnitude) => ({ magnitude, r: dotRadius(magnitude) }));

  /** Largest first, so the small dots are drawn last and stay visible on top. */
  readonly dots = computed(() =>
    this.quakes()
      .map((quake) => {
        const { x, y } = toMap(quake.location.longitude, quake.location.latitude);
        return {
          id: quake.id,
          x: round(x),
          y: round(y),
          r: dotRadius(quake.magnitude?.value ?? null),
          notable: isNotable(quake),
          focused: quake.id === this.focus(),
        };
      })
      .sort((a, b) => b.r - a.r),
  );

  readonly focused = computed(() => this.dots().find((dot) => dot.focused) ?? null);

  /** The visible window, kept inside the map so a polar event does not show empty space. */
  readonly frame = computed<Frame>(() => {
    const zoom = Math.max(1, this.zoom());
    const focus = this.focused();
    if (zoom === 1 || !focus) return { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT };
    const width = MAP_WIDTH / zoom;
    const height = MAP_HEIGHT / zoom;
    return {
      x: round(clamp(focus.x - width / 2, 0, MAP_WIDTH - width)),
      y: round(clamp(focus.y - height / 2, 0, MAP_HEIGHT - height)),
      width: round(width),
      height: round(height),
    };
  });

  readonly viewBox = computed(() => {
    const { x, y, width, height } = this.frame();
    return `${x} ${y} ${width} ${height}`;
  });

  /** Dots keep their on-screen size when the map is magnified. */
  readonly dotScale = computed(() => this.frame().width / MAP_WIDTH);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
