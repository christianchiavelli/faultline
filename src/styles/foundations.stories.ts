import type { Meta, StoryObj } from '@storybook/angular';

/**
 * The tokens of `tokens.css`, drawn. Every value here is the live custom
 * property, so the pages follow the theme picked in the toolbar, and a token
 * changed in the stylesheet changes here with no copy to update.
 */
const meta: Meta = {
  title: 'Foundations',
  // Each story is a page of its own already; a docs page would only stack them.
  tags: ['!autodocs'],
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj;

interface Token {
  readonly name: string;
  readonly role: string;
}

interface Group {
  readonly name: string;
  readonly note: string;
  readonly tokens: readonly Token[];
}

const SHARED_STYLES = `
  .groups {
    display: grid;
    gap: var(--space-10);
    max-width: 60rem;
  }
  .group {
    display: grid;
    gap: var(--space-3);
  }
  .note {
    max-width: var(--measure);
    color: var(--content-secondary);
  }
  code {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
  .role {
    color: var(--content-secondary);
    font-size: var(--text-sm);
  }
`;

const PALETTE: readonly Group[] = [
  {
    name: 'Paper',
    note: 'The drum of a seismograph. Warm, barely chromatic.',
    tokens: ['25', '50', '100', '200', '300', '400'].map((step) => ({
      name: `--paper-${step}`,
      role: '',
    })),
  },
  {
    name: 'Ink',
    note: 'A warm near-black: nothing here is #000.',
    tokens: ['500', '700', '900'].map((step) => ({ name: `--ink-${step}`, role: '' })),
  },
  {
    name: 'Pen',
    note: 'One red, reserved for what the reader should see first.',
    tokens: ['100', '500', '600'].map((step) => ({ name: `--pen-${step}`, role: '' })),
  },
  {
    name: 'Film',
    note: 'Photographic drum paper: a light trace on a dark record.',
    tokens: ['950', '900', '850', '800', '700', '600'].map((step) => ({
      name: `--film-${step}`,
      role: '',
    })),
  },
  {
    name: 'Chalk and the pen on film',
    note: 'What writes on film.',
    tokens: [
      ...['100', '300', '500'].map((step) => ({ name: `--chalk-${step}`, role: '' })),
      ...['100', '500'].map((step) => ({ name: `--pen-film-${step}`, role: '' })),
    ],
  },
];

const SEMANTIC: readonly Group[] = [
  {
    name: 'Surfaces',
    note: 'Raised is a step forward of the page: a band that takes turns with it, or what floats over it.',
    tokens: [
      { name: '--surface-page', role: 'The page' },
      { name: '--surface-raised', role: 'Every other band, and what floats over the page' },
      { name: '--surface-chart', role: 'Behind an instrument' },
      { name: '--surface-sunken', role: 'A row or control under the pointer, and a callout' },
      { name: '--surface-inverse', role: 'A primary button, and the choice in force' },
      { name: '--surface-accent', role: 'A search match, and the tint of a row just shown' },
    ],
  },
  {
    name: 'Content',
    note: 'Tertiary is the lightest text allowed: 5:1 on every surface.',
    tokens: [
      { name: '--content-primary', role: 'Text' },
      { name: '--content-secondary', role: 'What qualifies it' },
      { name: '--content-tertiary', role: 'The quietest text there is' },
      { name: '--content-inverse', role: 'Text on the inverse surface' },
      { name: '--content-accent', role: 'What the reader should see first' },
    ],
  },
  {
    name: 'Rules',
    note: 'The printed lines of a form.',
    tokens: [
      { name: '--rule-faint', role: 'The faintest line, between rows' },
      { name: '--rule', role: 'A line between parts' },
      { name: '--rule-strong', role: 'A line in full ink' },
    ],
  },
  {
    name: 'Instruments',
    note: 'The trace, its grid and the map.',
    tokens: [
      { name: '--trace-ink', role: 'The trace' },
      { name: '--trace-pen', role: 'An event worth a label' },
      { name: '--grid-minor', role: 'The fine lines of a chart' },
      { name: '--grid-major', role: 'The lines a chart is read by' },
      { name: '--land', role: 'Land on the map' },
      { name: '--plate', role: 'A plate boundary' },
    ],
  },
];

const SWATCH_TEMPLATE = `
  <div class="groups">
    @for (group of groups; track group.name) {
      <section class="group">
        <h2 class="eyebrow">{{ group.name }}</h2>
        <p class="note">{{ group.note }}</p>
        <ul class="swatches">
          @for (token of group.tokens; track token.name) {
            <li>
              <span class="swatch" [style.background]="'var(' + token.name + ')'"></span>
              <code>{{ token.name }}</code>
              @if (token.role) {
                <span class="role">{{ token.role }}</span>
              }
            </li>
          }
        </ul>
      </section>
    }
  </div>
`;

const SWATCH_STYLES = `
  ${SHARED_STYLES}
  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: var(--space-5) var(--space-4);
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    align-content: start;
    gap: var(--space-1);
  }
  .swatch {
    height: var(--space-12);
    margin-bottom: var(--space-1);
    border: var(--hairline) solid var(--rule);
  }
`;

/** The raw values, named for what they are. Components never read these: a semantic token stands between. */
export const Palette: Story = {
  render: () => ({
    props: { groups: PALETTE },
    template: SWATCH_TEMPLATE,
    styles: [SWATCH_STYLES],
  }),
};

/** What each colour is for. Declared once with both themes side by side, through `light-dark()`. */
export const Colour: Story = {
  render: () => ({
    props: { groups: SEMANTIC },
    template: SWATCH_TEMPLATE,
    styles: [SWATCH_STYLES],
  }),
};

const SIZES = ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'display'];
const WIDTHS = ['condensed', 'normal', 'expanded'];

