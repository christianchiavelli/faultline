import { DatePipe, DecimalPipe, formatDate } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  LOCALE_ID,
  RESPONSE_INIT,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { quakeDetailResource } from '@core/api/quakes';
import { Clock } from '@core/clock';
import { describePage } from '@core/page-description';
import { pageTitle } from '@core/page-title';
import { alertLevelName, alertMeaning, kindName, placeName, reviewTag } from '@core/words/domain';
import { describeMagnitude } from '@core/words/magnitude';
import { radiatedEnergy } from '@shared/domain/magnitude';
import { networkName } from '@shared/domain/network';
import { isNotable, type QuakeSummary } from '@shared/domain/quake';
import { AgoPipe } from '@ui/ago.pipe';
import { arrival } from '@ui/arrival';
import { DATES } from '@ui/dates';
import { formatDuration } from '@ui/duration';
import { Icon } from '@ui/icon';
import { formatDecimal } from '@ui/numbers';
import { Skeleton } from '@ui/skeleton';
import { WorldChart } from '../common/world-chart/world-chart';
import { ExportButton } from '../export/export-button';

/** Above this the epicentre is poorly constrained: stations only see it from one side. */
const WIDE_GAP_DEG = 180;

/** The catalogue never had the event, or has deleted it. */
const GONE = new Set([404, 410]);

/** Joules in one tonne of TNT, the unit outreach material uses for seismic energy. */
const TNT_TONNE_J = 4.184e9;

/** The readouts' labels, the same over the event's values and over the lines waiting for them. */
const READOUTS = {
  depth: $localize`:readout label|how deep the event was:Depth`,
  epicentre: $localize`:readout label|the point on the surface above where the rupture began:Epicentre`,
  solution: $localize`:readout label|how many stations located the event, and how well:Solution`,
  energy: $localize`:readout label|the energy the event radiated:Energy`,
} as const;

/** The waiting readouts, with the epicentre's value set smaller like the real one. */
const WAITING_READOUTS = [
  { label: READOUTS.depth, small: false },
  { label: READOUTS.epicentre, small: true },
  { label: READOUTS.solution, small: false },
  { label: READOUTS.energy, small: false },
] as const;

/** The record's facts' labels, the same over its values and while they are on their way. */
const FACTS = {
  network: $localize`:label of a fact of an event's record|the network that located it:Located by`,
  revised: $localize`:label of a fact of an event's record|when the USGS last changed it:Last revised`,
  felt: $localize`:label of a fact of an event's record|how many people reported feeling it:Felt reports`,
  alert: $localize`:label of a fact of an event's record|the PAGER alert of its likely impact:Impact alert`,
} as const;

@Component({
  selector: 'fl-quake-page',
  imports: [RouterLink, DatePipe, DecimalPipe, AgoPipe, Icon, Skeleton, WorldChart, ExportButton],
  templateUrl: './quake-page.html',
  styleUrl: './quake-page.css',
})
export class QuakePage {
  /** Route parameter, bound by the router. */
  readonly id = input.required<string>();
  /** What the link here knew of the event (`quake-link.ts`), bound by the router. */
  readonly known = input<QuakeSummary | null>(null);

  protected readonly now = inject(Clock).now;
  readonly #locale = inject(LOCALE_ID);
  protected readonly detail = quakeDetailResource(() => this.id());

  protected readonly data = computed(() => (this.detail.hasValue() ? this.detail.value() : null));
  /** The event as far as the page knows it: the catalogue's record, or what the link knew until it comes. */
  protected readonly quake = computed(() => this.data()?.quake ?? this.known());
  /** Fades in only what the page waited for: opened on the link's summary, its hero is just there. */
  protected readonly arriving = arrival(this.quake);
  /** The same for what only the catalogue's record holds, which such a page still waits for. */
  protected readonly recordArriving = arrival(this.data);
  protected readonly readouts = READOUTS;
  protected readonly waitingReadouts = WAITING_READOUTS;
  protected readonly facts = FACTS;
  protected readonly waitingFacts = Object.values(FACTS);
  protected readonly dates = DATES;

