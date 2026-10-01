import { Component, input } from '@angular/core';

/**
 * A line of text still on its way. Put where the text will be, inside the
 * element that will hold it, it is one line of that element's text tall, so
 * the page around it is laid out as it will be once the text comes.
 *
 * It shows only once the wait is long enough to see, so an answer that comes
 * quicker flashes nothing, and then breathes at the pen's pace. Screen readers
 * skip it: the page says in words what it is waiting for.
 */
@Component({
  selector: 'ui-skeleton',
  template: '',
  styleUrl: './skeleton.css',
  host: { 'aria-hidden': 'true', '[style.width]': 'width()' },
})
export class Skeleton {
  /** How much of the line the text will take: a share, or a length such as `9rem` or `3ch`. */
  readonly width = input('100%');
}
