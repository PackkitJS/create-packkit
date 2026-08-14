// The single source of truth for every choice Packkit offers.
// Both the CLI wizard and the web configurator render from this schema, and
// `normalizeConfig` turns partial/user input into a complete, valid config.

import { NODE_LINES, DEFAULT_NODE } from './node.js';

/** @typedef {'select'|'multiselect'|'boolean'|'text'} OptionType */

// Node choices are derived from Node's own release schedule (see node-versions.js)
// so the LTS/Current lines and their patches stay current without hand-editing.
const NODE_CHOICES = Object.entries(NODE_LINES).map(([value, info]) => ({ value, label: info.label }));

export const OPTIONS = {
  // ---- package metadata ----
  name: { group: 'meta', type: 'text', label: 'Package name', default: 'my-package' },
  description: { group: 'meta', type: 'text', label: 'Description', default: '' },
  author: { group: 'meta', type: 'text', label: 'Author', default: '' },
  keywords: { group: 'meta', type: 'text', label: 'Keywords (comma-separated)', default: '' },
  repo: { group: 'meta', type: 'text', label: 'Repository URL', default: '' },

  // ---- core shape ----
  language: {
    group: 'core', type: 'select', label: 'Language', default: 'ts',
    choices: [
      { value: 'ts', label: 'TypeScript (strict)' },
      { value: 'js', label: 'JavaScript (ESM)' },
    ],
  },
  moduleFormat: {
    group: 'core', type: 'select', label: 'Module format', default: 'esm',
    choices: [
      { value: 'esm', label: 'ESM only (recommended)' },
      { value: 'dual', label: 'Dual (ESM + CJS)' },
      { value: 'cjs', label: 'CommonJS only' },
    ],
  },
  serviceFramework: {
    group: 'core', type: 'select', label: 'Service framework (HTTP service)', default: 'hono',
    // Applies to the service target, and to the fullstack monorepo (whose
    // apps/server honors it too).
    when: (cfg) => cfg.target?.includes('service') || cfg.monorepoLayout === 'fullstack',
    choices: [
      { value: 'hono', label: 'Hono (fast, web-standard)' },
      { value: 'fastify', label: 'Fastify' },
      { value: 'express', label: 'Express' },
    ],
  },
  target: {
    group: 'core', type: 'multiselect', label: 'What are you building?', default: ['library'],
    choices: [
      { value: 'library', label: 'Library (importable package)' },
      { value: 'cli', label: 'CLI tool (ships a bin)' },
      { value: 'service', label: 'HTTP service (Hono)' },
      { value: 'app', label: 'App (Vite SPA)' },
      { value: 'worker', label: 'Worker (queue/event consumer)' },
    ],
  },
  monorepo: {
    group: 'core', type: 'boolean', label: 'Monorepo (pnpm/Turborepo workspace)', default: false,
  },
  monorepoLayout: {
    group: 'core', type: 'select', label: 'Monorepo layout', default: 'libraries',
    when: (cfg) => cfg.monorepo,
    choices: [
      { value: 'libraries', label: 'Libraries — linked packages you publish' },
      { value: 'fullstack', label: 'Full-stack app — web + server + shared' },
    ],
  },
  framework: {
    group: 'core', type: 'select', label: 'Framework', default: 'none',
    choices: [
      { value: 'none', label: 'None (plain package)' },
      { value: 'react', label: 'React' },
      { value: 'vue', label: 'Vue' },
      { value: 'svelte', label: 'Svelte' },
    ],
  },
  packageManager: {
    group: 'core', type: 'select', label: 'Package manager', default: 'npm',
    choices: [
      { value: 'npm', label: 'npm' },
      { value: 'pnpm', label: 'pnpm' },
      { value: 'yarn', label: 'yarn' },
      { value: 'bun', label: 'bun' },
    ],
  },
  nodeVersion: {
    group: 'core', type: 'select', label: 'Node version', default: DEFAULT_NODE,
    choices: NODE_CHOICES,
  },

  // ---- build ----
  bundler: {
    group: 'build', type: 'select', label: 'Bundler / build', default: 'tsup',
    choices: [
      { value: 'tsup', label: 'tsup (esbuild — recommended)' },
      { value: 'tsdown', label: 'tsdown (Rolldown — fast successor)' },
      { value: 'unbuild', label: 'unbuild (UnJS)' },
      { value: 'rollup', label: 'Rollup' },
      { value: 'none', label: 'None (tsc / no build)' },
    ],
  },
  minify: {
    group: 'build', type: 'boolean', label: 'Minify output (best for CLIs / browser bundles)', default: false,
  },

  // ---- testing ----
  test: {
    group: 'quality', type: 'select', label: 'Test runner', default: 'vitest',
    choices: [
      { value: 'vitest', label: 'Vitest (recommended)' },
      { value: 'jest', label: 'Jest' },
      { value: 'node', label: 'node:test (built-in)' },
      { value: 'none', label: 'None' },
    ],
  },
  coverage: { group: 'quality', type: 'boolean', label: 'Coverage reporting', default: true },
  storybook: { group: 'quality', type: 'boolean', label: 'Storybook (component libraries)', default: false },
  e2e: { group: 'quality', type: 'boolean', label: 'Playwright end-to-end tests (apps)', default: false },
  sourcemaps: { group: 'build', type: 'boolean', label: 'Sourcemaps + ship source (debug into original code)', default: true },
  env: { group: 'quality', type: 'boolean', label: 'Type-safe env validation (Zod) — services & CLIs', default: false },
  canary: { group: 'release', type: 'boolean', label: 'Snapshot / canary release workflow (Changesets)', default: false },
  pkgChecks: { group: 'quality', type: 'boolean', label: 'Package checks (publint + are-the-types-wrong)', default: false },
  knip: { group: 'quality', type: 'boolean', label: 'Knip (unused files / deps / exports)', default: false },
  sizeLimit: { group: 'quality', type: 'boolean', label: 'size-limit (bundle-size budget, libraries)', default: false },
  doctor: { group: 'quality', type: 'boolean', label: 'Env doctor (warn on Node / package-manager mismatch)', default: false },

  // ---- lint / format ----
  lint: {
    group: 'quality', type: 'select', label: 'Lint / format', default: 'eslint-prettier',
    choices: [
      { value: 'eslint-prettier', label: 'ESLint + Prettier (recommended)' },
      { value: 'biome', label: 'Biome (all-in-one)' },
      { value: 'oxlint', label: 'oxlint + Prettier (fast)' },
      { value: 'none', label: 'None' },
    ],
  },

  // ---- git hooks ----
  gitHooks: {
    group: 'quality', type: 'select', label: 'Git hooks', default: 'simple-git-hooks',
    choices: [
      { value: 'simple-git-hooks', label: 'simple-git-hooks (light)' },
      { value: 'husky', label: 'husky + lint-staged' },
      { value: 'lefthook', label: 'lefthook' },
      { value: 'none', label: 'None' },
    ],
  },

  // ---- release ----
  release: {
    group: 'release', type: 'select', label: 'Release / versioning', default: 'changesets',
    choices: [
      { value: 'changesets', label: 'Changesets (recommended)' },
      { value: 'release-it', label: 'release-it' },
      { value: 'np', label: 'np' },
      { value: 'none', label: 'None' },
    ],
  },
  jsr: { group: 'release', type: 'boolean', label: 'Publish to JSR (TS-first registry)', default: false },

  // ---- github actions (configurable workflows) ----
  workflows: {
    group: 'ci', type: 'multiselect', label: 'GitHub Actions',
    default: ['ci', 'npm-publish'],
    choices: [
      { value: 'ci', label: 'CI (typecheck + lint + test + build)' },
      { value: 'npm-publish', label: 'Publish to npm (provenance / OIDC)' },
      { value: 'pages', label: 'Deploy GitHub Pages' },
      { value: 'codeql', label: 'CodeQL security scan' },
      { value: 'codecov', label: 'Upload coverage to Codecov' },
      { value: 'stale', label: 'Stale issue/PR bot' },
    ],
  },
  deps: {
    group: 'ci', type: 'select', label: 'Dependency updates', default: 'renovate',
    choices: [
      { value: 'renovate', label: 'Renovate' },
      { value: 'dependabot', label: 'Dependabot' },
      { value: 'none', label: 'None' },
    ],
  },

  // ---- repo hygiene ----
  license: {
    group: 'repo', type: 'select', label: 'License', default: 'MIT',
    choices: [
      { value: 'MIT', label: 'MIT' },
      { value: 'Apache-2.0', label: 'Apache-2.0' },
      { value: 'ISC', label: 'ISC' },
      { value: 'none', label: 'None' },
    ],
  },
  community: { group: 'repo', type: 'boolean', label: 'Community files (CONTRIBUTING, CoC, SECURITY, templates)', default: true },
  agents: { group: 'repo', type: 'boolean', label: 'AI agent instructions (AGENTS.md + CLAUDE.md)', default: true },
  vscode: { group: 'repo', type: 'boolean', label: 'VS Code settings + extensions', default: true },
  editorconfig: { group: 'repo', type: 'boolean', label: '.editorconfig', default: true },
  gitInit: { group: 'repo', type: 'boolean', label: 'git init + initial commit', default: true },
  install: { group: 'repo', type: 'boolean', label: 'Install dependencies', default: true },
};

