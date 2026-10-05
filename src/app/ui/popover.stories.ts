import type { Meta, StoryObj } from '@storybook/angular';
import { expect, waitFor } from 'storybook/test';
import { Icon } from './icon';
import { Popover } from './popover';

/** A panel that opens from a button, on the platform's own popover, hanging from its button through CSS anchor positioning. */
const meta: Meta<Popover> = {
  title: 'Design system/Popover',
  component: Popover,
  args: { label: 'Theme', heading: 'Theme' },
  render: (args) => ({
    props: args,
    moduleMetadata: { imports: [Icon] },
    template: `
      <ui-popover [label]="label" [heading]="heading">
        <span uiPopoverTrigger class="tool-button"><ui-icon name="sliders" /> Theme</span>
        <p>Paper, film, or whatever the device is set to.</p>
      </ui-popover>
    `,
  }),
};

export default meta;
type Story = StoryObj<Popover>;

/** Closed, the button alone, named by its `label`. */
export const Closed: Story = {};

/** Open, the panel hangs from its button, a group named by its heading. */
export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Theme' }));
    // It fades in, so it is visible from its first frame on rather than the instant it opens.
    const panel = canvas.getByRole('group', { name: 'Theme' });
    await waitFor(() => expect(panel).toBeVisible());
  },
};
