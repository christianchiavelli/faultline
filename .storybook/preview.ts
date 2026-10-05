import '@angular/localize/init';
import { registerLocaleData } from '@angular/common';
import localeEnGb from '@angular/common/locales/en-GB';
import { LOCALE_ID } from '@angular/core';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import { applicationConfig, type Preview } from '@storybook/angular';
import '../src/styles/main.css';

// Stories are in the source language, British English, with its number and date formats.
registerLocaleData(localeEnGb);

const preview: Preview = {
  // A docs page for every component: its stories, their descriptions and its inputs.
  tags: ['autodocs'],
  decorators: [
    applicationConfig({ providers: [{ provide: LOCALE_ID, useValue: 'en-GB' }] }),
    // The attribute the app's own theme menu sets on `<html>`.
    withThemeByDataAttribute({
      themes: { Paper: 'paper', Film: 'film' },
      defaultTheme: 'Paper',
      attributeName: 'data-theme',
    }),
  ],
  parameters: {
    // An axe violation fails the story's test, in the Storybook UI and in CI alike.
    a11y: { test: 'error' },
    // The page colour comes from the theme, as it does in the app.
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
};

export default preview;