export const GROUPS = [
  { id: 'meta', label: 'Package' },
  { id: 'core', label: 'Core' },
  { id: 'build', label: 'Build' },
  { id: 'quality', label: 'Quality' },
  { id: 'release', label: 'Release' },
  { id: 'ci', label: 'CI / CD' },
  { id: 'repo', label: 'Repository' },
];

// Plain-English "what it is / why you'd pick it" for every option. One source
// of truth for the web tooltips, the README reference, and `--schema` (agents).
export const OPTION_HELP = {
  name: 'The npm package name. Scoped names like `@you/pkg` are fine.',
  description: 'One-line summary — used in package.json and the README heading.',
  author: 'Your name (and optionally email/URL). Populates package.json + LICENSE.',
  keywords: 'Comma-separated npm keywords to help people discover the package.',
  repo: 'Git repository URL. Wires up repository/bugs/homepage links and CI badges.',
  language: 'TypeScript (strict, recommended) or plain ESM JavaScript. TS gives you types, editor help, and generated .d.ts for consumers.',
  moduleFormat: 'How the package is consumed. ESM-only (default) is the modern, leanest choice — Node 20.19+/22.12+ can `require()` ESM. Pick dual only if you must support older CJS-only consumers; cjs-only is rarely needed.',
  target: 'What you are building — mix and match: a library (importable package), a CLI (ships a bin), an HTTP service, or an app (Vite SPA).',
  serviceFramework: 'For the service target: Hono (fast, web-standard, tiny — default), Fastify (batteries-included, plugins, schema validation), or Express (ubiquitous, huge ecosystem).',
  monorepoLayout: 'What the workspace contains. "libraries" gives linked packages you publish (Changesets). "fullstack" gives apps/web (React+Vite) + apps/server (Hono by default; --server for Fastify/Express) + packages/shared, wired together, with the server serving the web build in production.',
  monorepo: 'Generate a pnpm + Turborepo workspace with two linked example packages and Changesets. Only worth it when ≥2 packages share code.',
  framework: 'UI framework for component libraries and apps: React, Vue, or Svelte (or none for a plain package).',
  packageManager: 'Which package manager the scripts, lockfile, and CI target: npm, pnpm, yarn, or bun.',
  nodeVersion: 'Minimum Node line to support. Choices track Node’s own release schedule (Active LTS is the default); this sets engines + .nvmrc.',
  bundler: 'How the library is built. tsup (default, esbuild-fast) and tsdown suit most libs; unbuild for zero-config; rollup for full control; none = tsc-only (or no build).',
  minify: 'Minify the build output. Best for CLIs and browser bundles; usually unnecessary for libraries (consumers minify).',
  sourcemaps: 'Ship source + JS/declaration maps so consumers can step into and go-to-definition on your original code when debugging. On by default for libraries.',
  test: 'Test runner: Vitest (fast, Vite-native, default), Jest (classic, huge ecosystem), or Node’s built-in node:test (zero deps).',
  coverage: 'Collect code-coverage reports (v8) and add a `coverage` script. Pairs with the Codecov workflow.',
  storybook: 'Add Storybook to develop and document components in isolation. Component libraries only.',
  e2e: 'Add Playwright end-to-end tests for app targets: a config that boots your dev server, an example spec, and a CI job.',
  sizeLimit: 'Add a bundle-size budget (size-limit) that measures your built entry and fails CI if it exceeds the limit — catches accidental bloat.',
  doctor: 'Add an env doctor (`npm run doctor`) that warns when the local Node / package manager don’t match what the project expects. Warn-only.',
  env: 'Type-safe environment variables: a Zod-validated `src/env.ts` that fails fast on misconfig, plus a `.env.example`. For services and CLIs.',
  pkgChecks: 'Verify the published package is correct with publint + are-the-types-wrong (exports map, types resolution, ESM/CJS). Highly recommended for libraries.',
  knip: 'Find unused files, dependencies, and exports so the project doesn’t accumulate dead weight.',
  lint: 'Linter + formatter: ESLint + Prettier (default, most compatible), Biome (one fast tool for both), or oxlint (Rust-fast linting).',
  gitHooks: 'Pre-commit hooks that run lint-staged: simple-git-hooks (tiny, default), husky (popular), or lefthook (fast, parallel).',
  release: 'How you version + publish: Changesets (default, great for libraries and monorepos), release-it, np, or none.',
  canary: 'Add a workflow that publishes snapshot builds (x.y.z-canary-<hash>) to a `canary` dist-tag so people can test unreleased changes. Requires Changesets.',
  jsr: 'Also publish to JSR, the TypeScript-first registry. For plain ESM TypeScript libraries.',
  workflows: 'GitHub Actions to include: ci (lint/test/build), npm-publish (provenance), pages (deploy Storybook/site), codeql (security), codecov (coverage), stale.',
  deps: 'Automated dependency updates: Renovate (default, powerful) or Dependabot (built into GitHub).',
  license: 'Open-source license for the LICENSE file and package.json (MIT recommended), or none.',
  community: 'Community health files: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, and issue/PR templates.',
  agents: 'AI-agent instructions (AGENTS.md + CLAUDE.md) so coding agents know how to build, test, and work in the repo.',
  vscode: 'VS Code workspace settings + recommended-extensions so the repo is set up consistently on open.',
  editorconfig: 'An .editorconfig so every editor uses the same indentation and line endings.',
  gitInit: 'Run `git init` and make an initial commit after scaffolding.',
  install: 'Install dependencies automatically after scaffolding.',
};

