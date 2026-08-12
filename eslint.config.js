// Packkit lints its own source with the same stack it generates for users
// (eslint flat config + @eslint/js recommended). Kept deliberately lean: this
// is here to catch real mistakes — undefined names, unreachable code, unused
// values — not to enforce a style (formatting isn't wired up yet).

import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Flag unused values, but let intentionally-ignored args (prefixed _) pass.
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
  {
    // The web configurator runs in the browser, so it has DOM globals, not Node.
    // JSZip is loaded from a <script> tag in index.html (the zip download).
    files: ['docs/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, JSZip: 'readonly' },
    },
  },
];
