import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '@core/clock';
import { Theme, type ThemePreference } from '@core/theme';
import { Wordmark } from '@ui/wordmark';

const THEME_LABEL: Record<ThemePreference, string> = {
  system: 'Auto',
  paper: 'Paper',
  film: 'Film',
};

@Component({
  selector: 'fl-top-bar',
  imports: [RouterLink, DatePipe, Wordmark],
  template: `
    <div class="bar page">
      <a class="home" routerLink="/" aria-label="Faultline, live seismograph">
        <ui-wordmark />
      </a>
      <span class="tagline">A live seismograph of the planet</span>

      <div class="instruments">
        <time class="clock mono" [attr.datetime]="iso()">
          <span class="clock__zone">UTC</span> {{ clock.now() | date: 'HH:mm:ss' : 'UTC' }}
        </time>
        <button
          type="button"
          class="theme"
          (click)="theme.set(theme.next())"
          [attr.aria-label]="'Theme: ' + label() + '. Switch to ' + nextLabel()"
        >
          <span class="theme__swatch" aria-hidden="true"></span>
          {{ label() }}
        </button>
      </div>
    </div>
  `,
  styleUrl: './top-bar.css',
})
export class TopBar {
  protected readonly clock = inject(Clock);
  protected readonly theme = inject(Theme);

  protected readonly iso = computed(() => new Date(this.clock.now()).toISOString());
  protected readonly label = computed(() => THEME_LABEL[this.theme.preference()]);
  protected readonly nextLabel = computed(() => THEME_LABEL[this.theme.next()]);
}
