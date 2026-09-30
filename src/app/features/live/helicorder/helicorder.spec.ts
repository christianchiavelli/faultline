import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { QuakeSummary } from '@shared/domain/quake';
import { aQuake } from '@shared/testing/quake-fixture';
import { Helicorder } from './helicorder';

const NOW = Date.UTC(2026, 8, 29, 6, 30);
const HOUR = 3_600_000;

async function render(quakes: readonly QuakeSummary[]) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Helicorder);
  fixture.componentRef.setInput('quakes', quakes);
  fixture.componentRef.setInput('now', NOW);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

/**
 * Three hours ago is halfway along the fourth line from the bottom. On a
 * 1,200 × 480 paper, each line is 20 px, so its origin is at 600, 410.
 */
const small = aQuake({
  id: 'small',
  time: NOW - 3 * HOUR,
  magnitude: { value: 2.1, type: 'ml' },
  place: '12 km SSE of Ridgecrest, CA',
  review: 'automatic',
  location: { latitude: 35.5, longitude: -117.6, depthKm: 8.2 },
});

/** Reading needs a paper with a size, which jsdom does not lay out. */
function paperOf(element: HTMLElement): HTMLElement {
  const paper = element.querySelector<HTMLElement>('.paper')!;
  paper.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 1200, height: 480, right: 1200, bottom: 480 }) as DOMRect;
  return paper;
}

function point(element: Element, type: string, x: number, y: number, pointerType = 'mouse') {
  element.dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: y, pointerType, bubbles: true }),
  );
  TestBed.tick();
}

function press(element: Element, key: string) {
  element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  TestBed.tick();
}

const cardOf = (element: HTMLElement) => element.querySelector<HTMLElement>('.card');
const readerOf = (element: HTMLElement) => element.querySelector<HTMLElement>('[role="slider"]')!;