/** Build a default config from the schema. */
export function defaultConfig() {
  const cfg = {};
  for (const [key, opt] of Object.entries(OPTIONS)) {
    cfg[key] = Array.isArray(opt.default) ? [...opt.default] : opt.default;
  }
  return cfg;
}

/**
 * Merge partial input over the defaults and coerce a few fields.
 *
 * Pass a `diagnostics` array to have every coercion that overrides an
 * explicitly-supplied value recorded there (the embedded API surfaces these so
 * a host application learns when Packkit changed its requested config, instead
 * of the change happening silently). Existing callers omit it and see identical
 * behavior — the coercions run exactly the same either way.
 */
export function normalizeConfig(input = {}, diagnostics = null) {
  const cfg = { ...defaultConfig(), ...input };
  const requested = new Set(Object.keys(input));

  // Record a coercion only when it actually changes an explicitly-requested
  // value — a field left at its default that "changes" to the same default is
  // not news. Derived helper flags (isTs, hasApp…) go through plain assignment
  // below; they are computed, not overrides, so they never emit a diagnostic.
  const coerce = (field, value, code, message, severity = 'warning') => {
    const same = JSON.stringify(cfg[field]) === JSON.stringify(value);
    if (same) return;
    const previousValue = cfg[field];
    cfg[field] = value;
    if (diagnostics && requested.has(field)) {
      diagnostics.push({ severity, code, field, previousValue, resolvedValue: value, message, source: 'normalize' });
    }
  };

  // A target is required; default it if missing.
  if (!Array.isArray(cfg.target) || cfg.target.length === 0) {
    coerce('target', ['library'], 'TARGET_DEFAULTED', 'No target was given, so "library" was used.', 'info');
  }
  if (!Array.isArray(cfg.workflows)) coerce('workflows', [], 'WORKFLOWS_DEFAULTED', 'workflows was not a list, so it was reset to none.', 'info');

  if (cfg.bundler === 'none') coerce('minify', false, 'MINIFY_REQUIRES_BUNDLER', 'Minify was disabled because no bundler produces output to minify.');
  if (cfg.test === 'none' || cfg.test === 'node') coerce('coverage', false, 'COVERAGE_UNSUPPORTED_RUNNER', `Coverage was disabled because the "${cfg.test}" test runner does not report it.`);
  if (cfg.workflows.includes('codecov')) coerce('coverage', true, 'COVERAGE_FORCED_BY_CODECOV', 'Coverage was enabled because the Codecov workflow requires it.', 'info');

  cfg.isReact = cfg.framework === 'react';
  cfg.isVue = cfg.framework === 'vue';
  cfg.isSvelte = cfg.framework === 'svelte';
  cfg.hasFramework = cfg.framework !== 'none';

  cfg.hasApp = cfg.target.includes('app');
  // A component-framework package that isn't an app is a library.
  if (cfg.hasFramework && !cfg.hasApp && !cfg.target.includes('library')) {
    coerce('target', ['library', ...cfg.target], 'TARGET_LIBRARY_ADDED', 'A "library" target was added because a component framework needs something to build.', 'info');
  }

  cfg.isTs = cfg.language === 'ts';
  cfg.ext = cfg.isTs ? 'ts' : 'js';
  // JSX source extension for React; Vue/Svelte use their own component files.
  cfg.srcExt = cfg.isReact ? (cfg.isTs ? 'tsx' : 'jsx') : cfg.ext;

  cfg.hasLibrary = cfg.target.includes('library');
  cfg.hasCli = cfg.target.includes('cli');
  cfg.hasService = cfg.target.includes('service');
  cfg.hasWorker = cfg.target.includes('worker');

  // Vite builds apps and Vue libraries (SFCs); Svelte libraries ship source
  // (no build); React libraries use tsup (JSX is native to esbuild).
  cfg.viteBuild = cfg.hasApp || cfg.isVue;
  cfg.svelteLib = cfg.isSvelte && !cfg.hasApp;
  cfg.customBuild = cfg.viteBuild || cfg.svelteLib; // bundler.js steps aside
  cfg.usesVite = cfg.viteBuild || cfg.isSvelte; // Svelte tests need the vite plugin too
  // Whether a `build` script exists (Svelte libraries ship source, no build).
  cfg.hasBuild = cfg.viteBuild || (!cfg.svelteLib && (cfg.bundler !== 'none' || cfg.isTs));

  // Apps aren't published packages.
  if (cfg.hasApp) coerce('moduleFormat', 'esm', 'MODULE_FORMAT_FORCED_FOR_APP', 'An app is bundled, not published, so its module format is ESM.', 'info');
  cfg.hasEsm = cfg.moduleFormat === 'esm' || cfg.moduleFormat === 'dual';
  cfg.hasCjs = cfg.moduleFormat === 'cjs' || cfg.moduleFormat === 'dual';

  // Storybook only applies to component libraries.
  if (!cfg.hasFramework || cfg.hasApp || !cfg.hasLibrary) coerce('storybook', false, 'STORYBOOK_REQUIRES_COMPONENT_LIBRARY', 'Storybook was disabled because it only applies to a component library.');

  // Playwright E2E only applies to app targets.
  if (!cfg.hasApp) coerce('e2e', false, 'E2E_REQUIRES_APP', 'End-to-end tests were disabled because they only apply to an app target.');

  // A monorepo is its own generation path (see buildMonorepo); it has a build.
  if (cfg.monorepo) cfg.hasBuild = true;

  cfg.publishable = (cfg.hasLibrary || cfg.hasCli) && !cfg.hasApp && !cfg.hasService && !cfg.hasWorker;
  // Package-correctness checks only make sense for a publishable package.
  if (!cfg.publishable) coerce('pkgChecks', false, 'PKG_CHECKS_REQUIRES_PUBLISHABLE', 'Package-correctness checks were disabled because this project is not published to npm.');
  // Sourcemaps + shipped source only matter for a published package.
  if (!cfg.publishable) coerce('sourcemaps', false, 'SOURCEMAPS_REQUIRES_PUBLISHABLE', 'Sourcemaps were disabled because this project is not published to npm.');
  // A bundle-size budget needs a published package with a built entry.
  if (!(cfg.publishable && cfg.hasBuild)) coerce('sizeLimit', false, 'SIZE_LIMIT_REQUIRES_BUILT_LIBRARY', 'The bundle-size budget was disabled because it needs a published package with a build.');
  // Env validation is for server-side runtimes (services / CLIs), not libs/apps.
  if (!(cfg.hasService || cfg.hasCli)) coerce('env', false, 'ENV_REQUIRES_SERVICE_OR_CLI', 'Env validation was disabled because it only applies to a service or CLI.');
  // Canary snapshots ride on the Changesets flow.
  if (cfg.release !== 'changesets') coerce('canary', false, 'CANARY_REQUIRES_CHANGESETS', 'Canary releases were disabled because they require the Changesets release flow.');
  // JSR is TypeScript-first, ESM, and for plain (non-framework) libraries.
  if (!(cfg.isTs && cfg.hasLibrary && !cfg.hasFramework && !cfg.hasApp)) coerce('jsr', false, 'JSR_REQUIRES_PLAIN_TS_LIBRARY', 'JSR publishing was disabled because it applies only to a plain TypeScript library.');

  cfg.resolved = resolvedView(cfg);
  return cfg;
}

