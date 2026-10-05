import type { Meta, StoryObj } from '@storybook/angular';
import { withRecordedClock, withRouter } from '@core/testing/stories';
import { TopBar } from './top-bar';

/** The bar at the top of every page. */
const meta: Meta<TopBar> = {
  title: 'Shell/Top bar',
  component: TopBar,
  decorators: [withRouter, withRecordedClock],
  parameters: { layout: 'fullscreen' },
};

export default meta;

/** The wordmark, the UTC clock, the languages and the theme: discreet, at the top of every page. */
export const Default: StoryObj<TopBar> = {};
