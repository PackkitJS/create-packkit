// Monorepo generation — a pnpm/Turborepo (or npm/yarn workspaces) workspace
// with Changesets and two example packages (one depending on the other).
// This is a distinct shape from a single package, so generate() delegates here.

import { toJson } from './render.js';
import community from './features/community.js';
import agents from './features/agents.js';
import gitfiles from './features/gitfiles.js';
import { provenance, buildBaseline } from './provenance.js';
import { ciFirstPushNote } from './ci-note.js';
import { V } from './versions.js';

export function buildMonorepo(cfg) {
  // Two genuinely different shapes: a set of publishable libraries, or a
  // deployable app (web + server + shared code). They differ in workspace
  // globs, whether anything publishes, and what `dev` means, so they don't
  // usefully share a code path.
  if (cfg.monorepoLayout === 'fullstack') return buildFullstack(cfg);

  const files = {};
  const pm = cfg.packageManager;
  const scope = cfg.name.replace(/^@/, '').split('/')[0];
  const core = `@${scope}/core`;
  const utils = `@${scope}/utils`;
  const wsProto = pm === 'pnpm' ? 'workspace:*' : '*';
  const lint = monorepoLint(cfg);

  Object.assign(files, workspaceScaffold(cfg, { workspaceGlobs: ['packages/*'], lint }));

  // ---- root ----
  const rootPkg = {
    name: cfg.name,
    version: '0.0.0',
    private: true,
    type: 'module',
    ...(cfg.license !== 'none' ? { license: cfg.license } : {}),
    ...(pm === 'pnpm' ? { packageManager: 'pnpm@9.10.0' } : { workspaces: ['packages/*'] }),
    scripts: {
      build: 'turbo build',
      test: 'turbo test',
      ...(lint.rootLint ? { lint: lint.rootLint } : {}),
      ...lint.rootScripts,
      typecheck: 'turbo typecheck',
      dev: 'turbo dev',
      changeset: 'changeset',
      version: 'changeset version',
      release: 'turbo build && changeset publish',
    },
    devDependencies: {
      turbo: V.turbo,
      typescript: V.typescript,
      tsup: V.tsup,
      vitest: V.vitest,
      ...lint.rootDevDeps,
      '@changesets/cli': V['@changesets/cli'],
      '@types/node': `^${cfg.nodeVersion}.0.0`,
    },
  };
  files['package.json'] = toJson(rootPkg);

  files['turbo.json'] = toJson({
    $schema: 'https://turbo.build/schema.json',
    tasks: {
      build: { dependsOn: ['^build'], outputs: ['dist/**'] },
      test: { dependsOn: ['^build'] },
      typecheck: { dependsOn: ['^build'] },
      ...(lint.turboLint ? { lint: {} } : {}),
      dev: { cache: false, persistent: true },
    },
  });

  files['.changeset/config.json'] = toJson({
    $schema: 'https://unpkg.com/@changesets/config@3.0.0/schema.json',
    changelog: '@changesets/cli/changelog',
    commit: false,
    access: 'public',
    baseBranch: 'main',
  });
  files['.changeset/README.md'] = '# Changesets\n\nRun `npx changeset` to record a version bump for your next release.\n';

  files['README.md'] = rootReadme(cfg, pm, core, utils);

  // ---- packages ----
  addPackage(files, {
    name: core,
    dir: 'packages/core',
    src: [
      `/** Greet someone by name. */`,
      `export function greet(name: string): string {`,
      `\treturn \`Hello, \${name}!\`;`,
      `}`,
      ``,
    ].join('\n'),
    test: exampleTest(`import { greet } from './index.js';`, `expect(greet('world')).toBe('Hello, world!')`),
    deps: {},
    lintScript: lint.perPackageLint,
  });

  addPackage(files, {
    name: utils,
    dir: 'packages/utils',
    src: [
      `import { greet } from '${core}';`,
      ``,
      `/** Greet someone, loudly. */`,
      `export function shout(name: string): string {`,
      `\treturn greet(name).toUpperCase();`,
      `}`,
      ``,
    ].join('\n'),
    test: exampleTest(`import { shout } from './index.js';`, `expect(shout('world')).toBe('HELLO, WORLD!')`),
    deps: { [core]: wsProto },
    lintScript: lint.perPackageLint,
  });

  // Written last so the baseline covers every workspace file.
  files['packkit.json'] = provenance(cfg, buildBaseline(files));

  return {
    config: cfg,
    files,
    postCommands: cfg.gitInit ? ['git init', 'git add -A', 'git commit -m "Initial commit from Packkit"'] : [],
    summary: {
      name: cfg.name,
      fileCount: Object.keys(files).length,
      stack: ['monorepo', `${pm}+turbo`, 'TypeScript', 'tsup', 'vitest', 'changesets'],
      workflows: ['ci'],
    },
  };
}

