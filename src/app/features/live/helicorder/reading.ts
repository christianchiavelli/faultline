/**
 * Reading an event off the trace. The trace is one path per hour, so nothing
 * on it is an event to point at: a point is matched to the nearest burst
 * instead, anywhere along its length, since a large one shakes for minutes
 * after its origin. Most small events draw no visible burst at all, and this
 * is how a reader finds them.
 */
import { depthPhrase, kindName, placeName } from '@core/words/domain';
import { describeScale } from '@core/words/magnitude';
import { isEarthquake, type QuakeSummary } from '@shared/domain/quake';
import { formatDecimal } from '@ui/numbers';
import { HOUR_MS, burstDuration, type TraceEvent } from './trace';

/** Where an event sits on the drum: its origin, and every line its burst runs along. */
export interface Placed {
  readonly id: string;
  /** Line of the origin, 0 at the top. */
  readonly row: number;
  /** The origin along its line, 0 to 1. */
  readonly at: number;
  readonly spans: readonly Span[];
}

interface Span {
  readonly row: number;
  readonly from: number;
  readonly to: number;
}

/** The events drawn on the drum, oldest first: the order a reader steps through them. */
export function place(
  events: readonly TraceEvent[],
  first: number,
  now: number,
  hours: number,
): readonly Placed[] {
  return events
    .filter((event) => event.time >= first && event.time <= now)
    .sort((a, b) => a.time - b.time)
    .map((event) => {
      const row = Math.floor((event.time - first) / HOUR_MS);
      const end = Math.min(
        now,
        first + hours * HOUR_MS,
        event.time + burstDuration(event.magnitude ?? 0),
      );
      const spans: Span[] = [];
      let start = event.time;
      // A burst that outlasts its hour carries on at the start of the next line.
      for (let line = row; ; line++) {
        const stop = Math.min(end, first + (line + 1) * HOUR_MS);
        spans.push({ row: line, from: toLine(start, first, line), to: toLine(stop, first, line) });
        if (stop >= end) break;
        start = stop;
      }
      return { id: event.id, row, at: toLine(event.time, first, row), spans };
    });
}

function toLine(time: number, first: number, row: number): number {
  return (time - first) / HOUR_MS - row;
}

/** A point on the paper, and how far from a burst it may be and still mean it. */
export interface Probe {
  /** Across the paper, 0 to 1. */
  readonly x: number;
  /** Down the paper, 0 to 1. */
  readonly y: number;
  /** The paper in CSS pixels, so distances are measured the way the reader sees them. */
  readonly width: number;
  readonly height: number;
  /** In CSS pixels: wider for a finger than for a mouse. */
  readonly reach: number;
}

export function eventAt(placed: readonly Placed[], probe: Probe, hours: number): string | null {
  const line = probe.height / hours;
  const px = probe.x * probe.width;
  const py = probe.y * probe.height;
  let best: { id: string; distance: number; fromOrigin: number } | null = null;

  for (const event of placed) {
    for (const span of event.spans) {
      const dx = Math.max(0, span.from * probe.width - px, px - span.to * probe.width);
      const distance = Math.hypot(dx, py - (span.row + 0.5) * line);
      if (distance > probe.reach) continue;
      // Inside two bursts at once, the one that starts nearest the point is the one pointed at.
      const fromOrigin = Math.hypot(px - event.at * probe.width, py - (event.row + 0.5) * line);
      if (
        !best ||
        distance < best.distance ||
        (distance === best.distance && fromOrigin < best.fromOrigin)
      ) {
        best = { id: event.id, distance, fromOrigin };
      }
    }
  }
  return best?.id ?? null;
}

/** What the card says about an event, and the same as one sentence for a screen reader. */
export interface EventDescription {
  readonly magnitude: string | null;
  readonly scale: { readonly code: string; readonly title: string } | null;
  readonly place: string;
  readonly depth: { readonly km: string; readonly above: boolean } | null;
  readonly reviewed: boolean;
  /** Set only for what is not an earthquake, like a quarry blast. */
  readonly kind: string | null;
  readonly text: string;
}

/** `locale` sets its numbers: "M5.1, 10.0 km deep" in English, "M5,1, 10,0 km de profundidade" in Portuguese. */
export function describeEvent(quake: QuakeSummary, locale: string): EventDescription {
  const scale = quake.magnitude ? describeScale(quake.magnitude.type) : null;
  const magnitude = quake.magnitude ? formatDecimal(quake.magnitude.value, locale, '1.1-1') : null;
  const place = placeName(quake.place);
  const depthKm = quake.location.depthKm;
  const depth =
    depthKm === null
      ? null
      : { km: formatDecimal(Math.abs(depthKm), locale, '1.1-1'), above: depthKm < 0 };
  const kind = isEarthquake(quake) ? null : kindName(quake.kind);
  const reviewed = quake.review === 'reviewed';

  const text = [
    magnitude && scale
      ? `M${magnitude} ${scale.code}`
      : $localize`:read out for an event the USGS has not sized yet:No magnitude yet`,
    place,
    `${new Date(quake.time).toISOString().slice(11, 19)} UTC`,
    depthKm === null
      ? $localize`:read out for an event of unknown depth:depth unknown`
      : depthPhrase(depthKm, locale),
    kind,
    reviewed
      ? $localize`:review status of one event, read out after its other facts|checked by a seismologist:reviewed`
      : $localize`:review status of one event, read out after its other facts|not yet checked by a seismologist:automatic`,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    magnitude,
    scale: scale ? { code: scale.code, title: scale.title } : null,
    place,
    depth,
    reviewed,
    kind,
    text,
  };
}