/** Archivo carries the words, its width axis doing the work of a second family. Martian Mono carries every number. */
export const Type: Story = {
  render: () => ({
    props: { sizes: SIZES, widths: WIDTHS },
    template: `
      <div class="groups">
        <section class="group">
          <h2 class="eyebrow">Scale</h2>
          <ul class="scale">
            @for (size of sizes; track size) {
              <li>
                <code>--text-{{ size }}</code>
                @if (size === 'display') {
                  <span class="sample mono" [style.font-size]="'var(--text-display)'">5.8</span>
                } @else {
                  <span class="sample" [style.font-size]="'var(--text-' + size + ')'">Pāhala, Hawaii</span>
                }
              </li>
            }
          </ul>
        </section>
        <section class="group">
          <h2 class="eyebrow">Widths</h2>
          <ul class="scale">
            @for (width of widths; track width) {
              <li>
                <code>--width-{{ width }}</code>
                <span class="sample" [style.font-stretch]="'var(--width-' + width + ')'">Magnitude and depth</span>
              </li>
            }
          </ul>
        </section>
        <section class="group">
          <h2 class="eyebrow">Numbers</h2>
          <p class="mono numbers">M5.8 · 29.5 km · 17:14:13 UTC</p>
        </section>
      </div>
    `,
    styles: [
      `
        ${SHARED_STYLES}
        .scale {
          display: grid;
          gap: var(--space-4);
          padding: 0;
          list-style: none;
        }
        li {
          display: grid;
          grid-template-columns: 9rem 1fr;
          align-items: baseline;
          gap: var(--space-4);
        }
        .sample {
          line-height: var(--leading-tight);
          font-size: var(--text-lg);
        }
        .numbers {
          font-size: var(--text-lg);
        }
      `,
    ],
  }),
};

const SPACES = ['1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20'];

/** Space, on a 4 px grid. Paper has no rounded corners, and casts a shadow only where it floats. */
export const Space: Story = {
  render: () => ({
    props: { spaces: SPACES },
    template: `
      <ul class="spaces">
        @for (space of spaces; track space) {
          <li>
            <code>--space-{{ space }}</code>
            <span class="bar" [style.width]="'var(--space-' + space + ')'"></span>
          </li>
        }
      </ul>
    `,
    styles: [
      `
        ${SHARED_STYLES}
        .spaces {
          display: grid;
          gap: var(--space-3);
          padding: 0;
          list-style: none;
        }
        li {
          display: grid;
          grid-template-columns: 9rem 1fr;
          align-items: center;
          gap: var(--space-4);
        }
        .bar {
          height: var(--space-3);
          background: var(--content-accent);
        }
      `,
    ],
  }),
};

const MOTION: readonly Token[] = [
  {
    name: '--motion-feedback',
    role: 'A control answering the hand. Only colour changes; nothing moves.',
  },
  { name: '--motion-enter', role: 'What comes onto the page: a menu, a dialog, the trace’s card.' },
  {
    name: '--motion-exit',
    role: 'What leaves, faster than it came, so it never holds up what is next.',
  },
  { name: '--motion-navigate', role: 'One page giving way to the next, the bar holding still.' },
  { name: '--motion-pulse', role: 'What is live, at the pen’s pace: one whole breath.' },
  { name: '--motion-wait', role: 'How long a wait goes unremarked before a placeholder shows.' },
];

/** Every duration is one of these roles, never a number of its own: the lint fails on one. Reduced motion zeroes the roles that move. */
export const Motion: Story = {
  render: () => ({
    props: { roles: MOTION },
    template: `
      <table class="roles">
        <caption class="visually-hidden">The motion roles and what each is for</caption>
        <thead>
          <tr>
            <th scope="col">Role</th>
            <th scope="col">What it is for</th>
          </tr>
        </thead>
        <tbody>
          @for (role of roles; track role.name) {
            <tr>
              <th scope="row"><code>{{ role.name }}</code></th>
              <td>{{ role.role }}</td>
            </tr>
          }
        </tbody>
      </table>
    `,
    styles: [
      `
        ${SHARED_STYLES}
        .roles {
          max-width: 60rem;
          border-collapse: collapse;
          text-align: left;
        }
        th,
        td {
          padding: var(--space-3) var(--space-4) var(--space-3) 0;
          border-bottom: var(--hairline) solid var(--rule-faint);
          vertical-align: baseline;
        }
        thead th {
          border-bottom-color: var(--rule-strong);
          font-size: var(--text-sm);
        }
      `,
    ],
  }),
};
