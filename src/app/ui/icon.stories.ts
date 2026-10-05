import type { Meta, StoryObj } from '@storybook/angular';
import { Icon } from './icon';
import { ICONS, type IconName } from './icons';

const NAMES = Object.keys(ICONS) as IconName[];

/** Drawn for the app rather than borrowed: straight strokes with square ends, sized and coloured by the text around them. */
const meta: Meta<Icon> = {
  title: 'Design system/Icon',
  component: Icon,
  argTypes: { name: { control: 'select', options: NAMES } },
  args: { name: 'search' },
};

export default meta;
type Story = StoryObj<Icon>;

/** Every icon the app draws, each the centre line of its strokes on a 16 px grid. */
export const TheSet: Story = {
  render: () => ({
    props: { names: NAMES },
    template: `
      <ul class="set">
        @for (name of names; track name) {
          <li>
            <ui-icon [name]="name" />
            <code>{{ name }}</code>
          </li>
        }
      </ul>
    `,
    styles: [
      `
        .set {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
          gap: var(--space-6) var(--space-4);
          padding: 0;
          list-style: none;
        }
        li {
          display: grid;
          justify-items: center;
          gap: var(--space-2);
        }
        ui-icon {
          font-size: var(--text-2xl);
        }
        code {
          font-family: var(--font-mono);
          font-size: var(--text-xs);
          color: var(--content-secondary);
        }
      `,
    ],
  }),
};

/** Next to a word an icon only repeats it, so it is hidden from screen readers, and takes the word's size and colour. */
export const BesideAWord: Story = {
  render: (args) => ({
    props: args,
    template: `<span class="word"><ui-icon [name]="name" /> Search</span>`,
    styles: [
      `.word { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-lg); }`,
    ],
  }),
};

/** On its own, an icon carries a label, and reads as an image. */
export const OnItsOwn: Story = {
  args: { name: 'external-link', label: 'Opens the USGS event page' },
  render: (args) => ({
    props: args,
    template: `<ui-icon [name]="name" [label]="label" />`,
    styles: [`ui-icon { font-size: var(--text-xl); }`],
  }),
};
