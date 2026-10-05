/**
 * Stands in for `@angular/platform-browser/animations`. Storybook's Angular
 * renderer imports it only to warn about the animation modules in a story's
 * `moduleMetadata`, and in a try block, since an app may not have it. The
 * bundler resolves it all the same, and it needs `@angular/animations`, which
 * this app does not install: it animates with `animate.enter` and CSS.
 */
export {};
