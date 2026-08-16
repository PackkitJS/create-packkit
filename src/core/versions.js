// The single source of truth for every dependency version Packkit writes into
// generated projects. Feature modules reference these by name instead of
// hard-coding a spec, so a bump happens in one place and the freshness workflow
// (scripts/check-template-deps.mjs) has one authoritative list to check.
//
// A conformance test (test/versions.test.js) asserts that every version in the
// generated output comes from this catalog, so nothing can drift back into a
// feature module unnoticed.
//
// When you bump anything here, update LAST_REVIEWED.

export const LAST_REVIEWED = '2026-07-26';

// The `packageManager` field written into pnpm projects. `pnpm/action-setup@v6`
// (with no pinned `version:`) resolves the pnpm version from this field, so a
// pnpm project must carry it or CI fails with "No pnpm version is specified".
// Shared by the single-package and monorepo paths so they can't drift apart.
export const PNPM_PIN = 'pnpm@9.10.0';

// name → npm spec. Deps that ship at one version everywhere.
export const V = {
  // toolchain
  typescript: '^5.9.3',
  'typescript-eslint': '^8.0.0',
  eslint: '^10.0.0',
  '@eslint/js': '^10.0.0',
  prettier: '^3.3.0',
  '@biomejs/biome': '^2.0.0',
  oxlint: '^1.0.0',
  turbo: '^2.0.0',
  rimraf: '^6.0.0',
  '@types/node': '^24.0.0',

  // build
  tsup: '^8.0.0',
  tsdown: '^0.6.0',
  unbuild: '^3.0.0',
  rollup: '^4.0.0',
  '@rollup/plugin-typescript': '^12.0.0',
  '@rollup/plugin-terser': '^1.0.0',
  tslib: '^2.6.0',
  tsx: '^4.0.0',
  vite: '^8.0.0',
  'vite-plugin-dts': '^5.0.0',

  // test
  vitest: '^4.0.0',
  '@vitest/coverage-v8': '^4.0.0',
  jsdom: '^29.0.0',
  jest: '^30.0.0',
  '@types/jest': '^30.0.0',
  'ts-jest': '^29.0.0',
  supertest: '^7.0.0',
  '@types/supertest': '^6.0.0',
  '@playwright/test': '^1.50.0',

  // release / package checks
  '@changesets/cli': '^2.27.0',
  'release-it': '^21.0.0',
  np: '^12.0.0',
  publint: '^0.3.0',
  '@arethetypeswrong/cli': '^0.18.0',
  knip: '^5.0.0',
  'size-limit': '^11.0.0',
  '@size-limit/preset-small-lib': '^11.0.0',

  // git hooks
  'simple-git-hooks': '^2.11.0',
  husky: '^9.1.0',
  lefthook: '^2.0.0',
  'lint-staged': '^16.2.0',

  // react
  react: '^19.0.0',
  'react-dom': '^19.0.0',
  '@types/react': '^19.0.0',
  '@types/react-dom': '^19.0.0',
  '@vitejs/plugin-react': '^6.0.0',
  '@testing-library/react': '^16.0.0',
  '@testing-library/dom': '^10.0.0',

  // vue
  vue: '^3.4.0',
  'vue-tsc': '^3.0.0',
  '@vitejs/plugin-vue': '^6.0.0',
  '@testing-library/vue': '^8.1.0',

  // svelte
  svelte: '^5.0.0',
  'svelte-check': '^4.0.0',
  '@sveltejs/vite-plugin-svelte': '^7.0.0',
  '@testing-library/svelte': '^5.2.0',

  // storybook
  storybook: '^10.0.0',
  '@storybook/react': '^10.0.0',
  '@storybook/react-vite': '^10.0.0',
  '@storybook/vue3': '^10.0.0',
  '@storybook/vue3-vite': '^10.0.0',
  '@storybook/svelte': '^10.0.0',
  '@storybook/svelte-vite': '^10.0.0',

  // services
  hono: '^4.5.0',
  '@hono/node-server': '^2.0.0',
  fastify: '^5.0.0',
  '@fastify/static': '^8.0.0',
  express: '^5.0.0',
  '@types/express': '^5.0.0',
  zod: '^4.0.0',
};

// Peer-dependency ranges — deliberately looser than the direct-dependency spec,
// so a component library declares broad compatibility rather than a hard pin.
export const PEER = {
  react: '>=18',
  'react-dom': '>=18',
  vue: '>=3',
  svelte: '>=5',
};

// Deps intentionally held below their latest major, with the reason. The
// freshness check reads this so a held-back dep is reported, not failed.
export const HELD = {
  typescript: 'typescript-eslint peers typescript <6.1.0 (no TS 7 support yet)',
  knip: 'v6 crashes on the oxc-parser native binding',
  'lint-staged': 'v17 requires Node >=22.22.1, above our Node 22 engines floor; hold at 16 to keep the Maintenance-LTS line working',
  jsdom: 'v30 requires Node ^22.22.2 || ^24.15.0, above our Node 22/24 engines floors; hold at 29 so generated projects install on the floor',
};
