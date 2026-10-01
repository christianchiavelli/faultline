import { afterNextRender, computed, effect, signal, type Signal } from '@angular/core';

/**
 * The class for `animate.enter` on content that depends on `value`: `arrival`
 * once the browser has had to wait for the value, nothing until then.
 *
 * Angular plays enter animations while it hydrates as well, and what the
 * server drew is already on the screen by then: fading it in again would
 * blank the page for a moment, just after it first appeared. Content the
 * browser waited for comes in the way anything present does (`motion.css`).
 *
 * Call it in an injection context, such as a field initialiser.
 */
export function arrival(value: () => unknown): Signal<string> {
  const rendered = signal(false);
  const waited = signal(false);
  afterNextRender(() => rendered.set(true));
  effect(() => {
    if (rendered() && value() == null) waited.set(true);
  });
  return computed(() => (waited() ? 'arrival' : ''));
}