describe('Helicorder', () => {
  it('draws 24 hourly lines, labelled in UTC, with the current hour marked', async () => {
    const element = await render([]);
    const hours = [...element.querySelectorAll('.hours li')];

    expect(element.querySelectorAll('path.ink')).toHaveLength(24);
    expect(hours[0]?.textContent?.trim()).toBe('07');
    expect(hours.at(-1)?.textContent?.trim()).toBe('06');
    expect(hours.at(-1)?.classList).toContain('hours__current');
  });

  it('labels the largest notable events, linked to their pages', async () => {
    const element = await render([
      aQuake({ id: 'big', time: NOW - 3 * HOUR, magnitude: { value: 6.1, type: 'mww' } }),
      aQuake({ id: 'small', time: NOW - 2 * HOUR, magnitude: { value: 3.2, type: 'ml' } }),
    ]);
    const markers = [...element.querySelectorAll<HTMLAnchorElement>('a.marker')];

    expect(markers).toHaveLength(1);
    expect(markers[0]?.textContent?.trim()).toBe('M6.1');
    expect(markers[0]?.getAttribute('href')).toBe('/quakes/big');
    expect(markers[0]?.getAttribute('aria-label')).toBe('M6.1 Mww, South Sandwich Islands region');
  });

  it('draws notable events in the pen, and only those', async () => {
    const element = await render([
      aQuake({ id: 'big', time: NOW - 3 * HOUR, magnitude: { value: 5.1, type: 'mb' } }),
      aQuake({ id: 'small', time: NOW - 2 * HOUR, magnitude: { value: 2.2, type: 'md' } }),
      aQuake({
        id: 'blast',
        time: NOW - HOUR,
        magnitude: { value: 4.8, type: 'ml' },
        kind: 'explosion',
      }),
    ]);

    expect(element.querySelectorAll('path.pen')).toHaveLength(1);
  });

  it('keeps the pen at the present, halfway along the last line', async () => {
    const pen = (await render([])).querySelector<HTMLElement>('.pen-head')!;

    expect(pen.style.left).toBe('50%');
  });

  describe('reading', () => {
    it('names the event under the pointer, and lets it go when the pointer leaves', async () => {
      const element = await render([small]);
      const paper = paperOf(element);

      point(readerOf(element), 'pointermove', 603, 407);

      const card = cardOf(element)!;
      const text = (selector: string) =>
        card.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
      expect(text('.card__magnitude')).toBe('M2.1ML');
      expect(text('.card__time')).toBe('03:30:00 UTC');
      expect(text('.card__place')).toBe('12 km SSE of Ridgecrest, CA');
      expect(text('.card__meta')).toBe('8.2 km deepAutomatic');
      expect(card.getAttribute('aria-hidden')).toBe('true');
      expect(element.querySelectorAll('.hours li')[20]?.classList).toContain('hours__read');

      point(paper, 'pointerleave', 1300, 407);
      expect(cardOf(element)).toBeNull();
    });

    it('lets the card go as the pointer moves off every event', async () => {
      const element = await render([small]);
      paperOf(element);

      point(readerOf(element), 'pointermove', 600, 410);
      point(readerOf(element), 'pointermove', 900, 200);

      expect(cardOf(element)).toBeNull();
    });

    it('opens the event clicked, even one too small to draw', async () => {
      const element = await render([small]);
      paperOf(element);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      point(readerOf(element), 'pointerdown', 601, 410);
      readerOf(element).dispatchEvent(new MouseEvent('click', { clientX: 601, clientY: 410 }));

      expect(navigate).toHaveBeenCalledWith(['/quakes', 'small']);
    });

    it('reads a tapped event without leaving the page, until a tap elsewhere', async () => {
      const element = await render([small]);
      const paper = paperOf(element);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      // A finger lands a little off: its reach is longer than a mouse's.
      point(readerOf(element), 'pointerdown', 630, 410, 'touch');
      readerOf(element).dispatchEvent(new MouseEvent('click', { clientX: 630, clientY: 410 }));
      TestBed.tick();
      point(paper, 'pointerleave', 630, 410, 'touch');

      expect(navigate).not.toHaveBeenCalled();
      expect(cardOf(element)?.querySelector('a')?.getAttribute('href')).toBe('/quakes/small');
      // Out of the tab order: the keyboard opens the event from the slider instead.
      expect(cardOf(element)?.querySelector('a')?.getAttribute('tabindex')).toBe('-1');

      point(document.body, 'pointerdown', 10, 10, 'touch');
      expect(cardOf(element)).toBeNull();
    });

    it('closes with Escape wherever focus is, until the pointer moves off the event', async () => {
      const element = await render([small]);
      paperOf(element);
      point(readerOf(element), 'pointermove', 600, 410);

      press(document.body, 'Escape');
      expect(cardOf(element)).toBeNull();

      point(readerOf(element), 'pointermove', 602, 410);
      expect(cardOf(element)).toBeNull();

      point(readerOf(element), 'pointermove', 900, 200);
      point(readerOf(element), 'pointermove', 600, 410);
      expect(cardOf(element)).not.toBeNull();
    });

    it('is a slider over the events for the keyboard, and says which one it is on', async () => {
      const element = await render([
        aQuake({ id: 'first', time: NOW - 20 * HOUR, magnitude: { value: 4.6, type: 'mb' } }),
        small,
        aQuake({ id: 'latest', time: NOW - HOUR, magnitude: { value: 1.4, type: 'md' } }),
      ]);
      const reader = readerOf(element);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      expect(reader.getAttribute('aria-valuemin')).toBe('1');
      expect(reader.getAttribute('aria-valuemax')).toBe('3');
      expect(reader.getAttribute('aria-valuenow')).toBe('3');

      press(reader, 'ArrowLeft');
      expect(reader.getAttribute('aria-valuenow')).toBe('2');
      expect(reader.getAttribute('aria-valuetext')).toBe(
        'M2.1 ML, 12 km SSE of Ridgecrest, CA, 03:30:00 UTC, 8.2 km deep, automatic',
      );
      expect(cardOf(element)?.textContent).toContain('Other events');

      press(reader, 'Home');
      expect(reader.getAttribute('aria-valuenow')).toBe('1');
      expect(cardOf(element)?.classList).toContain('card--pen');

      press(reader, 'Escape');
      expect(cardOf(element)).toBeNull();
      expect(reader.getAttribute('aria-valuenow')).toBe('1');

      press(reader, 'End');
      press(reader, 'Enter');
      expect(navigate).toHaveBeenCalledWith(['/quakes', 'latest']);
    });

    it('offers nothing to read on a day without events', async () => {
      const element = await render([]);

      expect(element.querySelector('[role="slider"]')).toBeNull();
    });
  });
});
