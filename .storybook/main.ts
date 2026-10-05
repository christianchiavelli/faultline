import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@analogjs/storybook-angular';
import { mergeConfig } from 'vite';

/**
 * The @font-face rules and their metric-matched fallbacks, which `pnpm fonts`
 * writes into the head of `index.html`. Stories take the same block, so a
 * component is set in the faces the app ships, never in a stand-in.
 */
function fontFaces(): string {
  const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
  const block = /<!-- fonts:start -->([\s\S]*?)<!-- fonts:end -->/.exec(html)?.[1];
  if (!block) throw new Error('src/index.html has lost the block `pnpm fonts` writes');
  return block;
}

/**
 * Storybook on Vite, like the app's own build, rather than on the webpack
 * pipeline the official Angular framework still uses.
 */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.ts'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@analogjs/storybook-angular',
    options: { experimentalZoneless: true },
  },
  core: { disableTelemetry: true },
  // The fonts, and the basemap the world chart draws from.
  staticDirs: ['../public'],
  previewHead: (head) => `${head}${fontFaces()}`,
  viteFinal: (config) =>
    mergeConfig(config, {
      resolve: {
        tsconfigPaths: true,
        alias: [
          {
            find: /^@angular\/platform-browser\/animations$/,
            replacement: fileURLToPath(new URL('no-animations.ts', import.meta.url)),
          },
        ],
      },
    }),
};

export default config;
