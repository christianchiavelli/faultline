/**
 * jsdom has no `showModal` or `close`. This is enough of them to test what a
 * dialog shows and when it closes; focus and inertness are the browser's, and
 * the end-to-end suite checks them in one.
 */
export function polyfillDialog(): void {
  const prototype = HTMLDialogElement.prototype;
  if (typeof prototype.showModal === 'function') return;

  Object.defineProperty(prototype, 'open', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute('open');
    },
  });
  prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