// ---------------------------------------------------------------------------
// Full-stack layout: apps/web + apps/server + packages/shared.
//
// The pieces already existed as standalone presets (react-app, node-service);
// what was missing was the composition — workspace wiring, one shared package
// both sides import, and a production story where the server serves the built
// web assets instead of needing a second host.
// ---------------------------------------------------------------------------
function buildFullstack(cfg) {
  const files = {};
  const pm = cfg.packageManager;
  const scope = cfg.name.replace(/^@/, '').split('/')[0];
  const shared = `@${scope}/shared`;
  const wsProto = pm === 'pnpm' ? 'workspace:*' : '*';
  const lint = monorepoLint(cfg);
  const pkgLint = lint.perPackageLint ? { lint: lint.perPackageLint } : {};

  // apps/* + packages/*, and the DOM lib the web app's JSX needs.
  Object.assign(files, workspaceScaffold(cfg, { workspaceGlobs: ['apps/*', 'packages/*'], tsconfigLib: ['ES2022', 'DOM'], lint }));

  files['package.json'] = toJson({
    name: cfg.name,
    version: '0.0.0',
    private: true,
    type: 'module',
    ...(cfg.license !== 'none' ? { license: cfg.license } : {}),
    ...(pm === 'pnpm'
      ? { packageManager: 'pnpm@9.10.0' }
      : { workspaces: ['apps/*', 'packages/*'] }),
    scripts: {
      dev: 'turbo dev',
      build: 'turbo build',
      // Production runs the built server, which also serves the web build.
      start: `${pm === 'npm' ? 'npm --prefix apps/server run' : `${pm} --filter ./apps/server`} start`,
      test: 'turbo test',
      ...(lint.rootLint ? { lint: lint.rootLint } : {}),
      ...lint.rootScripts,
      typecheck: 'turbo typecheck',
    },
    devDependencies: {
      turbo: V.turbo,
      typescript: V.typescript,
      vitest: V.vitest,
      ...lint.rootDevDeps,
      '@types/node': `^${cfg.nodeVersion}.0.0`,
    },
  });

  files['turbo.json'] = toJson({
    $schema: 'https://turbo.build/schema.json',
    tasks: {
      build: { dependsOn: ['^build'], outputs: ['dist/**'] },
      // Shared is built before the apps start, so both sides always import a
      // current copy without a separate watch process.
      dev: { dependsOn: ['^build'], cache: false, persistent: true },
      test: { dependsOn: ['^build'] },
      typecheck: { dependsOn: ['^build'] },
      ...(lint.turboLint ? { lint: {} } : {}),
    },
  });

  files['README.md'] = fullstackReadme(cfg, pm, shared);

  // ---- packages/shared: the contract both sides compile against ----
  files['packages/shared/package.json'] = toJson({
    name: shared,
    version: '0.0.0',
    private: true,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
    scripts: {
      build: 'tsup src/index.ts --format esm --dts --clean',
      test: 'vitest run',
      typecheck: 'tsc --noEmit',
      ...pkgLint,
    },
    devDependencies: { tsup: V.tsup },
  });
  files['packages/shared/tsconfig.json'] = toJson({ extends: '../../tsconfig.base.json', include: ['src'] });
  files['packages/shared/src/index.ts'] = [
    `/** The shape the server returns and the web app renders. Change it once. */`,
    `export interface Health {`,
    `\tok: boolean;`,
    `\tservice: string;`,
    `\tuptime: number;`,
    `}`,
    ``,
    `export function describeHealth(h: Health): string {`,
    `\treturn h.ok ? \`\${h.service} is up (\${Math.round(h.uptime)}s)\` : \`\${h.service} is down\`;`,
    `}`,
    ``,
  ].join('\n');
  files['packages/shared/src/index.test.ts'] = exampleTest(
    `import { describeHealth } from './index.js';`,
    `expect(describeHealth({ ok: true, service: 'api', uptime: 12 })).toBe('api is up (12s)')`,
  );

  // ---- apps/server ---- (honors cfg.serviceFramework: hono | fastify | express)
  const fw = cfg.serviceFramework || 'hono';
  const server = fullstackServer(cfg, fw, shared);
  files['apps/server/package.json'] = toJson({
    name: `@${scope}/server`,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'tsx watch src/index.ts',
      build: 'tsup src/index.ts --format esm --clean',
      start: 'node dist/index.js',
      test: 'vitest run',
      typecheck: 'tsc --noEmit',
      ...pkgLint,
    },
    dependencies: { ...server.deps, [shared]: wsProto },
    devDependencies: { tsx: V.tsx, tsup: V.tsup, ...server.devDeps },
  });
  files['apps/server/tsconfig.json'] = toJson({ extends: '../../tsconfig.base.json', include: ['src'] });
  files['apps/server/src/app.ts'] = server.appTs;
  files['apps/server/src/index.ts'] = server.indexTs;
  files['apps/server/src/app.test.ts'] = server.appTestTs;

  // ---- apps/web ----
  files['apps/web/package.json'] = toJson({
    name: `@${scope}/web`,
    version: '0.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'vite',
      build: 'vite build',
      preview: 'vite preview',
      test: 'vitest run',
      typecheck: 'tsc --noEmit',
      ...pkgLint,
    },
    dependencies: { react: V.react, 'react-dom': V['react-dom'], [shared]: wsProto },
    devDependencies: {
      vite: V.vite,
      '@vitejs/plugin-react': V['@vitejs/plugin-react'],
      // Without the React types, `turbo typecheck` fails on the very first run
      // with TS7016/TS7026 on every JSX element.
      '@types/react': V['@types/react'],
      '@types/react-dom': V['@types/react-dom'],
      '@testing-library/react': V['@testing-library/react'],
      '@testing-library/dom': V['@testing-library/dom'],
      jsdom: V.jsdom,
    },
  });
  files['apps/web/tsconfig.json'] = toJson({
    extends: '../../tsconfig.base.json',
    compilerOptions: { jsx: 'react-jsx' },
    include: ['src'],
  });
  files['apps/web/vite.config.ts'] = [
    `/// <reference types="vitest" />`,
    `import { defineConfig } from 'vite';`,
    `import react from '@vitejs/plugin-react';`,
    ``,
    `export default defineConfig({`,
    `\tplugins: [react()],`,
    `\t// Same-origin /api in dev as in production, so no CORS and no base URL`,
    `\t// juggling between environments.`,
    `\tserver: { proxy: { '/api': 'http://localhost:3000' } },`,
    `\ttest: { environment: 'jsdom' },`,
    `});`,
    ``,
  ].join('\n');
  files['apps/web/src/App.test.tsx'] = [
    `import { describe, it, expect } from 'vitest';`,
    `import { render, screen } from '@testing-library/react';`,
    `import { App } from './App.js';`,
    ``,
    `describe('App', () => {`,
    `\tit('renders the service name', () => {`,
    `\t\trender(<App />);`,
    `\t\texpect(screen.getByRole('heading', { name: '${cfg.name}' })).toBeDefined();`,
    `\t});`,
    `});`,
    ``,
  ].join('\n');
  files['apps/web/index.html'] = [
    `<!doctype html>`,
    `<html lang="en">`,
    `\t<head>`,
    `\t\t<meta charset="UTF-8" />`,
    `\t\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `\t\t<title>${cfg.name}</title>`,
    `\t</head>`,
    `\t<body>`,
    `\t\t<div id="root"></div>`,
    `\t\t<script type="module" src="/src/main.tsx"></script>`,
    `\t</body>`,
    `</html>`,
    ``,
  ].join('\n');
  files['apps/web/src/main.tsx'] = [
    `import { StrictMode } from 'react';`,
    `import { createRoot } from 'react-dom/client';`,
    `import { App } from './App.js';`,
    ``,
    `createRoot(document.getElementById('root')!).render(`,
    `\t<StrictMode>`,
    `\t\t<App />`,
    `\t</StrictMode>,`,
    `);`,
    ``,
  ].join('\n');
  files['apps/web/src/App.tsx'] = [
    `import { useEffect, useState } from 'react';`,
    `import { describeHealth, type Health } from '${shared}';`,
    ``,
    `export function App() {`,
    `\tconst [health, setHealth] = useState<Health | null>(null);`,
    ``,
    `\tuseEffect(() => {`,
    `\t\tfetch('/api/health')`,
    `\t\t\t.then((r) => r.json() as Promise<Health>)`,
    `\t\t\t.then(setHealth)`,
    `\t\t\t.catch(() => setHealth({ ok: false, service: '${cfg.name}', uptime: 0 }));`,
    `\t}, []);`,
    ``,
    `\treturn (`,
    `\t\t<main>`,
    `\t\t\t<h1>${cfg.name}</h1>`,
    `\t\t\t<p>{health ? describeHealth(health) : 'Checking…'}</p>`,
    `\t\t</main>`,
    `\t);`,
    `}`,
    ``,
  ].join('\n');

  // Written last so the baseline covers every workspace file.
  files['packkit.json'] = provenance(cfg, buildBaseline(files));

  return {
    config: cfg,
    files,
    postCommands: cfg.gitInit ? ['git init', 'git add -A', 'git commit -m "Initial commit from Packkit"'] : [],
    summary: {
      name: cfg.name,
      fileCount: Object.keys(files).length,
      stack: ['monorepo', 'full-stack', `${pm}+turbo`, 'React+Vite', { hono: 'Hono', fastify: 'Fastify', express: 'Express' }[cfg.serviceFramework || 'hono'], 'TypeScript', 'vitest'],
      workflows: ['ci'],
    },
  };
}

// The full-stack server, per framework. Each serves /api/health (returning the
// shared Health shape) and, in production, the built web app from apps/web/dist
// so one process on one port covers the whole thing. In dev, Vite serves the
// web app and proxies /api here (see apps/web/vite.config.ts).
function fullstackServer(cfg, fw, shared) {
  const healthBody = `{ ok: true, service: '${cfg.name}', uptime: process.uptime() }`;

  if (fw === 'fastify') {
    return {
      deps: { fastify: V.fastify, '@fastify/static': V['@fastify/static'] },
      devDeps: {},
      appTs: [
        `import Fastify from 'fastify';`,
        `import fastifyStatic from '@fastify/static';`,
        `import { resolve } from 'node:path';`,
        `import type { Health } from '${shared}';`,
        ``,
        `export const app = Fastify();`,
        ``,
        `app.get('/api/health', async (): Promise<Health> => (${healthBody}));`,
        ``,
        `// In production the API also serves the built web app, so one process and`,
        `// one port covers the whole thing. In dev, Vite serves the app and proxies`,
        `// /api here instead (see apps/web/vite.config.ts).`,
        `if (process.env.NODE_ENV === 'production') {`,
        `\tapp.register(fastifyStatic, { root: resolve('../web/dist') });`,
        `}`,
        ``,
      ].join('\n'),
      indexTs: [
        `import { app } from './app.js';`,
        ``,
        `const port = Number(process.env.PORT ?? 3000);`,
        `app.listen({ port, host: '0.0.0.0' }).then((url) => console.log(\`Listening on \${url}\`));`,
        ``,
      ].join('\n'),
      appTestTs: [
        `import { describe, it, expect } from 'vitest';`,
        `import { app } from './app.js';`,
        ``,
        `describe('api', () => {`,
        `\tit('reports health', async () => {`,
        `\t\tconst res = await app.inject({ method: 'GET', url: '/api/health' });`,
        `\t\texpect(res.statusCode).toBe(200);`,
        `\t\texpect(res.json()).toMatchObject({ ok: true });`,
        `\t});`,
        `});`,
        ``,
      ].join('\n'),
    };
  }

  if (fw === 'express') {
    return {
      deps: { express: V.express },
      devDeps: { '@types/express': V['@types/express'], supertest: V.supertest, '@types/supertest': V['@types/supertest'] },
      appTs: [
        // Annotate the app type: the workspace tsconfig emits declarations, and
        // express()'s inferred type references a transitive package (TS2742).
        `import express, { type Express } from 'express';`,
        `import type { Health } from '${shared}';`,
        ``,
        `export const app: Express = express();`,
        ``,
        `app.get('/api/health', (_req, res) => {`,
        `\tconst body: Health = ${healthBody};`,
        `\tres.json(body);`,
        `});`,
        ``,
        `// In production the API also serves the built web app, so one process and`,
        `// one port covers the whole thing. In dev, Vite serves the app and proxies`,
        `// /api here instead (see apps/web/vite.config.ts).`,
        `if (process.env.NODE_ENV === 'production') {`,
        `\tapp.use(express.static('../web/dist'));`,
        `}`,
        ``,
      ].join('\n'),
      indexTs: [
        `import { app } from './app.js';`,
        ``,
        `const port = Number(process.env.PORT ?? 3000);`,
        `app.listen(port, () => console.log(\`Listening on http://localhost:\${port}\`));`,
        ``,
      ].join('\n'),
      appTestTs: [
        `import { describe, it, expect } from 'vitest';`,
        `import request from 'supertest';`,
        `import { app } from './app.js';`,
        ``,
        `describe('api', () => {`,
        `\tit('reports health', async () => {`,
        `\t\tconst res = await request(app).get('/api/health');`,
        `\t\texpect(res.status).toBe(200);`,
        `\t\texpect(res.body).toMatchObject({ ok: true });`,
        `\t});`,
        `});`,
        ``,
      ].join('\n'),
    };
  }

  // hono (default)
  return {
    deps: { hono: V.hono, '@hono/node-server': V['@hono/node-server'] },
    devDeps: {},
    appTs: [
      `import { Hono } from 'hono';`,
      `import { serveStatic } from '@hono/node-server/serve-static';`,
      `import type { Health } from '${shared}';`,
      ``,
      `export const app = new Hono();`,
      ``,
      `app.get('/api/health', (c) => {`,
      `\tconst body: Health = ${healthBody};`,
      `\treturn c.json(body);`,
      `});`,
      ``,
      `// In production the API also serves the built web app, so one process and`,
      `// one port covers the whole thing. In dev, Vite serves the app and proxies`,
      `// /api here instead (see apps/web/vite.config.ts).`,
      `if (process.env.NODE_ENV === 'production') {`,
      `\tapp.use('/*', serveStatic({ root: '../web/dist' }));`,
      `}`,
      ``,
    ].join('\n'),
    indexTs: [
      `import { serve } from '@hono/node-server';`,
      `import { app } from './app.js';`,
      ``,
      `const port = Number(process.env.PORT ?? 3000);`,
      `serve({ fetch: app.fetch, port });`,
      `console.log(\`Listening on http://localhost:\${port}\`);`,
      ``,
    ].join('\n'),
    appTestTs: [
      `import { describe, it, expect } from 'vitest';`,
      `import { app } from './app.js';`,
      ``,
      `describe('api', () => {`,
      `\tit('reports health', async () => {`,
      `\t\tconst res = await app.request('/api/health');`,
      `\t\texpect(res.status).toBe(200);`,
      `\t\texpect(await res.json()).toMatchObject({ ok: true });`,
      `\t});`,
      `});`,
      ``,
    ].join('\n'),
  };
}

