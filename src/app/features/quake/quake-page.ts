import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, RESPONSE_INIT, computed, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { quakeDetailResource } from '@core/api/quakes';
import { Clock } from '@core/clock';
import { pageTitle } from '@core/page-title';
import type { Problem } from '@shared/api/contracts';
import { alertMeaning } from '@shared/domain/alert';
import { magnitudeScale, radiatedEnergy } from '@shared/domain/magnitude';
import { networkName } from '@shared/domain/network';
import { AgoPipe } from '@ui/ago.pipe';
import { capitalise } from '@ui/text';
import { WorldChart } from '../common/world-chart/world-chart';

/** Above this the epicentre is poorly constrained: stations only see it from one side. */
const WIDE_GAP_DEG = 180;

/** Joules in one tonne of TNT, the unit outreach material uses for seismic energy. */
const TNT_TONNE_J = 4.184e9;

@Component({
  selector: 'fl-quake-page',
  imports: [RouterLink, DatePipe, DecimalPipe, AgoPipe, WorldChart],
  templateUrl: './quake-page.html',
  styleUrl: './quake-page.css',
})
export class QuakePage {
  /** Route parameter, bound by the router. */
  readonly id = input.required<string>();

  protected readonly now = inject(Clock).now;
  protected readonly detail = quakeDetailResource(() => this.id());

  protected readonly data = computed(() => (this.detail.hasValue() ? this.detail.value() : null));

  protected readonly view = computed(() => {
    const data = this.data();
    if (!data) return null;
    const { quake, origin } = data;
    const scale = quake.magnitude ? magnitudeScale(quake.magnitude.type) : null;
    const depth = quake.location.depthKm;

    return {
      quake,
      origin,
      scale,
      place: quake.place ? capitalise(quake.place) : 'Location not described',
      network: { code: quake.network, name: networkName(quake.network) },
      alert: quake.alert ? { level: quake.alert, meaning: alertMeaning(quake.alert) } : null,
      magnitude: quake.magnitude?.value.toFixed(1) ?? null,
      energy: quake.magnitude ? describeEnergy(radiatedEnergy(quake.magnitude.value)) : null,
      depthKm: depth === null ? null : Math.abs(depth),
      depthErrorKm: origin?.depthErrorKm ?? null,
      depthAboveSea: depth !== null && depth < 0,
      depthFixed: origin?.depthType === 'operator assigned',
      wideGap: (origin?.azimuthalGapDeg ?? 0) > WIDE_GAP_DEG,
      revisedAfterMs: quake.updated - quake.time,
    };
  });

  protected readonly problem = computed<Problem | null>(() => {
    const error = this.detail.error();
    if (!(error instanceof HttpErrorResponse)) return null;
    return isProblem(error.error)
      ? error.error
      : { type: 'about:blank', title: 'The USGS did not answer', status: error.status };
  });

  constructor() {
    const title = inject(Title);
    const response = inject(RESPONSE_INIT, { optional: true });

    effect(() => {
      const view = this.view();
      const problem = this.problem();
      if (view) {
        const magnitude = view.magnitude ? `M${view.magnitude} ` : '';
        title.setTitle(pageTitle(`${magnitude}${view.place}`));
      } else if (problem) {
        title.setTitle(pageTitle(problemPageName(problem.status)));
        // Server-rendered error pages carry the real status, so crawlers and
        // monitors see a 404 for a missing event rather than a 200 page.
        if (response) response.status = problem.status;
      }
    });
  }
}

/** Scientific notation for the value, TNT for the intuition: 7.9 × 10¹² J is about 1,900 t. */
function describeEnergy(joules: number) {
  const exponent = Math.floor(Math.log10(joules));
  const tonnes = joules / TNT_TONNE_J;
  const significant = (value: number) => Number(value.toPrecision(2));
  return {
    mantissa: (joules / 10 ** exponent).toFixed(1),
    exponent,
    tnt:
      tonnes >= 1
        ? { value: significant(tonnes), unit: 'tonnes' }
        : { value: significant(tonnes * 1000), unit: 'kg' },
  };
}

/** The heading says what happened; the tab only names the page, plainly. */
function problemPageName(status: number): string {
  if (status === 404) return 'Event not found';
  if (status === 410) return 'Event deleted';
  return 'Event unavailable';
}

function isProblem(value: unknown): value is Problem {
  return typeof value === 'object' && value !== null && 'title' in value && 'status' in value;
}
