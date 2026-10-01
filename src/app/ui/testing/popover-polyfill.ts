/**
 * jsdom has no popover API. This is enough of it to test what a popover shows
 * and when it closes; light dismiss, focus and anchoring are the browser's,
 * and the end-to-end suite checks them in one.
 */
export function polyfillPopover(): void {
  const prototype = HTMLElement.prototype;
  if (typeof prototype.hidePopover === 'function') return;

  prototype.showPopover = function (this: HTMLElement) {
    this.toggleAttribute('data-open', true);
  };
  prototype.hidePopover = function (this: HTMLElement) {
    this.removeAttribute('data-open');
  };
}

/** Whether a popover is showing, under the polyfill. */
export function isOpen(popover: Element): boolean {
  return popover.hasAttribute('data-open');
}
