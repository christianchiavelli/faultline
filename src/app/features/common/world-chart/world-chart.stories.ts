import type { Meta, StoryObj } from '@storybook/angular';
import { RECORDED_DAY, RECORDED_LARGEST } from '@shared/testing/recorded-day';
import { WorldChart } from './world-chart';

/** Events on an Equal Earth map over the plate boundaries, each dot sized by its magnitude. */
const meta: Meta<WorldChart> = {
  title: 'Common/World chart',
  component: WorldChart,
  args: { quakes: RECORDED_DAY, focus: null, zoom: 1, showLegend: true },
  argTypes: { quakes: { control: false }, zoom: { control: { type: 'range', min: 1, max: 6 } } },
};

export default meta;
type Story = StoryObj<WorldChart>;

/** The day's events on an Equal Earth map, over the plate boundaries, each dot sized by magnitude. */
export const ADay: Story = {};

/** One event in focus, as on its own page: the rest of the day stays behind it. */
export const OneEventInFocus: Story = { args: { focus: RECORDED_LARGEST, zoom: 3 } };