function fullstackReadme(cfg, pm, shared) {
  const install = pm === 'npm' ? 'npm install' : `${pm} install`;
  const run = (s) => (pm === 'npm' ? `npm run ${s}` : `${pm} ${s}`);
  const serverLabel = { hono: 'Hono', fastify: 'Fastify', express: 'Express' }[cfg.serviceFramework || 'hono'];
  return [
    `# ${cfg.name}`,
    '',
    cfg.description || '_A full-stack monorepo scaffolded with [Packkit](https://packkit-web.pages.dev/)._',
    '',
    '## Layout',
    '',
    '```',
    'apps/web       React + Vite front end',
    `apps/server    ${serverLabel} API (also serves the web build in production)`,
    'packages/shared  types and helpers both sides import',
    '```',
    '',
    '## Develop',
    '',
    '```sh',
    install,
    run('dev') + '     # web on :5173, api on :3000',
    '```',
    '',
    `Vite proxies \`/api\` to the server, so requests are same-origin in development exactly as they are in production — no CORS, no environment-specific base URL.`,
    '',
    '## Production',
    '',
    '```sh',
    run('build'),
    run('start') + '   # one process serving the API and the built web app',
    '```',
    '',
    `\`${shared}\` is built before either app starts, so a change to a shared type surfaces as a type error on both sides rather than at runtime.`,
    '',
    ...ciFirstPushNote(cfg),
    cfg.license !== 'none' ? `## License\n\n${cfg.license}${cfg.author ? ' © ' + cfg.author : ''}\n` : '',
  ].join('\n');
}

