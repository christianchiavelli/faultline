import type { Meta, StoryObj } from '@storybook/angular';
import { Skeleton } from './skeleton';

/** A line of text still on its way, one line of its element tall, so the page is laid out as it will be once the text comes. */
const meta: Meta<Skeleton> = {
  title: 'Design system/Skeleton',
  component: Skeleton,
  args: { width: '100%' },
  render: (args) => ({
    props: args,
    template: `
      <p class="line">
        <span class="visually-hidden">Coming from the USGS catalogue…</span>
        <span aria-hidden="true"><ui-skeleton [width]="width" /></span>
      </p>
    `,
  }),
};

export default meta;
type Story = StoryObj<Skeleton>;

/** A whole line of text still on its way. It shows only once the wait is long enough to see. */
export const ALine: Story = {};

/** A short value, sized to what it will hold. */
export const AValue: Story = { args: { width: '6.5rem' } };

/** A readout waiting for its value and the words under it, laid out as it will be once they come. */
export const AReadout: Story = {
  render: () => ({
    template: `
      <dl class="readouts">
        <div class="readout">
          <dt class="eyebrow">Depth</dt>
          <dd>
            <span class="visually-hidden">Coming from the USGS catalogue…</span>
            <span class="readout__value" aria-hidden="true"><ui-skeleton width="6.5rem" /></span>
            <span class="readout__hint" aria-hidden="true">
              <ui-skeleton width="84%" />
              <ui-skeleton width="50%" />
            </span>
          </dd>
        </div>
      </dl>
    `,
  }),
};
