// Named presets = partial configs applied over the defaults, so devs can skip
// the wizard: `npx packkit ts-lib my-project`.

export const PRESETS = {
  'ts-lib': { language: 'ts', target: ['library'], moduleFormat: 'esm' },
  'js-lib': { language: 'js', target: ['library'], moduleFormat: 'esm', bundler: 'tsup' },
  'ts-cli': { language: 'ts', target: ['cli', 'library'], moduleFormat: 'esm' },
  cli: { language: 'ts', target: ['cli', 'library'], moduleFormat: 'esm' },
  'react-lib': { language: 'ts', framework: 'react', target: ['library'], moduleFormat: 'esm', test: 'vitest' },
  'react-lib-js': { language: 'js', framework: 'react', target: ['library'], moduleFormat: 'esm', bundler: 'tsup', test: 'vitest' },
  'react-app': { language: 'ts', framework: 'react', target: ['app'], test: 'vitest', release: 'none', workflows: ['ci'] },
  'vue-lib': { language: 'ts', framework: 'vue', target: ['library'], test: 'vitest' },
  'vue-app': { language: 'ts', framework: 'vue', target: ['app'], test: 'vitest', release: 'none', workflows: ['ci'] },
  'svelte-lib': { language: 'ts', framework: 'svelte', target: ['library'], test: 'vitest' },
  'svelte-app': { language: 'ts', framework: 'svelte', target: ['app'], test: 'vitest', release: 'none', workflows: ['ci'] },
  'node-service': {
    language: 'ts', target: ['service'], moduleFormat: 'esm', bundler: 'tsup',
    test: 'vitest', lint: 'eslint-prettier', gitHooks: 'simple-git-hooks',
    release: 'none', workflows: ['ci'], deps: 'renovate', agents: true, vscode: true,
  },
  'node-worker': {
    language: 'ts', target: ['worker'], moduleFormat: 'esm', bundler: 'tsup',
    test: 'vitest', lint: 'eslint-prettier', gitHooks: 'simple-git-hooks',
    release: 'none', workflows: ['ci'], deps: 'renovate', agents: true, vscode: true,
  },
  monorepo: { monorepo: true, language: 'ts', packageManager: 'pnpm' },
  fullstack: {
    monorepo: true, monorepoLayout: 'fullstack', language: 'ts', packageManager: 'pnpm',
    framework: 'react', test: 'vitest', release: 'none', workflows: ['ci'],
  },
  oss: {
    language: 'ts', target: ['library'], moduleFormat: 'esm', bundler: 'tsup',
    test: 'vitest', coverage: true, lint: 'eslint-prettier', gitHooks: 'simple-git-hooks',
    release: 'changesets', workflows: ['ci', 'npm-publish', 'codeql', 'codecov'],
    deps: 'renovate', community: true, agents: true, vscode: true,
    pkgChecks: true, knip: true,
  },
  minimal: {
    language: 'ts', target: ['library'], moduleFormat: 'esm', bundler: 'tsup',
    test: 'none', lint: 'none', gitHooks: 'none', release: 'none',
    workflows: ['ci'], deps: 'none', community: false, agents: false, vscode: false,
  },
  full: {
    language: 'ts', target: ['library', 'cli'], moduleFormat: 'esm', bundler: 'tsup',
    test: 'vitest', coverage: true, lint: 'eslint-prettier', gitHooks: 'simple-git-hooks',
    release: 'changesets',
    workflows: ['ci', 'npm-publish', 'pages', 'codeql', 'codecov', 'stale'],
    deps: 'renovate', community: true, agents: true, vscode: true,
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

// Short shortcuts, e.g. `npx create-packkit lib my-lib`.
export const PRESET_ALIASES = {
  lib: 'ts-lib',
  jslib: 'js-lib',
  rlib: 'react-lib',
  rapp: 'react-app',
  vlib: 'vue-lib',
  vapp: 'vue-app',
  slib: 'svelte-lib',
  sapp: 'svelte-app',
  svc: 'node-service',
  fs: 'fullstack',
  app: 'fullstack',
  service: 'node-service',
  worker: 'node-worker',
};

/** Resolve a preset name or alias to its canonical preset id (or undefined). */
export function resolvePreset(name) {
  if (PRESETS[name]) return name;
  if (PRESET_ALIASES[name]) return PRESET_ALIASES[name];
  return undefined;
}

// Short gists for the CLI help and the web configurator (tooltips + description).
export const PRESET_INFO = {
  'ts-lib': 'TypeScript library — ESM-only, tsup, Vitest, ESLint.',
  'js-lib': 'JavaScript (ESM) library — tsup, Vitest, ESLint.',
  'ts-cli': 'TypeScript CLI + library — ESM, ships a bin.',
  cli: 'TypeScript CLI tool — ESM, ships a bin.',
  'react-lib': 'React component library (TS) — JSX, peer deps, jsdom tests.',
  'react-lib-js': 'React component library (JS) — JSX, peer deps, jsdom tests.',
  'react-app': 'React SPA — Vite dev server, build, Testing Library.',
  'vue-lib': 'Vue component library — Vite lib build (SFCs), ESM + types.',
  'vue-app': 'Vue SPA — Vite dev server, build, Testing Library.',
  'svelte-lib': 'Svelte component library — ships source, peer svelte, jsdom tests.',
  'svelte-app': 'Svelte SPA — Vite dev server, build, Testing Library.',
  'node-service': 'Node HTTP service (Hono) — tsx dev, tsup build, Dockerfile.',
  'node-worker': 'Node background worker — queue/event consumer: handler seam, SIGTERM drain, JSON logs, poison seam, Dockerfile (no HTTP port). No transport SDK.',
  monorepo: 'pnpm + Turborepo workspace — two example packages, Changesets, CI.',
  fullstack: 'Full-stack monorepo — React+Vite web, Hono/Fastify/Express API (--server), shared package; server serves the web build in production.',
  oss: 'Full open-source library — coverage, CodeQL, Codecov, Renovate, Changesets.',
  minimal: 'Bare TS library — tsup only, no tests/lint/CI.',
  full: 'Everything on — library + CLI, all workflows and extras.',
};
