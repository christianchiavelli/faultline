import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  LOCALE_ID,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { placeName, reviewTag } from '@core/words/domain';
import { magnitudeScale } from '@shared/domain/magnitude';
import { NOTABLE_MAGNITUDE, isNotable, type QuakeSummary } from '@shared/domain/quake';
import { formatDecimal } from '@ui/numbers';
import { quakeLinkState, type QuakeLinkState } from '../../quake/quake-link';
import { describeEvent, eventAt, place } from './reading';
import {
  HOUR_MS,
  ROW_HEIGHT,
  ROW_WIDTH,
  buildTrace,
  burstDuration,
  ruleTrace,
  type TraceEvent,
} from './trace';

const HOURS = 24;
const LABELLED = 6;
const FIVE_MINUTES = ROW_WIDTH / 12;

/** How far from a burst a point still means it, in CSS pixels. */
const REACH = { fine: 24, finger: 40 } as const;

interface Marker {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly text: string;
  readonly label: string;
  readonly link: QuakeLinkState;
}

/** What put the card up: a hovering pointer, a tap, or the arrow keys. */
type Source = 'pointer' | 'touch' | 'keyboard';

interface Selection {
  readonly id: string;
  readonly source: Source;
}

let nextId = 0;

@Component({
  selector: 'fl-helicorder',
  imports: [RouterLink, DatePipe],
  templateUrl: './helicorder.html',
  styleUrl: './helicorder.css',
  host: {
    '(document:keydown.escape)': 'dismiss()',
    '(document:pointerdown)': 'pressElsewhere($event)',
  },
})
export class Helicorder {
  /** The day's events, or `null` while they are on their way: the drum is drawn, the ink is not. */
  readonly quakes = input.required<readonly QuakeSummary[] | null>();
  readonly now = input.required<number>();

  readonly waiting = computed(() => this.quakes() === null);

  readonly #router = inject(Router);
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly #locale = inject(LOCALE_ID);
  private readonly paper = viewChild.required<ElementRef<HTMLElement>>('paper');

  /**
   * The trace is redrawn every five seconds, not every clock tick: at this
   * width five seconds is under two pixels, and each redraw recomputes the
   * current row's path.
   */
  readonly #drawnAt = computed(() => Math.floor(this.now() / 5_000) * 5_000);

