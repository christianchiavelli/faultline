import type { Meta, StoryObj } from '@storybook/angular';
import { SiteFooter } from './site-footer';

/** The foot of every page: where the data comes from, and what it is not. */
const meta: Meta<SiteFooter> = {
  title: 'Shell/Site footer',
  component: SiteFooter,
  parameters: { layout: 'fullscreen' },
};

export default meta;

/** The data's sources and licences, and the line that says nothing here is an alert. */
export const Default: StoryObj<SiteFooter> = {};
