import { Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';
import { Theme, type ThemePreference } from '@core/theme';
import { Icon } from '@ui/icon';
import { Popover } from '@ui/popover';

type Scheme = 'paper' | 'film';

interface Choice {
  readonly value: ThemePreference;
  readonly name: string;
  /** What its preview shows, left to right: System is half of each. */
  readonly halves: readonly {
    readonly scheme: Scheme;
    readonly x: number;
    readonly width: number;
  }[];
}

const NAMES: Readonly<Record<ThemePreference, string>> = {
  paper: $localize`:name of the light theme, a record on paper:Paper`,
  film: $localize`:name of the dark theme, a record on photographic film:Film`,
  system: $localize`:name of the theme that follows the device's own setting:System`,
};

const CHOICES: readonly Choice[] = [
  { value: 'paper', name: NAMES.paper, halves: [{ scheme: 'paper', x: 0, width: 36 }] },
  { value: 'film', name: NAMES.film, halves: [{ scheme: 'film', x: 0, width: 36 }] },
  {
    value: 'system',
    name: NAMES.system,
    halves: [
      { scheme: 'paper', x: 0, width: 18 },
      { scheme: 'film', x: 18, width: 18 },
    ],
  },
];

let nextId = 0;

/**
 * The theme, picked from a small menu in the bar. Each choice shows a scrap of
 * the drum record in its own colours, and System says which of the two the
 * device asks for now. A choice takes at once, and closes the menu.
 */
@Component({
  selector: 'fl-theme-menu',
  imports: [Icon, Popover],
  template: `
    <ui-popover #menu heading="Theme" i18n-heading="heading of the theme menu" [label]="label()">
      <span uiPopoverTrigger class="swatch" aria-hidden="true"></span>
      <ul class="choices" role="list">
        @for (choice of choices; track choice.value) {
          <li>
            <button
              type="button"
              class="choice"
              [attr.aria-pressed]="theme.preference() === choice.value"
              [attr.aria-describedby]="choice.value === 'system' ? hintId : null"
              (click)="theme.set(choice.value); menu.close()"
            >
              <svg class="preview" viewBox="0 0 36 24" aria-hidden="true" focusable="false">
                @for (half of choice.halves; track half.scheme) {
                  <svg
                    [class]="'scheme scheme--' + half.scheme"
                    [attr.x]="half.x"
                    [attr.width]="half.width"
                    height="24"
                    [attr.viewBox]="half.x + ' 0 ' + half.width + ' 24'"
                  >
                    <rect class="record" width="36" height="24" />
                    <path class="trace" d="M3 6H33M3 12H13M23 12H33M3 18H24M28 18H33" />
                    <path
                      class="burst"
                      d="M13 12L14 10L15 14.5L16 7.5L17 16.5L18 9L19 14L20 11L21 12H23"
                    />
                    <path class="trace" d="M24 18L25 16.5L26 19.5L27 17L28 18" />
                  </svg>
                }
              </svg>
              <span class="choice__text">
                <span class="choice__name">{{ choice.name }}</span>
                @if (choice.value === 'system') {
                  <!-- Its description, not part of its name: the choice is called System. -->
                  <span class="choice__hint" aria-hidden="true" [id]="hintId">{{ hint() }}</span>
                }
              </span>
              <ui-icon class="choice__tick" name="check" />
            </button>
          </li>
        }
      </ul>
    </ui-popover>
  `,
  styleUrl: './theme-menu.css',
})
export class ThemeMenu {
  protected readonly theme = inject(Theme);
  protected readonly choices = CHOICES;
  protected readonly label = computed(
    () =>
      $localize`:accessible name of the theme menu's button, with the theme in use:Theme: ${NAMES[this.theme.preference()]}:theme:`,
  );
  protected readonly hintId = `theme-menu-${nextId++}-system`;
  /** Which theme the device asks for: known only in the browser. */
  protected readonly device = signal<string | null>(null);
  protected readonly hint = computed(() => {
    const device = this.device();
    return device
      ? $localize`:what the System theme does, and the theme it gives now:Follows your device: ${device}:theme: now`
      : $localize`:what the System theme does, before the device is known:Follows your device`;
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const query = matchMedia('(prefers-color-scheme: dark)');
      const read = () => this.device.set(NAMES[query.matches ? 'film' : 'paper']);
      read();
      query.addEventListener('change', read);
      destroyRef.onDestroy(() => query.removeEventListener('change', read));
    });
  }
}
