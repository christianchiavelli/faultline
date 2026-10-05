import type { Meta, StoryObj } from '@storybook/angular';
import { Highlight } from './highlight';

/** Text with the words of a search marked in it, compared the way the search compares them. */
const meta: Meta<Highlight> = {
  title: 'Design system/Highlight',
  component: Highlight,
  args: { text: '7 km SSW of Pāhala, Hawaii', search: 'pahala' },
};

export default meta;
type Story = StoryObj<Highlight>;

/** The search compares without accents, and so does the mark: "pahala" finds the "Pāhala" of the place name. */
export const AccentsFolded: Story = {};

/** Every word of the search is marked, wherever it falls. */
export const SeveralWords: Story = { args: { search: 'km hawaii' } };

/** A search the text does not hold leaves it as it was. */
export const NoMatch: Story = { args: { search: 'tokyo' } };
