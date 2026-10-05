import type { Meta, StoryObj } from '@storybook/angular';
import { withRouter } from '@core/testing/stories';
import { RECORDED_AT, RECORDED_DAY } from '@shared/testing/recorded-day';
import { EventLog } from './event-log';
import { DEFAULT_LOG_QUERY, parseLogQuery } from './log-query';

/** Every event of the day, filtered, searched and sorted from the address, with each filter option counted. */
const meta: Meta<EventLog> = {
  title: 'Live/Event log',
  component: EventLog,
  decorators: [withRouter],
  args: { quakes: RECORDED_DAY, query: DEFAULT_LOG_QUERY, now: RECORDED_AT },
  argTypes: { quakes: { control: false }, query: { control: false }, now: { control: 'date' } },
};

export default meta;
type Story = StoryObj<EventLog>;

/** The day from M2.5, the newest first, each filter option counted against the others. */
export const ADay: Story = {};

/** The largest first, every size included. */
export const LargestFirst: Story = {
  args: { query: parseLogQuery({ mag: 'any', sort: 'largest' }) },
};

/** Only what a seismologist has reviewed. */
export const Reviewed: Story = { args: { query: parseLogQuery({ review: 'reviewed' }) } };

/** A search no place name holds: the log says so, and offers to clear it. */
export const NothingMatches: Story = { args: { query: parseLogQuery({ q: 'atlantis' }) } };
