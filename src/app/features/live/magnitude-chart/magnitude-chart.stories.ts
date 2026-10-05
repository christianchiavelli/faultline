import type { Meta, StoryObj } from '@storybook/angular';
import { RECORDED_DAY } from '@shared/testing/recorded-day';
import { MagnitudeChart } from './magnitude-chart';

/** The day's earthquakes by magnitude, against what the Gutenberg–Richter law expects of an average day. */
const meta: Meta<MagnitudeChart> = {
  title: 'Live/Magnitude chart',
  component: MagnitudeChart,
  args: { quakes: RECORDED_DAY },
  argTypes: { quakes: { control: false } },
};

export default meta;
type Story = StoryObj<MagnitudeChart>;

/** The day's earthquakes by size, against what an average day holds. */
export const ADay: Story = {};

/** Only the events of M4.5 and above, the size a catalogue counts as notable. */
export const NotableOnly: Story = {
  args: { quakes: RECORDED_DAY.filter((quake) => (quake.magnitude?.value ?? 0) >= 4.5) },
};
