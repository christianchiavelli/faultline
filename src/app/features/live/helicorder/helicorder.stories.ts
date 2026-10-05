import type { Meta, StoryObj } from '@storybook/angular';
import { withRouter } from '@core/testing/stories';
import { RECORDED_AT, RECORDED_DAY } from '@shared/testing/recorded-day';
import { expect } from 'storybook/test';
import { Helicorder } from './helicorder';

/** The last 24 hours the way a drum seismograph draws them: one line per hour, one burst per event. */
const meta: Meta<Helicorder> = {
  title: 'Live/Helicorder',
  component: Helicorder,
  decorators: [withRouter],
  args: { quakes: RECORDED_DAY, now: RECORDED_AT },
  argTypes: { quakes: { control: false }, now: { control: 'date' } },
};

export default meta;
type Story = StoryObj<Helicorder>;

/** A real day off the USGS, read the way a drum seismograph draws it: one line per hour, one burst per event. */
export const ADay: Story = {};

/** Before the feed arrives the drum still draws its paper, so the page around it is laid out as it will be. */
export const WaitingForTheFeed: Story = { args: { quakes: null } };

/** The trace is a slider over the day's events, and the arrow keys, Home and End step through them. */
export const ReadingAnEvent: Story = {
  play: async ({ canvas, userEvent }) => {
    const slider = canvas.getByRole('slider', { name: 'Events on the trace' });
    slider.focus();
    await userEvent.keyboard('{End}');
    await expect(slider).toHaveAttribute('aria-valuenow', slider.getAttribute('aria-valuemax'));
  },
};
