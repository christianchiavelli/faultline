// @ts-check
import css from '@eslint/css';
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Architectural boundaries, enforced rather than agreed:
 *
 *   src/shared   domain and contracts; plain TypeScript, no framework, no Node
 *   src/server   the BFF; Node, never Angular
 *   src/app/ui   the design system; knows nothing about earthquakes
 *   src/app      the Angular app; reaches the BFF over HTTP only
 *
 * The one sanctioned crossing is the in-process SSR backend, which calls the
 * API router directly and is only ever provided on the server.
 */
/** A rule per crossing: `name` bans one module, `group` a family of them. */
const restrict = (...rules) => [
  'error',
  {
    paths: rules.filter((rule) => 'name' in rule),
    patterns: rules.filter((rule) => 'group' in rule),
  },
];

const noAngular = { group: ['@angular/*', 'rxjs', 'rxjs/*'], message: 'Framework-free layer.' };
const noNode = { group: ['node:*'], message: 'Shared code runs in the browser too.' };
const noClassicZod = {
  name: 'zod',
  message: 'Code the browser loads uses zod/mini: classic Zod does not tree-shake.',
};
const noServer = {
  group: ['@server/*', '**/server/*'],
  message: 'Browser code reaches the BFF over HTTP, not by import.',
};
const noApp = {
  group: ['@core/*', '@ui/*', '**/app/*'],
  message: 'This layer sits below the app.',
};
const noDomain = {
  group: ['@shared/*', '@core/*', '../**/shared/*', '../**/core/*', '**/features/*'],
  message: 'The design system knows nothing about earthquakes.',
};

export default defineConfig([
  {
    ignores: ['dist/', 'coverage/', '.angular/', 'public/'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['fl', 'ui'], style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['fl', 'ui'], style: 'kebab-case' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports', disallowTypeAnnotations: false },
      ],
    },
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: { 'no-restricted-imports': restrict(noAngular, noNode, noClassicZod, noServer, noApp) },
  },
  {
    files: ['src/server/**/*.ts'],
    rules: { 'no-restricted-imports': restrict(noAngular, noApp) },
  },
  {
    files: ['src/app/ui/**/*.ts'],
    rules: { 'no-restricted-imports': restrict(noServer, noDomain) },
  },
  {
    files: ['src/app/**/*.ts'],
    ignores: ['src/app/ui/**', 'src/app/core/api/in-process-backend.ts'],
    rules: { 'no-restricted-imports': restrict(noClassicZod, noServer) },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
    },
  },
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    rules: {
      // Durations are roles (`tokens.css`): one written in place drifts from the rest of its kind.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Declaration[property=/^(animation|transition)/] Dimension[unit=/^m?s$/i]',
          message: 'A duration is a motion role: use a --motion-* token from tokens.css.',
        },
      ],
    },
  },
]);
