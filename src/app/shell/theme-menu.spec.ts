import { TestBed } from '@angular/core/testing';
import { Theme } from '@core/theme';
import { isOpen, polyfillPopover } from '@ui/testing/popover-polyfill';
import { ThemeMenu } from './theme-menu';

/** A device that asks for the dark theme, or the light one. */
function prefersDark(dark: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

async function render() {
  polyfillPopover();
  const fixture = TestBed.createComponent(ThemeMenu);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    trigger: element.querySelector('button.trigger')!,
    panel: element.querySelector<HTMLElement>('[popover]')!,
    choices: [...element.querySelectorAll<HTMLButtonElement>('.choice')],
  };
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

describe('ThemeMenu', () => {
  beforeEach(() => prefersDark(false));

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = 'fl-theme=; Path=/; Max-Age=0';
    document.documentElement.removeAttribute('data-theme');
  });

  it('names its button after the theme in use, and marks it among the choices', async () => {
    const { trigger, choices } = await render();

    expect(trigger.getAttribute('aria-label')).toBe('Theme: System');
    expect(
      choices.map((choice) => [text(choice.querySelector('.choice__name')), choice.ariaPressed]),
    ).toEqual([
      ['Paper', 'false'],
      ['Film', 'false'],
      ['System', 'true'],
    ]);
  });

  it('paints a choice at once, and closes behind it', async () => {
    const { fixture, trigger, panel, choices } = await render();
    panel.showPopover();

    choices[1]!.click();
    await fixture.whenStable();

    expect(TestBed.inject(Theme).preference()).toBe('film');
    expect(document.documentElement.getAttribute('data-theme')).toBe('film');
    expect(isOpen(panel)).toBe(false);
    expect(trigger.getAttribute('aria-label')).toBe('Theme: Film');
  });

  it('says which theme System follows on this device, as its description', async () => {
    prefersDark(true);
    const { choices } = await render();
    const system = choices[2]!;
    const hint = system.querySelector('.choice__hint')!;

    expect(text(hint)).toBe('Follows your device: Film now');
    // Described by it, and named by its name alone.
    expect(system.getAttribute('aria-describedby')).toBe(hint.id);
    expect(hint.getAttribute('aria-hidden')).toBe('true');
  });
});
