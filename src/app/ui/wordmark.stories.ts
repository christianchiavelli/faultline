import type { Meta, StoryObj } from '@storybook/angular';
import { Wordmark } from './wordmark';

/** The line breaks and steps down, the way a fault offsets everything that crosses it. */
const meta: Meta<Wordmark> = {
  title: 'Design system/Wordmark',
  component: Wordmark,
};

export default meta;

export const Default: StoryObj<Wordmark> = {};