// Root-level scaffolding shared by both monorepo layouts: workspace globs, the
// TypeScript base config, lint/format config, community files, CI, and
// provenance. Each layout adds its own root package.json, turbo tasks, and
// packages on top. Extracted so these aren't maintained twice.
function workspaceScaffold(cfg, { workspaceGlobs, tsconfigLib = ['ES2022'], lint }) {
  const files = {};
  // Reuse the package-agnostic root files (LICENSE, community, AGENTS.md, gitignore).
  for (const feat of [community, agents, gitfiles]) {
    if (feat.active(cfg)) Object.assign(files, feat.apply(cfg).files);
  }
  // Turborepo's local cache — never committed.
  if (files['.gitignore']) files['.gitignore'] += '\n# turborepo\n.turbo/\n';
  if (cfg.packageManager === 'pnpm') {
    files['pnpm-workspace.yaml'] = 'packages:\n' + workspaceGlobs.map((g) => `  - "${g}"\n`).join('');
  }
  files['tsconfig.base.json'] = toJson({
    $schema: 'https://json.schemastore.org/tsconfig',
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: tsconfigLib,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      noEmit: true,
    },
  });
  // Lint/format config (biome.json, or eslint.config.js + prettier) chosen by --lint.
  Object.assign(files, lint.files);
  files['.github/workflows/ci.yml'] = ciWorkflow(cfg, cfg.packageManager, { hasLint: !!lint.rootLint });
  // packkit.json is written by the caller, after every package exists, so its
  // baseline covers the whole project.
  return files;
}