  /** The status the record failed with, 0 when nothing answered at all, `null` while none has. */
  readonly #failedWith = computed(() => {
    const error = this.detail.error();
    return error instanceof HttpErrorResponse ? error.status : null;
  });

  /**
   * What went wrong, in the reader's language, by status alone: the API words
   * its problems in English, for whoever calls it, and a proxy or a dropped
   * connection words them not at all.
   */
  protected readonly failure = computed(() => {
    const status = this.#failedWith();
    return status === null ? null : { status, ...describeFailure(status, this.id()) };
  });

  /**
   * The catalogue has no such event, or no longer: whatever the link knew of
   * it went with it. Any other failure leaves what the link knew standing.
   */
  readonly #gone = computed(() => GONE.has(this.#failedWith() ?? 0));

  /** The record is still on its way: its lines wait in their places. */
  protected readonly pending = computed(() => !this.data() && this.#failedWith() === null);

  /** What the event was: everything the page opens on. */
  protected readonly view = computed(() => {
    const quake = this.quake();
    if (!quake || this.#gone()) return null;
    const locale = this.#locale;
    const depth = quake.location.depthKm;
    const { latitude, longitude } = quake.location;

    return {
      quake,
      place: placeName(quake.place),
      kind: kindName(quake.kind),
      review: reviewTag(quake.review),
      magnitude: describeMagnitude(quake.magnitude, locale),
      notable: isNotable(quake),
      // A decimal comma hangs below the digits, where a point sits on their line.
      decimalComma: formatDecimal(0.5, locale, '1.1-1').includes(','),
      energy: quake.magnitude
        ? describeEnergy(radiatedEnergy(quake.magnitude.value), locale)
        : null,
      depthKm: depth === null ? null : Math.abs(depth),
      depthAboveSea: depth !== null && depth < 0,
      epicentre: {
        latitude: formatDecimal(latitude, locale, '1.3-3'),
        longitude: formatDecimal(longitude, locale, '1.3-3'),
      },
    };
  });

  /** What only the catalogue's record says: how well the event is located, by whom, and what it did. */
  protected readonly record = computed(() => {
    const data = this.data();
    if (!data) return null;
    const { quake, origin } = data;

    return {
      quake,
      origin,
      network: { code: quake.network, name: networkName(quake.network) },
      alert: quake.alert
        ? {
            level: quake.alert,
            name: alertLevelName(quake.alert),
            meaning: alertMeaning(quake.alert),
          }
        : null,
      depthErrorKm: origin?.depthErrorKm ?? null,
      depthFixed: origin?.depthType === 'operator assigned',
      wideGap: (origin?.azimuthalGapDeg ?? 0) > WIDE_GAP_DEG,
      revisedAfter: formatDuration(quake.updated - quake.time, this.#locale),
    };
  });

  /** The event in a few words, for its tab and its search result: "M6.2 South of the Fiji Islands". */
  readonly #name = computed(() => {
    const view = this.view();
    if (!view) return null;
    return view.magnitude ? `M${view.magnitude.value} ${view.place}` : view.place;
  });

  constructor() {
    const title = inject(Title);
    const response = inject(RESPONSE_INIT, { optional: true });

    describePage(() => {
      const name = this.#name();
      const quake = this.quake();
      if (!name || !quake) return null;
      const when = formatDate(quake.time, DATES.dateAtTime, this.#locale, 'UTC');
      return $localize`:meta description of an event's page, shown under it in search results:${name}:event:, ${when}:date: UTC: its epicentre and depth, how well they are known, and the energy it radiated, from the USGS catalogue.`;
    });

    effect(() => {
      const name = this.#name();
      const status = this.#failedWith();
      if (name) {
        title.setTitle(pageTitle(name));
      } else if (status !== null) {
        title.setTitle(pageTitle(failurePageName(status)));
      }
      // Server-rendered error pages carry the real status, so crawlers and
      // monitors see a 404 for a missing event rather than a 200 page.
      if (status && response) response.status = status;
    });
  }
}

/** Scientific notation for the value, TNT for the intuition: 7.9 × 10¹² J is about 1,900 t. */
function describeEnergy(joules: number, locale: string) {
  const exponent = Math.floor(Math.log10(joules));
  const tonnes = joules / TNT_TONNE_J;
  const significant = (value: number) => Number(value.toPrecision(2));
  return {
    mantissa: formatDecimal(joules / 10 ** exponent, locale, '1.1-1'),
    exponent,
    tnt:
      tonnes >= 1
        ? { value: significant(tonnes), unit: 'tonnes' as const }
        : { value: significant(tonnes * 1000), unit: 'kg' as const },
  };
}

/**
 * The page's own words for a failure, by status: the same as the API's in
 * English, for every status it sends. Any other is a fault of the server's.
 */
function describeFailure(status: number, id: string): { title: string; detail: string | null } {
  switch (status) {
    case 404:
      return {
        title: $localize`:heading of the page of an event the catalogue does not have:No such event`,
        detail: $localize`:what the page of an event the catalogue does not have says:The USGS catalogue has no event with id ${id}:id:.`,
      };
    case 410:
      return {
        title: $localize`:heading of the page of an event the catalogue deleted:This event was deleted`,
        detail: $localize`:what the page of a deleted event says:The USGS removed it from the catalogue, usually because it was a false detection or a duplicate.`,
      };
    case 429:
      return {
        title: $localize`:heading of an event's page when the reader has asked for too much too fast:Too many requests from you right now`,
        detail: $localize`:what an event's page says when the reader has asked for too much too fast:This server answers each reader at a steady pace. Try again in a few seconds.`,
      };
    case 502:
      return {
        title: $localize`:heading of an event's page when the USGS did not answer:The USGS did not answer`,
        detail: $localize`:what an event's page says when the USGS did not answer:Try again in a minute; the USGS usually recovers on its own.`,
      };
    case 503:
      return {
        title: $localize`:heading of an event's page when the server is pacing its requests:Too many lookups right now`,
        detail: $localize`:what an event's page says when the server is pacing its requests:This server is pacing its requests to the USGS. Try again in a few seconds.`,
      };
    case 0:
      return {
        title: $localize`:heading of an event's page when no answer came at all:This server did not answer`,
        detail: $localize`:what an event's page says when no answer came at all:Check your connection, then try again.`,
      };
    default:
      return {
        title: $localize`:heading of an event's page after a fault of the server's own:Something went wrong on our side`,
        detail: null,
      };
  }
}

/** The heading says what happened; the tab only names the page, plainly. */
function failurePageName(status: number): string {
  if (status === 404)
    return $localize`:tab title of the page of an event that does not exist:Event not found`;
  if (status === 410) return $localize`:tab title of the page of a deleted event:Event deleted`;
  return $localize`:tab title of an event's page that could not load:Event unavailable`;
}
