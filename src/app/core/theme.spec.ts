import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Theme } from './theme';

describe('Theme', () => {
  beforeEach(() => {
    // As `index.html` has them.
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" content="#f5f1e8" media="(prefers-color-scheme: light)">' +
        '<meta name="theme-color" content="#0f0d0a" media="(prefers-color-scheme: dark)">',
    );
  });

  afterEach(() => {
    document.cookie = 'fl-theme=; Path=/; Max-Age=0';
    document.documentElement.removeAttribute('data-theme');
    document.head.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.remove());
  });

  const barColours = () =>
    [...document.head.querySelectorAll('meta[name="theme-color"]')].map((meta) =>
      meta.getAttribute('content'),
    );

  it('follows the system until the reader picks a theme', () => {
    const theme = TestBed.inject(Theme);

    expect(theme.preference()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('restores the theme from its cookie, which the server reads too', () => {
    document.cookie = 'other=1; Path=/';
    document.cookie = 'fl-theme=film; Path=/';

    expect(TestBed.inject(Theme).preference()).toBe('film');
    expect(TestBed.inject(DOCUMENT).documentElement.getAttribute('data-theme')).toBe('film');
  });

  it('ignores a cookie value it does not know', () => {
    document.cookie = 'fl-theme=neon; Path=/';

    expect(TestBed.inject(Theme).preference()).toBe('system');
  });

  it('paints a choice at once and remembers it, and System hands back to the device', () => {
    const theme = TestBed.inject(Theme);

    theme.set('film');
    expect(theme.preference()).toBe('film');
    expect(document.documentElement.getAttribute('data-theme')).toBe('film');
    expect(document.cookie).toContain('fl-theme=film');

    theme.set('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it("colours the browser's bar in the theme picked, whatever the device asks for", () => {
    const theme = TestBed.inject(Theme);
    expect(barColours()).toEqual(['#f5f1e8', '#0f0d0a']);

    theme.set('film');
    expect(barColours()).toEqual(['#0f0d0a', '#0f0d0a']);

    theme.set('paper');
    expect(barColours()).toEqual(['#f5f1e8', '#f5f1e8']);

    theme.set('system');
    expect(barColours()).toEqual(['#f5f1e8', '#0f0d0a']);
  });
});