// Lint/format realization for a workspace. ESLint runs per package under
// `turbo lint` (each package resolves the root flat config); Biome and oxlint
// run once from the workspace root across every package, which is how they are
// meant to be used and avoids per-package config. Mirrors features/lint.js so a
// monorepo treats a given --lint choice exactly as a single package does.
function monorepoLint(cfg) {
  const files = {};
  const rootDevDeps = {};
  const rootScripts = {};
  let rootLint = null; // root "lint" script (null → omit it, and CI skips lint)
  let perPackageLint = null; // each workspace package's "lint" script
  let turboLint = false; // include turbo's lint task (only ESLint runs per package)

  if (cfg.lint === 'none') {
    return { files, rootDevDeps, rootScripts, rootLint, perPackageLint, turboLint };
  }

  // Prettier is shared by ESLint and oxlint.
  if (cfg.lint === 'eslint-prettier' || cfg.lint === 'oxlint') {
    files['.prettierrc.json'] = toJson({ useTabs: true, singleQuote: true, semi: true, printWidth: 100, trailingComma: 'all' });
    files['.prettierignore'] = '**/dist\ncoverage\n';
    rootScripts.format = 'prettier --write .';
    rootScripts['format:check'] = 'prettier --check .';
    rootDevDeps.prettier = V.prettier;
  }

  if (cfg.lint === 'eslint-prettier') {
    files['eslint.config.js'] = [
      `import js from '@eslint/js';`,
      `import tseslint from 'typescript-eslint';`,
      ``,
      `export default tseslint.config(`,
      `\tjs.configs.recommended,`,
      `\t...tseslint.configs.recommended,`,
      `\t{ ignores: ['**/dist', '**/coverage'] },`,
      `);`,
      ``,
    ].join('\n');
    rootDevDeps.eslint = V.eslint;
    rootDevDeps['@eslint/js'] = V['@eslint/js'];
    rootDevDeps['typescript-eslint'] = V['typescript-eslint'];
    perPackageLint = 'eslint .';
    rootLint = 'turbo lint';
    turboLint = true;
  } else if (cfg.lint === 'oxlint') {
    rootDevDeps.oxlint = V.oxlint;
    rootScripts['lint:fix'] = 'oxlint --fix';
    rootLint = 'oxlint';
  } else if (cfg.lint === 'biome') {
    files['biome.json'] = toJson({
      $schema: 'https://biomejs.dev/schemas/2.1.2/schema.json',
      formatter: { enabled: true, indentStyle: 'tab', lineWidth: 100 },
      linter: { enabled: true },
      javascript: { formatter: { quoteStyle: 'single', trailingCommas: 'all' } },
    });
    rootDevDeps['@biomejs/biome'] = V['@biomejs/biome'];
    rootScripts['lint:fix'] = 'biome lint --write .';
    rootScripts.format = 'biome format --write .';
    rootLint = 'biome lint .';
  }

  return { files, rootDevDeps, rootScripts, rootLint, perPackageLint, turboLint };
}