  readonly #events = computed<readonly TraceEvent[]>(() =>
    (this.quakes() ?? []).map((quake) => ({
      id: quake.id,
      time: quake.time,
      magnitude: quake.magnitude?.value ?? null,
      highlighted: isNotable(quake),
    })),
  );

  readonly rows = computed(() =>
    this.waiting()
      ? ruleTrace(this.#drawnAt(), HOURS)
      : buildTrace(this.#events(), this.#drawnAt(), HOURS),
  );
  readonly viewBox = `0 0 ${ROW_WIDTH} ${HOURS * ROW_HEIGHT}`;
  readonly gridLines = Array.from({ length: 11 }, (_, i) => (i + 1) * FIVE_MINUTES);
  readonly quarterHour = FIVE_MINUTES * 3;
  /** The magnitude the pen turns red at, as the key names it. */
  readonly notable = formatDecimal(NOTABLE_MAGNITUDE, this.#locale, '1.1-1');
  readonly height = HOURS * ROW_HEIGHT;
  readonly line = 100 / HOURS;
  readonly hintId = `helicorder-keys-${nextId++}`;

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
    return (this.quakes() ?? [])
      .filter(isNotable)
      .sort((a, b) => (b.magnitude?.value ?? 0) - (a.magnitude?.value ?? 0))
      .slice(0, LABELLED)
      .filter((quake) => quake.time >= first)
      .map((quake) => {
        const magnitude = quake.magnitude!;
        const value = formatDecimal(magnitude.value, this.#locale, '1.1-1');
        // Anchored where the burst ends, which can be on the next row.
        const end = quake.time + burstDuration(magnitude.value) - first;
        const row = Math.min(rows.length - 1, Math.floor(end / HOUR_MS));
        return {
          id: quake.id,
          left: Math.min(100, ((end - row * HOUR_MS) / HOUR_MS) * 100),
          top: ((row + 0.5) / rows.length) * 100,
          text: `M${value}`,
          label: `M${value} ${magnitudeScale(magnitude.type).code}, ${placeName(quake.place)}`,
          link: quakeLinkState(quake),
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

  /** Every event on the drum, oldest first: what the arrow keys step through. */
  readonly placed = computed(() =>
    place(this.#events(), this.rows()[0]?.start ?? 0, this.#drawnAt(), HOURS),
  );

  readonly #selected = signal<Selection | null>(null, {
    equal: (a, b) => a?.id === b?.id && a?.source === b?.source,
  });
  /** Where the keyboard is, kept while the card is dismissed so the next key carries on from it. */
  readonly #cursor = signal<string | null>(null);
  /** A click does not say whether it was a tap, so the press before it does. */
  #pressedWith = 'mouse';
  /** Closed with Escape: stays closed until the pointer moves off the event. */
  #dismissed: string | null = null;

  /** The event being read, and where its card goes. */
  readonly reading = computed(() => {
    const selected = this.#selected();
    const placed = selected && this.placed().find((event) => event.id === selected.id);
    const quake = placed && this.quakes()?.find((candidate) => candidate.id === placed.id);
    if (!selected || !placed || !quake) return null;
    return {
      ...describeEvent(quake, this.#locale),
      review: reviewTag(quake.review),
      id: quake.id,
      time: quake.time,
      link: quakeLinkState(quake),
      source: selected.source,
      row: placed.row,
      at: placed.at * 100,
      top: placed.row * this.line,
      pen: isNotable(quake),
      // Near the top there is no room above the line, so the card hangs below it.
      below: placed.row < 3,
    };
  });

  /** The slider's position: the keyboard's event, or the latest before it has moved. */
  readonly position = computed(() => {
    const placed = this.placed();
    const index = placed.findIndex((event) => event.id === this.#cursor());
    return index < 0 ? placed.length - 1 : index;
  });

  readonly positionText = computed(() => {
    const id = this.placed()[this.position()]?.id;
    const quake = id && this.quakes()?.find((candidate) => candidate.id === id);
    return quake ? describeEvent(quake, this.#locale).text : null;
  });

  protected hover(event: PointerEvent): void {
    if (event.pointerType === 'touch') return;
    const id = this.#eventAt(event, REACH.fine);
    if (id && id === this.#dismissed) return;
    this.#dismissed = null;
    this.#show(id, 'pointer');
  }

  protected leave(event: PointerEvent): void {
    // A finger leaves as it lifts: the tap it made should stay up.
    if (event.pointerType === 'touch') return;
    this.#dismissed = null;
    if (this.#selected()?.source === 'pointer') this.#selected.set(null);
  }

  protected press(event: PointerEvent): void {
    this.#pressedWith = event.pointerType;
  }

  /** A click opens the event under the pointer. A tap only reads it, since a finger cannot hover. */
  protected open(event: MouseEvent): void {
    if (this.#pressedWith === 'touch') {
      this.#show(this.#eventAt(event, REACH.finger), 'touch');
      return;
    }
    const id = this.#eventAt(event, REACH.fine);
    if (id) this.#open(id);
  }

  protected readMarker(event: PointerEvent, id: string): void {
    if (event.pointerType === 'touch') return;
    this.#dismissed = null;
    this.#show(id, 'pointer');
  }

  protected focused(event: FocusEvent): void {
    // Focus from a click is on its way to a new page; only the keyboard reads here.
    if (!(event.target as HTMLElement).matches(':focus-visible')) return;
    this.#stepTo(this.position());
  }

  protected blurred(): void {
    if (this.#selected()?.source === 'keyboard') this.#selected.set(null);
  }

  /** The keys of a slider, as the ARIA pattern has them, plus Enter to open and Escape to close. */
  protected key(event: KeyboardEvent): void {
    const last = this.placed().length - 1;
    const steps: Partial<Record<string, number>> = {
      ArrowRight: this.position() + 1,
      ArrowUp: this.position() + 1,
      ArrowLeft: this.position() - 1,
      ArrowDown: this.position() - 1,
      Home: 0,
      End: last,
    };
    const to = steps[event.key];

    if (to !== undefined) this.#stepTo(Math.max(0, Math.min(last, to)));
    else if (event.key === 'Enter') this.#openCursor();
    else if (event.key === 'Escape') this.#selected.set(null);
    else return;
    event.preventDefault();
  }

  /** Escape closes the card wherever focus is, as content shown on hover must allow. */
  protected dismiss(): void {
    this.#dismissed = this.#selected()?.id ?? null;
    this.#selected.set(null);
  }

  protected pressElsewhere(event: PointerEvent): void {
    if (this.#selected()?.source !== 'touch') return;
    if (!this.paper().nativeElement.contains(event.target as Node)) this.#selected.set(null);
  }

  #stepTo(index: number): void {
    const id = this.placed()[index]?.id;
    if (!id) return;
    this.#cursor.set(id);
    this.#selected.set({ id, source: 'keyboard' });
  }

  #openCursor(): void {
    const id = this.placed()[this.position()]?.id;
    if (id) this.#open(id);
  }

  /** Opens the event's page on what the drum knows of it, as its links do (`quake-link.ts`). */
  #open(id: string): void {
    const quake = this.quakes()?.find((candidate) => candidate.id === id);
    void this.#router.navigate(['/quakes', id], {
      state: quake ? quakeLinkState(quake) : undefined,
      info: this.#host.nativeElement,
    });
  }

  #show(id: string | null, source: Source): void {
    this.#selected.set(id ? { id, source } : null);
  }

  #eventAt(event: MouseEvent, reach: number): string | null {
    const box = this.paper().nativeElement.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    return eventAt(
      this.placed(),
      {
        x: (event.clientX - box.left) / box.width,
        y: (event.clientY - box.top) / box.height,
        width: box.width,
        height: box.height,
        reach,
      },
      HOURS,
    );
  }
}
