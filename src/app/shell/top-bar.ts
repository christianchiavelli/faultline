import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Clock } from '@core/clock';
import { Wordmark } from '@ui/wordmark';
import { Languages } from './languages';
import { ThemeMenu } from './theme-menu';

@Component({
  selector: 'fl-top-bar',
  imports: [RouterLink, DatePipe, Wordmark, Languages, ThemeMenu],
  template: `
    <header class="bar page">
      <a
        class="home"
        routerLink="/"
        aria-label="Faultline, live seismograph"
        i18n-aria-label="accessible name of the wordmark, a link to the home page"
      >
        <ui-wordmark />
      </a>
      <span class="tagline" i18n="the site's tagline, beside its wordmark"
        >A live seismograph of the planet</span
      >

      <div class="instruments">
        <time class="clock mono" [attr.datetime]="iso()">
          <span class="clock__zone">UTC</span> {{ clock.now() | date: 'HH:mm:ss' : 'UTC' }}
        </time>
        <fl-languages />
        <fl-theme-menu />
      </div>
    </header>
  `,
  styleUrl: './top-bar.css',
})
export class TopBar {
  protected readonly clock = inject(Clock);

  protected readonly iso = computed(() => new Date(this.clock.now()).toISOString());
}