function addPackage(files, { name, dir, src, test, deps, lintScript }) {
  const pkg = {
    name,
    version: '0.0.0',
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    exports: { '.': { types: './dist/index.d.ts', default: './dist/index.js' } },
    files: ['dist'],
    scripts: {
      build: 'tsup src/index.ts --format esm --dts --clean',
      dev: 'tsup src/index.ts --format esm --dts --watch',
      test: 'vitest run',
      typecheck: 'tsc --noEmit',
      ...(lintScript ? { lint: lintScript } : {}),
    },
    ...(Object.keys(deps).length ? { dependencies: deps } : {}),
  };
  files[`${dir}/package.json`] = toJson(pkg);
  files[`${dir}/tsconfig.json`] = toJson({ extends: '../../tsconfig.base.json', include: ['src'] });
  files[`${dir}/src/index.ts`] = src;
  files[`${dir}/src/index.test.ts`] = test;
}

function exampleTest(importLine, assertion) {
  return [`import { describe, it, expect } from 'vitest';`, importLine, ``, `describe('example', () => {`, `\tit('works', () => {`, `\t\t${assertion};`, `\t});`, `});`, ``].join('\n');
}

function ciWorkflow(cfg, pm, { hasLint = true } = {}) {
  const setup = ['      - uses: actions/checkout@v7'];
  if (pm === 'pnpm') setup.push('      - uses: pnpm/action-setup@v6');
  setup.push(
    '      - uses: actions/setup-node@v7',
    '        with:',
    `          node-version: '${cfg.nodeVersion}'`,
    `          cache: '${pm === 'yarn' ? 'yarn' : pm === 'pnpm' ? 'pnpm' : 'npm'}'`,
  );
  const install = pm === 'npm' ? 'npm ci' : pm === 'pnpm' ? 'pnpm install --frozen-lockfile' : `${pm} install --frozen-lockfile`;
  const run = (s) => (pm === 'npm' ? `npm run ${s}` : `${pm} ${s}`);
  return [
    'name: CI',
    'on:',
    '  push:',
    '    branches: [main]',
    '  pull_request:',
    'jobs:',
    '  ci:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    setup.join('\n'),
    `      - run: ${install}`,
    `      - run: ${run('typecheck')}`,
    ...(hasLint ? [`      - run: ${run('lint')}`] : []),
    `      - run: ${run('test')}`,
    `      - run: ${run('build')}`,
    '',
  ].join('\n');
}

function rootReadme(cfg, pm, core, utils) {
  const install = pm === 'npm' ? 'npm install' : `${pm} install`;
  const run = (s) => (pm === 'npm' ? `npm run ${s}` : `${pm} ${s}`);
  return [
    `# ${cfg.name}`,
    '',
    cfg.description || '_A monorepo scaffolded with [Packkit](https://packkit-web.pages.dev/)._',
    '',
    '## Packages',
    '',
    `- \`${core}\` — the core library`,
    `- \`${utils}\` — utilities built on \`${core}\``,
    '',
    '## Develop',
    '',
    '```sh',
    install,
    run('build') + '     # build all packages (Turborepo)',
    run('test'),
    '```',
    '',
    ...ciFirstPushNote(cfg),
    cfg.license !== 'none' ? `## License\n\n${cfg.license}${cfg.author ? ' © ' + cfg.author : ''}\n` : '',
  ].join('\n');
}
