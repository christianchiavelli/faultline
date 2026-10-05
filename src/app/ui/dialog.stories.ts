import type { Meta, StoryObj } from '@storybook/angular';
import { expect } from 'storybook/test';
import { Dialog } from './dialog';

/** A modal dialog on the platform's own `<dialog>`: the page behind goes inert, and focus moves in and comes back. */
const meta: Meta<Dialog> = {
  title: 'Design system/Dialog',
  component: Dialog,
  args: {
    heading: 'Export this search',
    eyebrow: 'Export',
    lede: 'Every event the search finds, in one file.',
    sheet: false,
  },
  // Opened from a button, as in the app: a modal open from the start would cover the docs page.
  render: (args) => ({
    props: { ...args, open: false },
    template: `
      <button type="button" class="button" (click)="open = true">{{ eyebrow }}</button>
      <ui-dialog [(open)]="open" [heading]="heading" [eyebrow]="eyebrow" [lede]="lede" [sheet]="sheet">
        <p>The body scrolls when it holds more than the screen does.</p>
        <div uiDialogFooter>
          <button type="button" class="button" (click)="open = false">Done</button>
        </div>
      </ui-dialog>
    `,
  }),
};

export default meta;
type Story = StoryObj<Dialog>;

/** The platform's own `<dialog>`: the page behind goes inert, and focus moves in. */
export const Modal: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Export' }));
    await expect(canvas.getByRole('dialog', { name: 'Export this search' })).toBeVisible();
  },
};

/** Its close button closes it, and focus goes back to the button that opened it. */
export const Closed: Story = {
  play: async ({ canvas, userEvent }) => {
    const opener = canvas.getByRole('button', { name: 'Export' });
    await userEvent.click(opener);
    await userEvent.click(canvas.getByRole('button', { name: 'Close' }));
    await expect(canvas.queryByRole('dialog')).toBeNull();
    await expect(opener).toHaveFocus();
  },
};

/** On a phone, a sheet rises from the bottom and leaves the top of the page in view. */
export const Sheet: Story = {
  args: { sheet: true, eyebrow: 'Filters', heading: 'Filter the log', lede: undefined },
  globals: { viewport: { value: 'mobile2' } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Filters' }));
    await expect(canvas.getByRole('dialog', { name: 'Filter the log' })).toBeVisible();
  },
};