/**
 * A grouped, read-only view of the derived state — the same booleans the flat
 * `cfg.has*`/`is*` flags expose, organized by concern. Consumers that prefer
 * structured access (`cfg.resolved.targets.app`) can use it instead of
 * re-interpreting raw selections; the flat flags remain for existing code.
 *
 * It is derived purely from the flags computed above, and test/invariants.test.js
 * asserts the two never disagree and that the state is internally consistent —
 * so the derived model can't silently contradict itself.
 */
function resolvedView(cfg) {
  return {
    targets: { library: cfg.hasLibrary, cli: cfg.hasCli, service: cfg.hasService, app: cfg.hasApp, worker: cfg.hasWorker },
    language: { typescript: cfg.isTs, ext: cfg.ext, srcExt: cfg.srcExt },
    framework: { name: cfg.framework, react: cfg.isReact, vue: cfg.isVue, svelte: cfg.isSvelte, any: cfg.hasFramework },
    build: { vite: cfg.viteBuild, custom: cfg.customBuild, usesVite: cfg.usesVite, has: cfg.hasBuild },
    module: { format: cfg.moduleFormat, esm: cfg.hasEsm, cjs: cfg.hasCjs },
    package: { publishable: cfg.publishable, monorepo: cfg.monorepo },
  };
}
