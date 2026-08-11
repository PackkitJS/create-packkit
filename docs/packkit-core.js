// src/core/node-versions.js
var NODE_LINES = {
  "24": { version: "24.18.0", status: "active-lts", codename: "Krypton", label: '24 (Active LTS, "Krypton")' },
  "22": { version: "22.23.1", status: "maintenance", codename: "Jod", label: '22 (Maintenance LTS, "Jod")' },
  "26": { version: "26.5.0", status: "current", codename: null, label: "26 (Current)" }
};
var DEFAULT_NODE = "24";

// src/core/node.js
var ENGINE_MIN = { 18: "18.18.0", 20: "20.19.0", 22: "22.13.0" };
var engineFloor = (v) => ENGINE_MIN[v] || `${v}.0.0`;
var nodePin = (v) => NODE_LINES[v]?.version || engineFloor(v);

// src/core/options.js
var NODE_CHOICES = Object.entries(NODE_LINES).map(([value, info]) => ({ value, label: info.label }));
var OPTIONS = {
  // ---- package metadata ----
  name: { group: "meta", type: "text", label: "Package name", default: "my-package" },
  description: { group: "meta", type: "text", label: "Description", default: "" },
  author: { group: "meta", type: "text", label: "Author", default: "" },
  keywords: { group: "meta", type: "text", label: "Keywords (comma-separated)", default: "" },
  repo: { group: "meta", type: "text", label: "Repository URL", default: "" },
  // ---- core shape ----
  language: {
    group: "core",
    type: "select",
    label: "Language",
    default: "ts",
    choices: [
      { value: "ts", label: "TypeScript (strict)" },
      { value: "js", label: "JavaScript (ESM)" }
    ]
  },
  moduleFormat: {
    group: "core",
    type: "select",
    label: "Module format",
    default: "esm",
    choices: [
      { value: "esm", label: "ESM only (recommended)" },
      { value: "dual", label: "Dual (ESM + CJS)" },
      { value: "cjs", label: "CommonJS only" }
    ]
  },
  serviceFramework: {
    group: "core",
    type: "select",
    label: "Service framework (HTTP service)",
    default: "hono",
    // Applies to the service target, and to the fullstack monorepo (whose
    // apps/server honors it too).
    when: (cfg) => cfg.target?.includes("service") || cfg.monorepoLayout === "fullstack",
    choices: [
      { value: "hono", label: "Hono (fast, web-standard)" },
      { value: "fastify", label: "Fastify" },
      { value: "express", label: "Express" }
    ]
  },
  target: {
    group: "core",
    type: "multiselect",
    label: "What are you building?",
    default: ["library"],
    choices: [
      { value: "library", label: "Library (importable package)" },
      { value: "cli", label: "CLI tool (ships a bin)" },
      { value: "service", label: "HTTP service (Hono)" },
      { value: "app", label: "App (Vite SPA)" }
    ]
  },
  monorepo: {
    group: "core",
    type: "boolean",
    label: "Monorepo (pnpm/Turborepo workspace)",
    default: false
  },
  monorepoLayout: {
    group: "core",
    type: "select",
    label: "Monorepo layout",
    default: "libraries",
    when: (cfg) => cfg.monorepo,
    choices: [
      { value: "libraries", label: "Libraries \u2014 linked packages you publish" },
      { value: "fullstack", label: "Full-stack app \u2014 web + server + shared" }
    ]
  },
  framework: {
    group: "core",
    type: "select",
    label: "Framework",
    default: "none",
    choices: [
      { value: "none", label: "None (plain package)" },
      { value: "react", label: "React" },
      { value: "vue", label: "Vue" },
      { value: "svelte", label: "Svelte" }
    ]
  },
  packageManager: {
    group: "core",
    type: "select",
    label: "Package manager",
    default: "npm",
    choices: [
      { value: "npm", label: "npm" },
      { value: "pnpm", label: "pnpm" },
      { value: "yarn", label: "yarn" },
      { value: "bun", label: "bun" }
    ]
  },
  nodeVersion: {
    group: "core",
    type: "select",
    label: "Node version",
    default: DEFAULT_NODE,
    choices: NODE_CHOICES
  },
  // ---- build ----
  bundler: {
    group: "build",
    type: "select",
    label: "Bundler / build",
    default: "tsup",
    choices: [
      { value: "tsup", label: "tsup (esbuild \u2014 recommended)" },
      { value: "tsdown", label: "tsdown (Rolldown \u2014 fast successor)" },
      { value: "unbuild", label: "unbuild (UnJS)" },
      { value: "rollup", label: "Rollup" },
      { value: "none", label: "None (tsc / no build)" }
    ]
  },
  minify: {
    group: "build",
    type: "boolean",
    label: "Minify output (best for CLIs / browser bundles)",
    default: false
  },
  // ---- testing ----
  test: {
    group: "quality",
    type: "select",
    label: "Test runner",
    default: "vitest",
    choices: [
      { value: "vitest", label: "Vitest (recommended)" },
      { value: "jest", label: "Jest" },
      { value: "node", label: "node:test (built-in)" },
      { value: "none", label: "None" }
    ]
  },
  coverage: { group: "quality", type: "boolean", label: "Coverage reporting", default: true },
  storybook: { group: "quality", type: "boolean", label: "Storybook (component libraries)", default: false },
  e2e: { group: "quality", type: "boolean", label: "Playwright end-to-end tests (apps)", default: false },
  sourcemaps: { group: "build", type: "boolean", label: "Sourcemaps + ship source (debug into original code)", default: true },
  env: { group: "quality", type: "boolean", label: "Type-safe env validation (Zod) \u2014 services & CLIs", default: false },
  canary: { group: "release", type: "boolean", label: "Snapshot / canary release workflow (Changesets)", default: false },
  pkgChecks: { group: "quality", type: "boolean", label: "Package checks (publint + are-the-types-wrong)", default: false },
  knip: { group: "quality", type: "boolean", label: "Knip (unused files / deps / exports)", default: false },
  sizeLimit: { group: "quality", type: "boolean", label: "size-limit (bundle-size budget, libraries)", default: false },
  doctor: { group: "quality", type: "boolean", label: "Env doctor (warn on Node / package-manager mismatch)", default: false },
  // ---- lint / format ----
  lint: {
    group: "quality",
    type: "select",
    label: "Lint / format",
    default: "eslint-prettier",
    choices: [
      { value: "eslint-prettier", label: "ESLint + Prettier (recommended)" },
      { value: "biome", label: "Biome (all-in-one)" },
      { value: "oxlint", label: "oxlint + Prettier (fast)" },
      { value: "none", label: "None" }
    ]
  },
  // ---- git hooks ----
  gitHooks: {
    group: "quality",
    type: "select",
    label: "Git hooks",
    default: "simple-git-hooks",
    choices: [
      { value: "simple-git-hooks", label: "simple-git-hooks (light)" },
      { value: "husky", label: "husky + lint-staged" },
      { value: "lefthook", label: "lefthook" },
      { value: "none", label: "None" }
    ]
  },
  // ---- release ----
  release: {
    group: "release",
    type: "select",
    label: "Release / versioning",
    default: "changesets",
    choices: [
      { value: "changesets", label: "Changesets (recommended)" },
      { value: "release-it", label: "release-it" },
      { value: "np", label: "np" },
      { value: "none", label: "None" }
    ]
  },
  jsr: { group: "release", type: "boolean", label: "Publish to JSR (TS-first registry)", default: false },
  // ---- github actions (configurable workflows) ----
  workflows: {
    group: "ci",
    type: "multiselect",
    label: "GitHub Actions",
    default: ["ci", "npm-publish"],
    choices: [
      { value: "ci", label: "CI (typecheck + lint + test + build)" },
      { value: "npm-publish", label: "Publish to npm (provenance / OIDC)" },
      { value: "pages", label: "Deploy GitHub Pages" },
      { value: "codeql", label: "CodeQL security scan" },
      { value: "codecov", label: "Upload coverage to Codecov" },
      { value: "stale", label: "Stale issue/PR bot" }
    ]
  },
  deps: {
    group: "ci",
    type: "select",
    label: "Dependency updates",
    default: "renovate",
    choices: [
      { value: "renovate", label: "Renovate" },
      { value: "dependabot", label: "Dependabot" },
      { value: "none", label: "None" }
    ]
  },
  // ---- repo hygiene ----
  license: {
    group: "repo",
    type: "select",
    label: "License",
    default: "MIT",
    choices: [
      { value: "MIT", label: "MIT" },
      { value: "Apache-2.0", label: "Apache-2.0" },
      { value: "ISC", label: "ISC" },
      { value: "none", label: "None" }
    ]
  },
  community: { group: "repo", type: "boolean", label: "Community files (CONTRIBUTING, CoC, SECURITY, templates)", default: true },
  agents: { group: "repo", type: "boolean", label: "AI agent instructions (AGENTS.md + CLAUDE.md)", default: true },
  vscode: { group: "repo", type: "boolean", label: "VS Code settings + extensions", default: true },
  editorconfig: { group: "repo", type: "boolean", label: ".editorconfig", default: true },
  gitInit: { group: "repo", type: "boolean", label: "git init + initial commit", default: true },
  install: { group: "repo", type: "boolean", label: "Install dependencies", default: true }
};
var GROUPS = [
  { id: "meta", label: "Package" },
  { id: "core", label: "Core" },
  { id: "build", label: "Build" },
  { id: "quality", label: "Quality" },
  { id: "release", label: "Release" },
  { id: "ci", label: "CI / CD" },
  { id: "repo", label: "Repository" }
];
var OPTION_HELP = {
  name: "The npm package name. Scoped names like `@you/pkg` are fine.",
  description: "One-line summary \u2014 used in package.json and the README heading.",
  author: "Your name (and optionally email/URL). Populates package.json + LICENSE.",
  keywords: "Comma-separated npm keywords to help people discover the package.",
  repo: "Git repository URL. Wires up repository/bugs/homepage links and CI badges.",
  language: "TypeScript (strict, recommended) or plain ESM JavaScript. TS gives you types, editor help, and generated .d.ts for consumers.",
  moduleFormat: "How the package is consumed. ESM-only (default) is the modern, leanest choice \u2014 Node 20.19+/22.12+ can `require()` ESM. Pick dual only if you must support older CJS-only consumers; cjs-only is rarely needed.",
  target: "What you are building \u2014 mix and match: a library (importable package), a CLI (ships a bin), an HTTP service, or an app (Vite SPA).",
  serviceFramework: "For the service target: Hono (fast, web-standard, tiny \u2014 default), Fastify (batteries-included, plugins, schema validation), or Express (ubiquitous, huge ecosystem).",
  monorepoLayout: 'What the workspace contains. "libraries" gives linked packages you publish (Changesets). "fullstack" gives apps/web (React+Vite) + apps/server (Hono by default; --server for Fastify/Express) + packages/shared, wired together, with the server serving the web build in production.',
  monorepo: "Generate a pnpm + Turborepo workspace with two linked example packages and Changesets. Only worth it when \u22652 packages share code.",
  framework: "UI framework for component libraries and apps: React, Vue, or Svelte (or none for a plain package).",
  packageManager: "Which package manager the scripts, lockfile, and CI target: npm, pnpm, yarn, or bun.",
  nodeVersion: "Minimum Node line to support. Choices track Node\u2019s own release schedule (Active LTS is the default); this sets engines + .nvmrc.",
  bundler: "How the library is built. tsup (default, esbuild-fast) and tsdown suit most libs; unbuild for zero-config; rollup for full control; none = tsc-only (or no build).",
  minify: "Minify the build output. Best for CLIs and browser bundles; usually unnecessary for libraries (consumers minify).",
  sourcemaps: "Ship source + JS/declaration maps so consumers can step into and go-to-definition on your original code when debugging. On by default for libraries.",
  test: "Test runner: Vitest (fast, Vite-native, default), Jest (classic, huge ecosystem), or Node\u2019s built-in node:test (zero deps).",
  coverage: "Collect code-coverage reports (v8) and add a `coverage` script. Pairs with the Codecov workflow.",
  storybook: "Add Storybook to develop and document components in isolation. Component libraries only.",
  e2e: "Add Playwright end-to-end tests for app targets: a config that boots your dev server, an example spec, and a CI job.",
  sizeLimit: "Add a bundle-size budget (size-limit) that measures your built entry and fails CI if it exceeds the limit \u2014 catches accidental bloat.",
  doctor: "Add an env doctor (`npm run doctor`) that warns when the local Node / package manager don\u2019t match what the project expects. Warn-only.",
  env: "Type-safe environment variables: a Zod-validated `src/env.ts` that fails fast on misconfig, plus a `.env.example`. For services and CLIs.",
  pkgChecks: "Verify the published package is correct with publint + are-the-types-wrong (exports map, types resolution, ESM/CJS). Highly recommended for libraries.",
  knip: "Find unused files, dependencies, and exports so the project doesn\u2019t accumulate dead weight.",
  lint: "Linter + formatter: ESLint + Prettier (default, most compatible), Biome (one fast tool for both), or oxlint (Rust-fast linting).",
  gitHooks: "Pre-commit hooks that run lint-staged: simple-git-hooks (tiny, default), husky (popular), or lefthook (fast, parallel).",
  release: "How you version + publish: Changesets (default, great for libraries and monorepos), release-it, np, or none.",
  canary: "Add a workflow that publishes snapshot builds (x.y.z-canary-<hash>) to a `canary` dist-tag so people can test unreleased changes. Requires Changesets.",
  jsr: "Also publish to JSR, the TypeScript-first registry. For plain ESM TypeScript libraries.",
  workflows: "GitHub Actions to include: ci (lint/test/build), npm-publish (provenance), pages (deploy Storybook/site), codeql (security), codecov (coverage), stale.",
  deps: "Automated dependency updates: Renovate (default, powerful) or Dependabot (built into GitHub).",
  license: "Open-source license for the LICENSE file and package.json (MIT recommended), or none.",
  community: "Community health files: CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, and issue/PR templates.",
  agents: "AI-agent instructions (AGENTS.md + CLAUDE.md) so coding agents know how to build, test, and work in the repo.",
  vscode: "VS Code workspace settings + recommended-extensions so the repo is set up consistently on open.",
  editorconfig: "An .editorconfig so every editor uses the same indentation and line endings.",
  gitInit: "Run `git init` and make an initial commit after scaffolding.",
  install: "Install dependencies automatically after scaffolding."
};
function defaultConfig() {
  const cfg = {};
  for (const [key, opt] of Object.entries(OPTIONS)) {
    cfg[key] = Array.isArray(opt.default) ? [...opt.default] : opt.default;
  }
  return cfg;
}
function normalizeConfig(input = {}, diagnostics = null) {
  const cfg = { ...defaultConfig(), ...input };
  const requested = new Set(Object.keys(input));
  const coerce = (field, value, code, message, severity = "warning") => {
    const same = JSON.stringify(cfg[field]) === JSON.stringify(value);
    if (same) return;
    const previousValue = cfg[field];
    cfg[field] = value;
    if (diagnostics && requested.has(field)) {
      diagnostics.push({ severity, code, field, previousValue, resolvedValue: value, message, source: "normalize" });
    }
  };
  if (!Array.isArray(cfg.target) || cfg.target.length === 0) {
    coerce("target", ["library"], "TARGET_DEFAULTED", 'No target was given, so "library" was used.', "info");
  }
  if (!Array.isArray(cfg.workflows)) coerce("workflows", [], "WORKFLOWS_DEFAULTED", "workflows was not a list, so it was reset to none.", "info");
  if (cfg.bundler === "none") coerce("minify", false, "MINIFY_REQUIRES_BUNDLER", "Minify was disabled because no bundler produces output to minify.");
  if (cfg.test === "none" || cfg.test === "node") coerce("coverage", false, "COVERAGE_UNSUPPORTED_RUNNER", `Coverage was disabled because the "${cfg.test}" test runner does not report it.`);
  if (cfg.workflows.includes("codecov")) coerce("coverage", true, "COVERAGE_FORCED_BY_CODECOV", "Coverage was enabled because the Codecov workflow requires it.", "info");
  cfg.isReact = cfg.framework === "react";
  cfg.isVue = cfg.framework === "vue";
  cfg.isSvelte = cfg.framework === "svelte";
  cfg.hasFramework = cfg.framework !== "none";
  cfg.hasApp = cfg.target.includes("app");
  if (cfg.hasFramework && !cfg.hasApp && !cfg.target.includes("library")) {
    coerce("target", ["library", ...cfg.target], "TARGET_LIBRARY_ADDED", 'A "library" target was added because a component framework needs something to build.', "info");
  }
  cfg.isTs = cfg.language === "ts";
  cfg.ext = cfg.isTs ? "ts" : "js";
  cfg.srcExt = cfg.isReact ? cfg.isTs ? "tsx" : "jsx" : cfg.ext;
  cfg.hasLibrary = cfg.target.includes("library");
  cfg.hasCli = cfg.target.includes("cli");
  cfg.hasService = cfg.target.includes("service");
  cfg.viteBuild = cfg.hasApp || cfg.isVue;
  cfg.svelteLib = cfg.isSvelte && !cfg.hasApp;
  cfg.customBuild = cfg.viteBuild || cfg.svelteLib;
  cfg.usesVite = cfg.viteBuild || cfg.isSvelte;
  cfg.hasBuild = cfg.viteBuild || !cfg.svelteLib && (cfg.bundler !== "none" || cfg.isTs);
  if (cfg.hasApp) coerce("moduleFormat", "esm", "MODULE_FORMAT_FORCED_FOR_APP", "An app is bundled, not published, so its module format is ESM.", "info");
  cfg.hasEsm = cfg.moduleFormat === "esm" || cfg.moduleFormat === "dual";
  cfg.hasCjs = cfg.moduleFormat === "cjs" || cfg.moduleFormat === "dual";
  if (!cfg.hasFramework || cfg.hasApp || !cfg.hasLibrary) coerce("storybook", false, "STORYBOOK_REQUIRES_COMPONENT_LIBRARY", "Storybook was disabled because it only applies to a component library.");
  if (!cfg.hasApp) coerce("e2e", false, "E2E_REQUIRES_APP", "End-to-end tests were disabled because they only apply to an app target.");
  if (cfg.monorepo) cfg.hasBuild = true;
  cfg.publishable = (cfg.hasLibrary || cfg.hasCli) && !cfg.hasApp && !cfg.hasService;
  if (!cfg.publishable) coerce("pkgChecks", false, "PKG_CHECKS_REQUIRES_PUBLISHABLE", "Package-correctness checks were disabled because this project is not published to npm.");
  if (!cfg.publishable) coerce("sourcemaps", false, "SOURCEMAPS_REQUIRES_PUBLISHABLE", "Sourcemaps were disabled because this project is not published to npm.");
  if (!(cfg.publishable && cfg.hasBuild)) coerce("sizeLimit", false, "SIZE_LIMIT_REQUIRES_BUILT_LIBRARY", "The bundle-size budget was disabled because it needs a published package with a build.");
  if (!(cfg.hasService || cfg.hasCli)) coerce("env", false, "ENV_REQUIRES_SERVICE_OR_CLI", "Env validation was disabled because it only applies to a service or CLI.");
  if (cfg.release !== "changesets") coerce("canary", false, "CANARY_REQUIRES_CHANGESETS", "Canary releases were disabled because they require the Changesets release flow.");
  if (!(cfg.isTs && cfg.hasLibrary && !cfg.hasFramework && !cfg.hasApp)) coerce("jsr", false, "JSR_REQUIRES_PLAIN_TS_LIBRARY", "JSR publishing was disabled because it applies only to a plain TypeScript library.");
  cfg.resolved = resolvedView(cfg);
  return cfg;
}
function resolvedView(cfg) {
  return {
    targets: { library: cfg.hasLibrary, cli: cfg.hasCli, service: cfg.hasService, app: cfg.hasApp },
    language: { typescript: cfg.isTs, ext: cfg.ext, srcExt: cfg.srcExt },
    framework: { name: cfg.framework, react: cfg.isReact, vue: cfg.isVue, svelte: cfg.isSvelte, any: cfg.hasFramework },
    build: { vite: cfg.viteBuild, custom: cfg.customBuild, usesVite: cfg.usesVite, has: cfg.hasBuild },
    module: { format: cfg.moduleFormat, esm: cfg.hasEsm, cjs: cfg.hasCjs },
    package: { publishable: cfg.publishable, monorepo: cfg.monorepo }
  };
}

// ../packkit-core/dist/index.js
function contentHash(str) {
  let h1 = 3735928559;
  let h2 = 1103547991;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507);
  h1 ^= Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507);
  h2 ^= Math.imul(h1 ^ h1 >>> 13, 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, "0");
}
function toJson(value) {
  return `${JSON.stringify(value, null, 2)}
`;
}

// src/core/render.js
var UNSAFE_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [.../* @__PURE__ */ new Set([...target, ...source])];
  }
  if (isPlainObject(target) && isPlainObject(source)) {
    const out = { ...target };
    for (const [k, v] of Object.entries(source)) {
      if (UNSAFE_KEYS.has(k)) continue;
      out[k] = k in target ? deepMerge(target[k], v) : v;
    }
    return out;
  }
  return source;
}
function isPlainObject(v) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

// src/core/pkg.js
var KEY_ORDER = [
  "name",
  "version",
  "description",
  "keywords",
  "homepage",
  "bugs",
  "repository",
  "license",
  "author",
  "type",
  "exports",
  "main",
  "module",
  "types",
  "bin",
  "files",
  "engines",
  "packageManager",
  "scripts",
  "simple-git-hooks",
  "lint-staged",
  "dependencies",
  "peerDependencies",
  "devDependencies",
  "publishConfig"
];
function finalizePackageJson(pkg) {
  const out = {};
  for (const key of KEY_ORDER) {
    if (pkg[key] === void 0) continue;
    out[key] = isDepMap(key) ? sortKeys(pkg[key]) : pkg[key];
  }
  for (const key of Object.keys(pkg)) {
    if (!(key in out)) out[key] = pkg[key];
  }
  return out;
}
function isDepMap(key) {
  return key === "dependencies" || key === "devDependencies" || key === "peerDependencies";
}
function sortKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

// src/core/features/meta.js
var meta_default = {
  id: "meta",
  active: () => true,
  apply(cfg) {
    const files = {};
    const pkg = {
      name: cfg.name,
      version: "0.0.0",
      description: cfg.description || "",
      type: cfg.moduleFormat === "cjs" ? "commonjs" : "module",
      engines: { node: `>=${engineFloor(cfg.nodeVersion)}` },
      scripts: {}
    };
    const kw = String(cfg.keywords || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (kw.length) pkg.keywords = kw;
    if (cfg.license !== "none") pkg.license = cfg.license;
    if (cfg.author) pkg.author = cfg.author;
    if (cfg.repo) {
      pkg.repository = { type: "git", url: `git+${cfg.repo.replace(/\.git$/, "")}.git` };
      pkg.bugs = { url: `${cfg.repo.replace(/\.git$/, "")}/issues` };
      pkg.homepage = `${cfg.repo.replace(/\.git$/, "")}#readme`;
    }
    if (cfg.hasLibrary && !cfg.hasFramework) {
      files[`src/index.${cfg.ext}`] = libraryEntry(cfg);
    }
    files["README.md"] = readme(cfg);
    files[".nvmrc"] = `${nodePin(cfg.nodeVersion)}
`;
    if (cfg.isTs) {
      pkg.scripts.typecheck = cfg.isVue ? "vue-tsc --noEmit" : cfg.isSvelte ? "svelte-check --tsconfig ./tsconfig.json" : "tsc --noEmit";
    }
    return { files, pkg };
  }
};
function libraryEntry(cfg) {
  if (cfg.isTs) {
    return [
      `/** Greet someone by name. */`,
      `export function greet(name: string): string {`,
      `	return \`Hello, \${name}!\`;`,
      `}`,
      ``
    ].join("\n");
  }
  return [
    `/**`,
    ` * Greet someone by name.`,
    ` * @param {string} name`,
    ` * @returns {string}`,
    ` */`,
    `export function greet(name) {`,
    `	return \`Hello, \${name}!\`;`,
    `}`,
    ``
  ].join("\n");
}
function run(cfg, script2) {
  return cfg.packageManager === "npm" ? `npm run ${script2}` : `${cfg.packageManager} ${script2}`;
}
function makeBadges(cfg) {
  const badges = [];
  const publishable = (cfg.hasLibrary || cfg.hasCli) && !cfg.hasApp && !cfg.hasService;
  if (publishable) {
    const enc = encodeURIComponent(cfg.name);
    badges.push(`[![npm](https://img.shields.io/npm/v/${enc}.svg)](https://www.npmjs.com/package/${cfg.name})`);
  }
  const repo = cfg.repo ? cfg.repo.replace(/\.git$/, "") : "";
  if (repo && (cfg.workflows || []).includes("ci")) {
    badges.push(`[![CI](${repo}/actions/workflows/ci.yml/badge.svg)](${repo}/actions/workflows/ci.yml)`);
  }
  if (cfg.license !== "none") {
    badges.push(`[![License: ${cfg.license}](https://img.shields.io/badge/license-${encodeURIComponent(cfg.license)}-blue.svg)](LICENSE)`);
  }
  return badges.join(" ");
}
function readme(cfg) {
  const install = {
    npm: `npm install ${cfg.name}`,
    pnpm: `pnpm add ${cfg.name}`,
    yarn: `yarn add ${cfg.name}`,
    bun: `bun add ${cfg.name}`
  }[cfg.packageManager];
  const lines = [
    `# ${cfg.name}`,
    "",
    cfg.description || "_A modern package scaffolded with [Packkit](https://packkitjs.github.io/create-packkit/)._",
    ""
  ];
  const badges = makeBadges(cfg);
  if (badges) lines.push(badges, "");
  lines.push(
    "## Requirements",
    "",
    `Node.js >= ${engineFloor(cfg.nodeVersion)} (\`.nvmrc\` pins ${nodePin(cfg.nodeVersion)}; run \`nvm use\`). Enforced via \`engine-strict\`, so installs fail fast on an unsupported version.`,
    ""
  );
  lines.push("## Install", "", "```sh", install, "```", "");
  if (cfg.hasApp) {
    lines.push("## Develop", "", "```sh", run(cfg, "dev") + "     # start the dev server", run(cfg, "build") + "   # production build", "```", "");
  } else if (cfg.hasLibrary && cfg.isReact) {
    lines.push(
      "## Usage",
      "",
      "```" + (cfg.isTs ? "tsx" : "jsx"),
      `import { Button } from '${cfg.name}';`,
      "",
      `<Button label="Click me" />`,
      "```",
      ""
    );
  } else if (cfg.hasLibrary && cfg.isVue) {
    lines.push(
      "## Usage",
      "",
      "```" + (cfg.isTs ? "ts" : "js"),
      `import { Button } from '${cfg.name}';`,
      '// then <Button label="Click me" /> in your template',
      "```",
      ""
    );
  } else if (cfg.hasLibrary && cfg.isSvelte) {
    lines.push(
      "## Usage",
      "",
      "```svelte",
      `<script>import { Button } from '${cfg.name}';<\/script>`,
      "",
      `<Button label="Click me" />`,
      "```",
      ""
    );
  } else if (cfg.hasLibrary) {
    const imp = cfg.isTs || cfg.hasEsm ? `import { greet } from '${cfg.name}';` : `const { greet } = require('${cfg.name}');`;
    lines.push("## Usage", "", "```" + (cfg.isTs ? "ts" : "js"), imp, "", `greet('world'); // "Hello, world!"`, "```", "");
  }
  if (cfg.hasCli) {
    lines.push("## CLI", "", "```sh", `npx ${cfg.name} --help`, "```", "");
  }
  if (cfg.workflows?.includes("npm-publish")) {
    const changesets = cfg.release === "changesets";
    lines.push(
      "## Releasing",
      "",
      changesets ? "Releases are handled by the `Release` workflow: push a changeset (`npx changeset`) and it opens a version PR, then publishes when that PR merges." : "Pushing a `v*` tag triggers the `Publish` workflow, which publishes to npm with provenance.",
      "",
      "**Publishing needs npm credentials, which a new repository does not have.** Either:",
      "",
      "- Set up [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) \u2014 no secret to store or rotate, and the recommended option; or",
      "- Add an [npm automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens) as an `NPM_TOKEN` repository secret.",
      "",
      changesets ? "Until one of those is in place the `Release` workflow will fail with `ENEEDAUTH` on every push. That is expected on a brand-new repo." : "Until one of those is in place, tag pushes will fail with `ENEEDAUTH`.",
      ""
    );
  }
  lines.push("## License", "", cfg.license === "none" ? "Unlicensed." : `${cfg.license}${cfg.author ? " \xA9 " + cfg.author : ""}`, "");
  return lines.join("\n");
}

// src/core/versions.js
var V = {
  // toolchain
  typescript: "^5.9.3",
  "typescript-eslint": "^8.0.0",
  eslint: "^10.0.0",
  "@eslint/js": "^10.0.0",
  prettier: "^3.3.0",
  "@biomejs/biome": "^2.0.0",
  oxlint: "^1.0.0",
  turbo: "^2.0.0",
  rimraf: "^6.0.0",
  "@types/node": "^24.0.0",
  // build
  tsup: "^8.0.0",
  tsdown: "^0.6.0",
  unbuild: "^3.0.0",
  rollup: "^4.0.0",
  "@rollup/plugin-typescript": "^12.0.0",
  "@rollup/plugin-terser": "^1.0.0",
  tslib: "^2.6.0",
  tsx: "^4.0.0",
  vite: "^8.0.0",
  "vite-plugin-dts": "^5.0.0",
  // test
  vitest: "^4.0.0",
  "@vitest/coverage-v8": "^4.0.0",
  jsdom: "^29.0.0",
  jest: "^30.0.0",
  "@types/jest": "^30.0.0",
  "ts-jest": "^29.0.0",
  supertest: "^7.0.0",
  "@types/supertest": "^6.0.0",
  "@playwright/test": "^1.50.0",
  // release / package checks
  "@changesets/cli": "^2.27.0",
  "release-it": "^21.0.0",
  np: "^12.0.0",
  publint: "^0.3.0",
  "@arethetypeswrong/cli": "^0.18.0",
  knip: "^5.0.0",
  "size-limit": "^11.0.0",
  "@size-limit/preset-small-lib": "^11.0.0",
  // git hooks
  "simple-git-hooks": "^2.11.0",
  husky: "^9.1.0",
  lefthook: "^2.0.0",
  "lint-staged": "^16.2.0",
  // react
  react: "^19.0.0",
  "react-dom": "^19.0.0",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "@vitejs/plugin-react": "^6.0.0",
  "@testing-library/react": "^16.0.0",
  "@testing-library/dom": "^10.0.0",
  // vue
  vue: "^3.4.0",
  "vue-tsc": "^3.0.0",
  "@vitejs/plugin-vue": "^6.0.0",
  "@testing-library/vue": "^8.1.0",
  // svelte
  svelte: "^5.0.0",
  "svelte-check": "^4.0.0",
  "@sveltejs/vite-plugin-svelte": "^7.0.0",
  "@testing-library/svelte": "^5.2.0",
  // storybook
  storybook: "^10.0.0",
  "@storybook/react": "^10.0.0",
  "@storybook/react-vite": "^10.0.0",
  "@storybook/vue3": "^10.0.0",
  "@storybook/vue3-vite": "^10.0.0",
  "@storybook/svelte": "^10.0.0",
  "@storybook/svelte-vite": "^10.0.0",
  // services
  hono: "^4.5.0",
  "@hono/node-server": "^2.0.0",
  fastify: "^5.0.0",
  "@fastify/static": "^8.0.0",
  express: "^5.0.0",
  "@types/express": "^5.0.0",
  zod: "^4.0.0"
};
var PEER = {
  react: ">=18",
  "react-dom": ">=18",
  vue: ">=3",
  svelte: ">=5"
};

// src/core/features/bundler.js
var bundler_default = {
  id: "bundler",
  active: (cfg) => !cfg.customBuild,
  // Vite / Svelte-lib own their own build wiring
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {} };
    const build = cfg.bundler !== "none";
    if (!build && !cfg.isTs) {
      pkg.files = ["src"];
      pkg.exports = { ".": `./src/index.js` };
      pkg.main = "./src/index.js";
      if (cfg.hasEsm) pkg.module = "./src/index.js";
    } else {
      pkg.files = ["dist"];
      if (cfg.sourcemaps) pkg.files.push("src");
      const esm = "./dist/index.js";
      const cjs = "./dist/index.cjs";
      const dtsEsm = "./dist/index.d.ts";
      const dtsCjs = cfg.moduleFormat === "dual" ? "./dist/index.d.cts" : dtsEsm;
      const exp = {};
      if (cfg.hasEsm) exp.import = cfg.isTs ? { types: dtsEsm, default: esm } : esm;
      if (cfg.hasCjs) exp.require = cfg.isTs ? { types: dtsCjs, default: cjs } : cjs;
      pkg.exports = { ".": exp };
      pkg.main = cfg.hasCjs ? cjs : esm;
      if (cfg.hasEsm) pkg.module = esm;
      if (cfg.isTs) pkg.types = cfg.hasEsm ? dtsEsm : dtsCjs;
    }
    const entries = ["src/index." + cfg.srcExt];
    if (cfg.hasCli) entries.push("src/cli." + cfg.ext);
    const formats = [cfg.hasEsm && "esm", cfg.hasCjs && "cjs"].filter(Boolean);
    if (cfg.bundler === "tsup" || cfg.bundler === "tsdown") {
      const tool = cfg.bundler;
      files[`${tool}.config.${cfg.ext}`] = tsupConfig(cfg, entries, formats, tool);
      pkg.scripts.build = tool;
      pkg.scripts.dev = `${tool} --watch`;
      pkg.devDependencies = { [tool]: tool === "tsup" ? V.tsup : V.tsdown };
      if (!cfg.isTs) pkg.devDependencies.typescript = V.typescript;
    } else if (cfg.bundler === "unbuild") {
      files["build.config.ts"] = unbuildConfig(cfg);
      pkg.scripts.build = "unbuild";
      pkg.scripts.dev = "unbuild --stub";
      pkg.devDependencies = { unbuild: V.unbuild };
    } else if (cfg.bundler === "rollup") {
      files["rollup.config.js"] = rollupConfig(cfg, formats);
      pkg.scripts.build = "rollup -c";
      pkg.scripts.dev = "rollup -c -w";
      pkg.devDependencies = {
        rollup: V.rollup,
        ...cfg.isTs ? { "@rollup/plugin-typescript": V["@rollup/plugin-typescript"], tslib: V.tslib } : {},
        ...cfg.minify ? { "@rollup/plugin-terser": V["@rollup/plugin-terser"] } : {}
      };
    } else if (cfg.bundler === "none" && cfg.isTs) {
      pkg.scripts.build = "tsc";
      pkg.scripts.dev = "tsc --watch";
    }
    if (cfg.hasService) delete pkg.scripts.dev;
    if (build) pkg.scripts.prepublishOnly = pkg.scripts.build;
    pkg.scripts.clean = "rimraf dist";
    if (build) pkg.devDependencies = { ...pkg.devDependencies, rimraf: V.rimraf };
    return { files, pkg };
  }
};
function tsupConfig(cfg, entries, formats, tool) {
  return [
    `import { defineConfig } from '${tool}';`,
    ``,
    `export default defineConfig({`,
    `	entry: [${entries.map((e) => `'${e}'`).join(", ")}],`,
    `	format: [${formats.map((f) => `'${f}'`).join(", ")}],`,
    cfg.isTs ? `	dts: true,` : null,
    `	sourcemap: true,`,
    `	clean: true,`,
    `	treeshake: true,`,
    cfg.minify ? `	minify: true,` : null,
    `});`,
    ``
  ].filter((l) => l !== null).join("\n");
}
function unbuildConfig(cfg) {
  return [
    `import { defineBuildConfig } from 'unbuild';`,
    ``,
    `export default defineBuildConfig({`,
    `	entries: ['src/index'],`,
    `	declaration: ${cfg.isTs},`,
    `	clean: true,`,
    `	failOnWarn: false,`,
    `	rollup: { emitCJS: ${cfg.hasCjs}${cfg.minify ? ", esbuild: { minify: true }" : ""} },`,
    `});`,
    ``
  ].join("\n");
}
function rollupConfig(cfg, formats) {
  const out = formats.map((f) => `		{ file: 'dist/index.${f === "cjs" ? "cjs" : "js"}', format: '${f}', sourcemap: true }`).join(",\n");
  const imports = [
    cfg.isTs ? `import typescript from '@rollup/plugin-typescript';` : null,
    cfg.minify ? `import terser from '@rollup/plugin-terser';` : null
  ].filter(Boolean);
  const plugins = [cfg.isTs ? `typescript({ declarationDir: 'dist', rootDir: 'src', exclude: ['**/*.test.ts'] })` : null, cfg.minify ? "terser()" : null].filter(Boolean);
  const pluginLine = plugins.length ? `
	plugins: [${plugins.join(", ")}],` : "";
  return [
    (imports.length ? imports.join("\n") + "\n" : "") + `export default {`,
    `	input: 'src/index.${cfg.ext}',`,
    `	output: [`,
    out,
    `	],${pluginLine}`,
    `};`,
    ``
  ].join("\n");
}

// src/core/features/typescript.js
var typescript_default = {
  id: "typescript",
  active: (cfg) => cfg.isTs,
  apply(cfg) {
    const noBuild = cfg.bundler === "none" && !cfg.customBuild;
    const webLibs = cfg.hasFramework || cfg.hasApp;
    const compilerOptions = {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      lib: webLibs ? ["ES2022", "DOM", "DOM.Iterable"] : ["ES2022"],
      ...cfg.isReact ? { jsx: "react-jsx" } : {},
      strict: true,
      noUncheckedIndexedAccess: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      verbatimModuleSyntax: cfg.bundler !== "none" && !cfg.hasFramework,
      declaration: true,
      // Declaration maps let editors jump from the published .d.ts into the
      // shipped .ts source (the bundler emits JS sourcemaps to match).
      ...cfg.sourcemaps ? { declarationMap: true } : {}
    };
    if (noBuild) {
      compilerOptions.moduleResolution = "NodeNext";
      compilerOptions.module = "NodeNext";
      compilerOptions.outDir = "dist";
      compilerOptions.rootDir = "src";
      if (cfg.sourcemaps) compilerOptions.sourceMap = true;
    } else {
      compilerOptions.noEmit = true;
    }
    return {
      files: {
        "tsconfig.json": toJson({
          $schema: "https://json.schemastore.org/tsconfig",
          compilerOptions,
          include: ["src"],
          exclude: ["dist", "node_modules"]
        })
      },
      pkg: {
        devDependencies: {
          typescript: V.typescript,
          "@types/node": `^${cfg.nodeVersion}.0.0`
        }
      }
    };
  }
};

// src/core/features/frameworks.js
var frameworks_default = {
  id: "frameworks",
  active: (cfg) => cfg.hasFramework,
  apply(cfg) {
    const files = {};
    const pkg = { devDependencies: {}, scripts: {} };
    const forApp = cfg.hasApp;
    if (cfg.isReact) react(cfg, files, pkg, forApp);
    else if (cfg.isVue) vue(cfg, files, pkg, forApp);
    else if (cfg.isSvelte) svelte(cfg, files, pkg, forApp);
    return { files, pkg };
  }
};
function react(cfg, files, pkg, forApp) {
  const x = cfg.isTs ? "tsx" : "jsx";
  if (forApp) {
    files["index.html"] = htmlShell(cfg, `/src/main.${x}`);
    files[`src/main.${x}`] = [
      `import { StrictMode } from 'react';`,
      `import { createRoot } from 'react-dom/client';`,
      `import { App } from './App.${x === "tsx" ? "js" : "js"}';`,
      ``,
      `createRoot(document.getElementById('root')${cfg.isTs ? "!" : ""}).render(`,
      `	<StrictMode><App /></StrictMode>,`,
      `);`,
      ``
    ].join("\n");
    files[`src/App.${x}`] = [
      `export function App() {`,
      `	return <h1>Hello from ${cfg.name}</h1>;`,
      `}`,
      ``
    ].join("\n");
    pkg.dependencies = { react: V.react, "react-dom": V["react-dom"] };
  } else {
    files[`src/index.${x}`] = cfg.isTs ? [
      `export interface ButtonProps {`,
      `	label: string;`,
      `	onClick?: () => void;`,
      `}`,
      ``,
      `export function Button({ label, onClick }: ButtonProps) {`,
      `	return <button onClick={onClick}>{label}</button>;`,
      `}`,
      ``
    ].join("\n") : [`export function Button({ label, onClick }) {`, `	return <button onClick={onClick}>{label}</button>;`, `}`, ``].join("\n");
    pkg.peerDependencies = { react: PEER.react, "react-dom": PEER["react-dom"] };
    pkg.devDependencies.react = V.react;
    pkg.devDependencies["react-dom"] = V["react-dom"];
  }
  if (cfg.isTs) {
    pkg.devDependencies["@types/react"] = V["@types/react"];
    pkg.devDependencies["@types/react-dom"] = V["@types/react-dom"];
  }
}
function vue(cfg, files, pkg, forApp) {
  const script2 = cfg.isTs ? `<script setup lang="ts">` : `<script setup>`;
  if (forApp) {
    files["index.html"] = htmlShell(cfg, `/src/main.${cfg.ext}`);
    files[`src/main.${cfg.ext}`] = [
      `import { createApp } from 'vue';`,
      `import App from './App.vue';`,
      ``,
      `createApp(App).mount('#root');`,
      ``
    ].join("\n");
    files["src/App.vue"] = [script2, `<\/script>`, ``, `<template>`, `	<h1>Hello from ${cfg.name}</h1>`, `</template>`, ``].join("\n");
    pkg.dependencies = { vue: V.vue };
  } else {
    files[`src/index.${cfg.ext}`] = `export { default as Button } from './Button.vue';
`;
    files["src/Button.vue"] = [
      script2,
      `defineProps${cfg.isTs ? "<{ label: string }>()" : "(['label'])"};`,
      `<\/script>`,
      ``,
      `<template>`,
      `	<button><slot>{{ label }}</slot></button>`,
      `</template>`,
      ``
    ].join("\n");
    pkg.peerDependencies = { vue: PEER.vue };
    pkg.devDependencies.vue = V.vue;
  }
}
function svelte(cfg, files, pkg, forApp) {
  const script2 = cfg.isTs ? `<script lang="ts">` : `<script>`;
  files["svelte.config.js"] = `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default { preprocess: vitePreprocess() };
`;
  pkg.devDependencies["@sveltejs/vite-plugin-svelte"] = V["@sveltejs/vite-plugin-svelte"];
  if (cfg.isTs) pkg.devDependencies["svelte-check"] = V["svelte-check"];
  if (forApp) {
    files["index.html"] = htmlShell(cfg, `/src/main.${cfg.ext}`);
    files[`src/main.${cfg.ext}`] = [
      `import { mount } from 'svelte';`,
      `import App from './App.svelte';`,
      ``,
      `const app = mount(App, { target: document.getElementById('root')${cfg.isTs ? "!" : ""} });`,
      `export default app;`,
      ``
    ].join("\n");
    files["src/App.svelte"] = [script2, `<\/script>`, ``, `<h1>Hello from ${cfg.name}</h1>`, ``].join("\n");
    pkg.dependencies = { svelte: V.svelte };
  } else {
    files[`src/index.${cfg.ext}`] = `export { default as Button } from './Button.svelte';
`;
    files["src/Button.svelte"] = [
      script2,
      cfg.isTs ? `	interface Props { label: string; }` : ``,
      cfg.isTs ? `	const { label }: Props = $props();` : `	const { label } = $props();`,
      `<\/script>`,
      ``,
      `<button>{label}</button>`,
      ``
    ].filter((l) => l !== ``).join("\n") + "\n";
    pkg.peerDependencies = { svelte: PEER.svelte };
    pkg.devDependencies.svelte = V.svelte;
    pkg.svelte = `./src/index.${cfg.ext}`;
    pkg.exports = { ".": { svelte: `./src/index.${cfg.ext}`, default: `./src/index.${cfg.ext}` } };
    pkg.files = ["src"];
    pkg.type = "module";
  }
}
function htmlShell(cfg, entry) {
  return [
    `<!doctype html>`,
    `<html lang="en">`,
    `	<head>`,
    `		<meta charset="UTF-8" />`,
    `		<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `		<title>${cfg.name}</title>`,
    `	</head>`,
    `	<body>`,
    `		<div id="root"></div>`,
    `		<script type="module" src="${entry}"><\/script>`,
    `	</body>`,
    `</html>`,
    ``
  ].join("\n");
}

// src/core/features/vite.js
var PLUGIN = {
  react: { import: `import react from '@vitejs/plugin-react';`, call: "react()", dep: { "@vitejs/plugin-react": V["@vitejs/plugin-react"] } },
  vue: { import: `import vue from '@vitejs/plugin-vue';`, call: "vue()", dep: { "@vitejs/plugin-vue": V["@vitejs/plugin-vue"] } },
  svelte: { import: `import { svelte } from '@sveltejs/vite-plugin-svelte';`, call: "svelte()", dep: { "@sveltejs/vite-plugin-svelte": V["@sveltejs/vite-plugin-svelte"] } }
};
var vite_default = {
  id: "vite",
  active: (cfg) => cfg.viteBuild,
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {}, devDependencies: { vite: V.vite } };
    const p = PLUGIN[cfg.framework];
    Object.assign(pkg.devDependencies, p.dep);
    if (cfg.isVue && cfg.isTs) pkg.devDependencies["vue-tsc"] = V["vue-tsc"];
    if (cfg.hasApp) {
      files[`vite.config.${cfg.ext}`] = [p.import, ``, `import { defineConfig } from 'vite';`, ``, `export default defineConfig({`, `	plugins: [${p.call}],`, `});`, ``].join("\n");
      pkg.private = true;
      pkg.scripts.dev = "vite";
      const precheck = cfg.isTs && cfg.isReact ? "tsc --noEmit && " : cfg.isTs && cfg.isVue ? "vue-tsc --noEmit && " : "";
      pkg.scripts.build = precheck + "vite build";
      pkg.scripts.preview = "vite preview";
    } else {
      files[`vite.config.${cfg.ext}`] = [
        p.import,
        `import dts from 'vite-plugin-dts';`,
        ``,
        `import { defineConfig } from 'vite';`,
        ``,
        `export default defineConfig({`,
        `	plugins: [${p.call}, dts({ rollupTypes: true })],`,
        `	build: {`,
        `		lib: { entry: 'src/index.${cfg.ext}', formats: ['es', 'cjs'], fileName: (f) => (f === 'es' ? 'index.js' : 'index.cjs') },`,
        `		rollupOptions: { external: ['vue'] },`,
        `	},`,
        `});`,
        ``
      ].join("\n");
      pkg.scripts.build = "vite build";
      pkg.scripts.dev = "vite build --watch";
      pkg.devDependencies["vite-plugin-dts"] = V["vite-plugin-dts"];
      if (cfg.isVue) pkg.devDependencies["vue-tsc"] = V["vue-tsc"];
      pkg.files = ["dist"];
      pkg.type = "module";
      pkg.main = "./dist/index.cjs";
      pkg.module = "./dist/index.js";
      pkg.types = "./dist/index.d.ts";
      pkg.exports = { ".": { types: "./dist/index.d.ts", import: "./dist/index.js", require: "./dist/index.cjs" } };
    }
    pkg.scripts.clean = "rimraf dist";
    pkg.devDependencies.rimraf = V.rimraf;
    return { files, pkg };
  }
};

// src/core/features/service.js
var service_default = {
  id: "service",
  active: (cfg) => cfg.hasService,
  apply(cfg) {
    const ext = cfg.ext;
    const fw = cfg.serviceFramework || "hono";
    const files = {
      [`src/app.${ext}`]: appFile(cfg, fw),
      [`src/index.${ext}`]: serverFile(cfg, fw),
      Dockerfile: dockerfile(cfg),
      ".dockerignore": ["node_modules", "dist", "coverage", ".git", ".github", ".env", ".env.*", "!.env.example", "*.log", "Dockerfile", ".dockerignore", ""].join("\n")
    };
    return {
      files,
      pkg: {
        private: true,
        scripts: {
          start: "node dist/index.js",
          dev: cfg.isTs ? "tsx watch src/index.ts" : "node --watch src/index.js"
        },
        dependencies: deps(fw),
        devDependencies: {
          ...cfg.isTs ? { tsx: V.tsx } : {},
          ...cfg.isTs ? typeDeps(fw) : {}
        }
      }
    };
  }
};
function deps(fw) {
  if (fw === "fastify") return { fastify: V.fastify };
  if (fw === "express") return { express: V.express };
  return { hono: V.hono, "@hono/node-server": V["@hono/node-server"] };
}
function typeDeps(fw) {
  if (fw === "express") return { "@types/express": V["@types/express"] };
  return {};
}
function appFile(cfg, fw) {
  if (fw === "fastify") {
    return [
      `import Fastify from 'fastify';`,
      ``,
      `export const app = Fastify();`,
      ``,
      `app.get('/', async () => ({ ok: true, service: '${cfg.name}' }));`,
      `app.get('/health', async () => 'ok');`,
      ``
    ].join("\n");
  }
  if (fw === "express") {
    return [
      `import express from 'express';`,
      ``,
      `export const app = express();`,
      ``,
      `app.get('/', (_req, res) => res.json({ ok: true, service: '${cfg.name}' }));`,
      `app.get('/health', (_req, res) => res.send('ok'));`,
      ``
    ].join("\n");
  }
  return [
    `import { Hono } from 'hono';`,
    ``,
    `export const app = new Hono();`,
    ``,
    `app.get('/', (c) => c.json({ ok: true, service: '${cfg.name}' }));`,
    `app.get('/health', (c) => c.text('ok'));`,
    ``
  ].join("\n");
}
function serverFile(cfg, fw) {
  const port = cfg.env ? "env.PORT" : "Number(process.env.PORT) || 3000";
  const envImport = cfg.env ? `import { env } from './env.js';` : null;
  if (fw === "fastify") {
    return [
      `import { app } from './app.js';`,
      envImport,
      ``,
      `const port = ${port};`,
      `app.listen({ port, host: '0.0.0.0' }).then((url) => {`,
      `	console.log(\`Listening on \${url}\`);`,
      `}).catch((err) => {`,
      `	app.log.error(err);`,
      `	process.exit(1);`,
      `});`,
      ``
    ].filter((l) => l !== null).join("\n");
  }
  if (fw === "express") {
    return [
      `import { app } from './app.js';`,
      envImport,
      ``,
      `const port = ${port};`,
      `app.listen(port, () => {`,
      `	console.log(\`Listening on http://localhost:\${port}\`);`,
      `});`,
      ``
    ].filter((l) => l !== null).join("\n");
  }
  return [
    `import { serve } from '@hono/node-server';`,
    `import { app } from './app.js';`,
    envImport,
    ``,
    `const port = ${port};`,
    `serve({ fetch: app.fetch, port }, (info) => {`,
    `	console.log(\`Listening on http://localhost:\${info.port}\`);`,
    `});`,
    ``
  ].filter((l) => l !== null).join("\n");
}
function dockerfile(cfg) {
  const node = cfg.nodeVersion;
  const pm = cfg.packageManager;
  const install = pm === "npm" ? "npm ci" : `${pm} install --frozen-lockfile`;
  const prune = pm === "npm" ? "npm ci --omit=dev" : `${pm} install --prod --frozen-lockfile`;
  const build = pm === "npm" ? "npm run build" : `${pm} run build`;
  return [
    `# --- build stage: install everything and compile ---`,
    `FROM node:${node}-slim AS build`,
    `WORKDIR /app`,
    `COPY package*.json ./`,
    `RUN ${install}`,
    `COPY . .`,
    `RUN ${build}`,
    ``,
    `# --- deps stage: production-only node_modules for a smaller image ---`,
    `FROM node:${node}-slim AS deps`,
    `WORKDIR /app`,
    `COPY package*.json ./`,
    `RUN ${prune}`,
    ``,
    `# --- runtime stage: slim, non-root, healthchecked ---`,
    `FROM node:${node}-slim`,
    `WORKDIR /app`,
    `ENV NODE_ENV=production`,
    `COPY --from=deps /app/node_modules ./node_modules`,
    `COPY --from=build /app/dist ./dist`,
    `COPY package.json ./`,
    `USER node`,
    `EXPOSE 3000`,
    `HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`,
    `CMD ["node", "dist/index.js"]`,
    ``
  ].join("\n");
}

// src/core/features/env.js
var env_default = {
  id: "env",
  active: (cfg) => cfg.env && (cfg.hasService || cfg.hasCli),
  apply(cfg) {
    const files = {};
    files[`src/env.${cfg.ext}`] = cfg.isTs ? envTs() : envJs();
    files[".env.example"] = ["NODE_ENV=development", "PORT=3000", ""].join("\n");
    return { files, pkg: { dependencies: { zod: V.zod } } };
  }
};
function envTs() {
  return [
    `import { z } from 'zod';`,
    ``,
    `const schema = z.object({`,
    `	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),`,
    `	PORT: z.coerce.number().default(3000),`,
    `});`,
    ``,
    `const parsed = schema.safeParse(process.env);`,
    `if (!parsed.success) {`,
    `	console.error('\u274C Invalid environment variables:', z.treeifyError(parsed.error));`,
    `	process.exit(1);`,
    `}`,
    ``,
    `export const env = parsed.data;`,
    ``
  ].join("\n");
}
function envJs() {
  return [
    `import { z } from 'zod';`,
    ``,
    `const schema = z.object({`,
    `	NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),`,
    `	PORT: z.coerce.number().default(3000),`,
    `});`,
    ``,
    `const parsed = schema.safeParse(process.env);`,
    `if (!parsed.success) {`,
    `	console.error('\u274C Invalid environment variables:', z.treeifyError(parsed.error));`,
    `	process.exit(1);`,
    `}`,
    ``,
    `/** @type {z.infer<typeof schema>} */`,
    `export const env = parsed.data;`,
    ``
  ].join("\n");
}

// src/core/features/test.js
var test_default = {
  id: "test",
  active: (cfg) => cfg.test !== "none",
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {}, devDependencies: {} };
    const ext = cfg.ext;
    const testExt = cfg.isReact ? cfg.srcExt : ext;
    if (cfg.test === "vitest") {
      const fw = cfg.isVue ? { imp: `import vue from '@vitejs/plugin-vue';`, call: "vue()" } : cfg.isSvelte ? {
        imp: `import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';`,
        call: "svelte(), svelteTesting()"
      } : null;
      files[`vitest.config.${ext}`] = [
        fw ? fw.imp : null,
        `import { defineConfig } from 'vitest/config';`,
        ``,
        `export default defineConfig({`,
        fw ? `	plugins: [${fw.call}],` : null,
        `	test: {`,
        // Keep Vitest to unit tests under src/ so it never tries to run the
        // Playwright specs in e2e/ (they share the *.spec.ts glob).
        cfg.e2e ? `		include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],` : null,
        cfg.hasFramework ? `		environment: 'jsdom',` : null,
        cfg.hasFramework ? `		globals: true,` : null,
        cfg.coverage ? `		coverage: { provider: 'v8', reporter: ['text', 'lcov'] },` : null,
        `	},`,
        `});`,
        ``
      ].filter((l) => l !== null).join("\n");
      pkg.scripts.test = "vitest run";
      pkg.scripts["test:watch"] = "vitest";
      pkg.devDependencies.vitest = V.vitest;
      if (cfg.hasFramework) {
        pkg.devDependencies.jsdom = V.jsdom;
        pkg.devDependencies["@testing-library/dom"] = V["@testing-library/dom"];
        if (cfg.isReact) pkg.devDependencies["@testing-library/react"] = V["@testing-library/react"];
        if (cfg.isVue) pkg.devDependencies["@testing-library/vue"] = V["@testing-library/vue"];
        if (cfg.isSvelte) pkg.devDependencies["@testing-library/svelte"] = V["@testing-library/svelte"];
      }
      if (cfg.coverage) {
        pkg.scripts.coverage = "vitest run --coverage";
        pkg.devDependencies["@vitest/coverage-v8"] = V["@vitest/coverage-v8"];
      }
      files[`src/index.test.${testExt}`] = exampleTest("vitest", cfg);
    } else if (cfg.test === "jest") {
      files["jest.config.js"] = jestConfig(cfg);
      pkg.scripts.test = "jest";
      pkg.scripts["test:watch"] = "jest --watch";
      pkg.devDependencies.jest = V.jest;
      if (cfg.isTs) {
        pkg.devDependencies["ts-jest"] = V["ts-jest"];
        pkg.devDependencies["@types/jest"] = V["@types/jest"];
      }
      if (cfg.coverage) pkg.scripts.coverage = "jest --coverage";
      files[`src/index.test.${testExt}`] = exampleTest("jest", cfg);
    } else if (cfg.test === "node") {
      pkg.scripts.test = cfg.isTs ? 'node --import tsx --test "src/**/*.test.ts"' : "node --test";
      if (cfg.isTs) pkg.devDependencies.tsx = V.tsx;
      files[`src/index.test.${testExt}`] = exampleTest("node", cfg);
    }
    if (cfg.hasService && cfg.serviceFramework === "express") {
      pkg.devDependencies.supertest = V.supertest;
      if (cfg.isTs) pkg.devDependencies["@types/supertest"] = V["@types/supertest"];
    }
    return { files, pkg };
  }
};
function importPath(runner, cfg) {
  if (!cfg.isTs) return "./index.js";
  if (runner === "node") return "./index.ts";
  return "./index.js";
}
function exampleTest(runner, cfg) {
  const imp = importPath(runner, cfg);
  if (cfg.hasService) {
    const api2 = runner === "jest" ? "" : `import { describe, it, expect } from 'vitest';
`;
    const fw = cfg.serviceFramework || "hono";
    let imports, call, statusProp;
    if (fw === "fastify") {
      imports = `import { app } from './app.js';`;
      call = `await app.inject({ method: 'GET', url: '/' })`;
      statusProp = "statusCode";
    } else if (fw === "express") {
      imports = `import request from 'supertest';
import { app } from './app.js';`;
      call = `await request(app).get('/')`;
      statusProp = "status";
    } else {
      imports = `import { app } from './app.js';`;
      call = `await app.request('/')`;
      statusProp = "status";
    }
    return [
      api2 + imports,
      ``,
      `describe('app', () => {`,
      `	it('responds on /', async () => {`,
      `		const res = ${call};`,
      `		expect(res.${statusProp}).toBe(200);`,
      `	});`,
      `});`,
      ``
    ].join("\n");
  }
  if (cfg.hasFramework) {
    const api2 = runner === "jest" ? "" : `import { describe, it, expect } from 'vitest';
`;
    const app = cfg.hasApp;
    const label = app ? "/Hello from/" : `'Click me'`;
    let lib, importLine, renderCall;
    if (cfg.isReact) {
      lib = "@testing-library/react";
      importLine = app ? `import { App } from './App.js';` : `import { Button } from './index.js';`;
      renderCall = app ? `render(<App />)` : `render(<Button label="Click me" />)`;
    } else if (cfg.isVue) {
      lib = "@testing-library/vue";
      importLine = app ? `import App from './App.vue';` : `import { Button } from './index.js';`;
      renderCall = app ? `render(App)` : `render(Button, { props: { label: 'Click me' } })`;
    } else {
      lib = "@testing-library/svelte";
      importLine = app ? `import App from './App.svelte';` : `import Button from './Button.svelte';`;
      renderCall = app ? `render(App)` : `render(Button, { props: { label: 'Click me' } })`;
    }
    return [
      api2 + `import { render, screen } from '${lib}';`,
      importLine,
      ``,
      `describe('${app ? "App" : "Button"}', () => {`,
      `	it('renders', () => {`,
      `		${renderCall};`,
      `		expect(screen.getByText(${label})).toBeDefined();`,
      `	});`,
      `});`,
      ``
    ].join("\n");
  }
  if (runner === "node") {
    return [
      `import { test } from 'node:test';`,
      `import assert from 'node:assert/strict';`,
      `import { greet } from '${imp}';`,
      ``,
      `test('greet', () => {`,
      `	assert.equal(greet('world'), 'Hello, world!');`,
      `});`,
      ``
    ].join("\n");
  }
  const api = runner === "jest" ? `` : `import { describe, it, expect } from 'vitest';
`;
  return [
    api + `import { greet } from '${imp}';`,
    ``,
    `describe('greet', () => {`,
    `	it('greets by name', () => {`,
    `		expect(greet('world')).toBe('Hello, world!');`,
    `	});`,
    `});`,
    ``
  ].join("\n");
}
function jestConfig(cfg) {
  if (cfg.isTs) {
    return [
      `/** @type {import('jest').Config} */`,
      `export default {`,
      `	preset: 'ts-jest/presets/default-esm',`,
      `	testEnvironment: 'node',`,
      `	extensionsToTreatAsEsm: ['.ts'],`,
      `	transform: {`,
      `		'^.+\\\\.ts$': ['ts-jest', { useESM: true, tsconfig: { verbatimModuleSyntax: false } }],`,
      `	},`,
      `	// let \`./x.js\` imports resolve to the .ts source under ESM`,
      `	moduleNameMapper: { '^(\\\\.{1,2}/.*)\\\\.js$': '$1' },`,
      `};`,
      ``
    ].join("\n");
  }
  return [
    `/** @type {import('jest').Config} */`,
    `export default {`,
    `	testEnvironment: 'node',`,
    `};`,
    ``
  ].join("\n");
}

// src/core/features/e2e.js
var DEV_URL = "http://localhost:5173";
var runDev = (cfg) => cfg.packageManager === "npm" ? "npm run dev" : `${cfg.packageManager} dev`;
var e2e_default = {
  id: "e2e",
  active: (cfg) => cfg.e2e && cfg.hasApp,
  apply(cfg) {
    const ext = cfg.ext;
    const files = {};
    const pkg = { scripts: {}, devDependencies: { "@playwright/test": "^1.50.0" } };
    files[`playwright.config.${ext}`] = [
      `import { defineConfig, devices } from '@playwright/test';`,
      ``,
      `export default defineConfig({`,
      `	testDir: './e2e',`,
      `	use: { baseURL: '${DEV_URL}', trace: 'on-first-retry' },`,
      `	// Playwright starts the app for you and waits for it to be ready.`,
      `	webServer: {`,
      `		command: '${runDev(cfg)}',`,
      `		url: '${DEV_URL}',`,
      `		reuseExistingServer: !process.env.CI,`,
      `	},`,
      `	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],`,
      `});`,
      ``
    ].join("\n");
    files[`e2e/app.spec.${ext}`] = [
      `import { test, expect } from '@playwright/test';`,
      ``,
      `test('renders the app', async ({ page }) => {`,
      `	await page.goto('/');`,
      `	await expect(page.getByRole('heading', { name: /Hello from/ })).toBeVisible();`,
      `});`,
      ``
    ].join("\n");
    pkg.scripts["test:e2e"] = "playwright test";
    return { files, pkg };
  }
};

// src/core/features/lint.js
var lint_default = {
  id: "lint",
  active: (cfg) => cfg.lint !== "none",
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {}, devDependencies: {} };
    if (cfg.lint === "eslint-prettier" || cfg.lint === "oxlint") {
      files[".prettierrc.json"] = toJson({
        useTabs: true,
        singleQuote: true,
        semi: true,
        printWidth: 100,
        trailingComma: "all"
      });
      files[".prettierignore"] = "dist\ncoverage\n";
      pkg.scripts.format = "prettier --write .";
      pkg.scripts["format:check"] = "prettier --check .";
      pkg.devDependencies.prettier = V.prettier;
    }
    if (cfg.lint === "eslint-prettier") {
      files["eslint.config.js"] = eslintFlatConfig(cfg);
      pkg.scripts.lint = "eslint .";
      pkg.scripts["lint:fix"] = "eslint . --fix";
      pkg.devDependencies.eslint = V.eslint;
      pkg.devDependencies["@eslint/js"] = V["@eslint/js"];
      if (cfg.isTs) pkg.devDependencies["typescript-eslint"] = V["typescript-eslint"];
    } else if (cfg.lint === "oxlint") {
      pkg.scripts.lint = "oxlint";
      pkg.devDependencies.oxlint = V.oxlint;
    } else if (cfg.lint === "biome") {
      files["biome.json"] = toJson({
        $schema: "https://biomejs.dev/schemas/2.1.2/schema.json",
        formatter: { enabled: true, indentStyle: "tab", lineWidth: 100 },
        linter: { enabled: true },
        javascript: { formatter: { quoteStyle: "single", trailingCommas: "all" } }
      });
      pkg.scripts.lint = "biome lint .";
      pkg.scripts["lint:fix"] = "biome lint --write .";
      pkg.scripts.format = "biome format --write .";
      pkg.devDependencies["@biomejs/biome"] = V["@biomejs/biome"];
    }
    return { files, pkg };
  }
};
function eslintFlatConfig(cfg) {
  if (cfg.isTs) {
    return [
      `import js from '@eslint/js';`,
      `import tseslint from 'typescript-eslint';`,
      ``,
      `export default tseslint.config(`,
      `	js.configs.recommended,`,
      `	...tseslint.configs.recommended,`,
      `	{ ignores: ['dist', 'coverage'] },`,
      `);`,
      ``
    ].join("\n");
  }
  return [
    `import js from '@eslint/js';`,
    ``,
    `export default [`,
    `	js.configs.recommended,`,
    `	{ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } },`,
    `	{ ignores: ['dist', 'coverage'] },`,
    `];`,
    ``
  ].join("\n");
}

// src/core/features/githooks.js
var githooks_default = {
  id: "githooks",
  active: (cfg) => cfg.gitHooks !== "none",
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {}, devDependencies: {} };
    const codeGlob = cfg.isTs ? "*.{js,ts}" : "*.js";
    const staged = cfg.lint === "biome" ? { [codeGlob]: "biome check --write --no-errors-on-unmatched" } : cfg.lint === "eslint-prettier" ? { [codeGlob]: ["prettier --write", "eslint --fix"], "*.{json,md,yml}": "prettier --write" } : cfg.lint === "oxlint" ? { [codeGlob]: ["prettier --write", "oxlint"], "*.{json,md,yml}": "prettier --write" } : null;
    const needsLintStaged = cfg.gitHooks !== "lefthook" && staged;
    if (cfg.gitHooks === "simple-git-hooks") {
      pkg["simple-git-hooks"] = { "pre-commit": needsLintStaged ? "npx lint-staged" : "npm test" };
      pkg.scripts.prepare = "simple-git-hooks";
      pkg.devDependencies["simple-git-hooks"] = V["simple-git-hooks"];
    } else if (cfg.gitHooks === "husky") {
      files[".husky/pre-commit"] = needsLintStaged ? "npx lint-staged\n" : "npm test\n";
      pkg.scripts.prepare = "husky";
      pkg.devDependencies.husky = V.husky;
    } else if (cfg.gitHooks === "lefthook") {
      files["lefthook.yml"] = lefthookYml(cfg);
      pkg.scripts.prepare = "lefthook install || true";
      pkg.devDependencies.lefthook = V.lefthook;
    }
    if (needsLintStaged) {
      pkg["lint-staged"] = staged;
      pkg.devDependencies["lint-staged"] = V["lint-staged"];
    }
    return { files, pkg };
  }
};
function lefthookYml(cfg) {
  const cmd = cfg.lint === "biome" ? "biome check --write --no-errors-on-unmatched {staged_files}" : cfg.lint === "none" ? "npm test" : "prettier --write {staged_files}";
  return [
    "pre-commit:",
    "  commands:",
    "    format:",
    `      glob: '*.{js,ts,json,md}'`,
    `      run: ${cmd}`,
    ""
  ].join("\n");
}

// src/core/features/release.js
var release_default = {
  id: "release",
  active: (cfg) => cfg.release !== "none",
  apply(cfg) {
    const files = {};
    const pkg = { scripts: {}, devDependencies: {} };
    if (cfg.release === "changesets") {
      files[".changeset/config.json"] = toJson({
        $schema: "https://unpkg.com/@changesets/config@3.0.0/schema.json",
        changelog: "@changesets/cli/changelog",
        commit: false,
        access: "public",
        baseBranch: "main",
        updateInternalDependencies: "patch"
      });
      files[".changeset/README.md"] = "# Changesets\n\nRun `npx changeset` to record a version bump for your next release.\n";
      pkg.scripts.changeset = "changeset";
      pkg.scripts.version = "changeset version";
      pkg.scripts.release = `${buildThen(cfg)}changeset publish`;
      pkg.devDependencies["@changesets/cli"] = V["@changesets/cli"];
    } else if (cfg.release === "release-it") {
      files[".release-it.json"] = toJson({
        git: { commitMessage: "chore: release v${version}" },
        github: { release: true },
        npm: { publish: true }
      });
      pkg.scripts.release = "release-it";
      pkg.devDependencies["release-it"] = V["release-it"];
    } else if (cfg.release === "np") {
      pkg.scripts.release = "np";
      pkg.devDependencies.np = V.np;
    }
    return { files, pkg };
  }
};
function buildThen(cfg) {
  return cfg.hasBuild ? "npm run build && " : "";
}

// src/core/features/cli.js
var cli_default = {
  id: "cli",
  active: (cfg) => cfg.hasCli,
  apply(cfg) {
    const build = cfg.bundler !== "none";
    const binPath = build || cfg.isTs ? "./dist/cli.js" : "./src/cli.js";
    const files = {};
    files[`src/cli.${cfg.ext}`] = cliScaffold(cfg);
    return {
      files,
      pkg: {
        bin: { [binName(cfg.name)]: binPath }
      }
    };
  }
};
function binName(name) {
  return name.startsWith("@") ? name.split("/")[1] : name;
}
function cliScaffold(cfg) {
  const importLine = cfg.hasLibrary ? `import { greet } from './index.${cfg.isTs ? "js" : "js"}';
` : "";
  const body = cfg.hasLibrary ? `const name = process.argv[2] ?? 'world';
console.log(greet(name));
` : `console.log('${cfg.name} \u2014 hello from your CLI');
`;
  return `#!/usr/bin/env node
${importLine}
${body}`;
}

// src/core/features/checks.js
var checks_default = {
  id: "checks",
  active: (cfg) => cfg.pkgChecks || cfg.knip,
  apply(cfg) {
    const pkg = { scripts: {}, devDependencies: {} };
    if (cfg.pkgChecks) {
      const attw = cfg.moduleFormat === "esm" ? "attw --pack --profile esm-only" : "attw --pack";
      pkg.scripts["check:pkg"] = `publint && ${attw}`;
      pkg.devDependencies.publint = V.publint;
      pkg.devDependencies["@arethetypeswrong/cli"] = V["@arethetypeswrong/cli"];
    }
    if (cfg.knip) {
      pkg.scripts.knip = "knip";
      pkg.devDependencies.knip = V.knip;
    }
    return { files: {}, pkg };
  }
};

// src/core/features/sizelimit.js
var sizelimit_default = {
  id: "sizelimit",
  active: (cfg) => cfg.sizeLimit,
  apply(cfg) {
    return {
      files: {
        ".size-limit.json": toJson([{ name: cfg.name, path: "dist/index.js", limit: "10 kB" }])
      },
      pkg: {
        scripts: { size: "size-limit" },
        devDependencies: {
          "size-limit": V["size-limit"],
          "@size-limit/preset-small-lib": V["@size-limit/preset-small-lib"]
        }
      }
    };
  }
};

// src/core/features/jsr.js
var jsr_default = {
  id: "jsr",
  active: (cfg) => cfg.jsr,
  apply(cfg) {
    const name = cfg.name.startsWith("@") ? cfg.name : `@scope/${cfg.name}`;
    return {
      files: {
        "jsr.json": toJson({
          name,
          version: "0.0.0",
          exports: `./src/index.${cfg.ext}`
        }),
        ".github/workflows/jsr.yml": [
          "name: Publish to JSR",
          "on:",
          "  push:",
          '    tags: ["v*"]',
          "permissions:",
          "  contents: read",
          "  id-token: write",
          "jobs:",
          "  publish:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: actions/checkout@v7",
          "      - uses: actions/setup-node@v7",
          "        with:",
          "          node-version: '24'",
          "      - run: npx jsr publish",
          ""
        ].join("\n")
      },
      pkg: {}
    };
  }
};

// src/core/features/workflows.js
function pmInstall(cfg) {
  return {
    npm: "npm ci",
    pnpm: "pnpm install --frozen-lockfile",
    yarn: "yarn install --immutable",
    bun: "bun install --frozen-lockfile"
  }[cfg.packageManager];
}
function pmRun(cfg, script2) {
  return cfg.packageManager === "npm" ? `npm run ${script2}` : `${cfg.packageManager} ${script2}`;
}
function pmExec(cfg, cmd) {
  return { npm: `npx ${cmd}`, pnpm: `pnpm exec ${cmd}`, yarn: `yarn ${cmd}`, bun: `bunx ${cmd}` }[cfg.packageManager];
}
function setupSteps(cfg) {
  const steps = ["      - uses: actions/checkout@v7"];
  if (cfg.packageManager === "pnpm") steps.push("      - uses: pnpm/action-setup@v6");
  if (cfg.packageManager === "bun") {
    steps.push("      - uses: oven-sh/setup-bun@v2");
  } else {
    steps.push(
      "      - uses: actions/setup-node@v7",
      "        with:",
      `          node-version: '${cfg.nodeVersion}'`,
      `          cache: '${cfg.packageManager === "yarn" ? "yarn" : cfg.packageManager === "pnpm" ? "pnpm" : "npm"}'`
    );
  }
  steps.push(`      - run: ${pmInstall(cfg)}`);
  return steps.join("\n");
}
var workflows_default = {
  id: "workflows",
  active: (cfg) => cfg.workflows && cfg.workflows.length || cfg.deps !== "none",
  apply(cfg) {
    const files = {};
    const wf = cfg.workflows || [];
    if (wf.includes("ci")) files[".github/workflows/ci.yml"] = ciWorkflow(cfg, wf.includes("codecov"));
    if (wf.includes("npm-publish")) files[".github/workflows/release.yml"] = releaseWorkflow(cfg);
    if (wf.includes("pages")) files[".github/workflows/pages.yml"] = pagesWorkflow(cfg);
    if (wf.includes("codeql")) files[".github/workflows/codeql.yml"] = codeqlWorkflow();
    if (wf.includes("stale")) files[".github/workflows/stale.yml"] = staleWorkflow();
    if (cfg.e2e && cfg.hasApp && wf.includes("ci")) files[".github/workflows/e2e.yml"] = e2eWorkflow(cfg);
    if (cfg.canary && cfg.release === "changesets") files[".github/workflows/canary.yml"] = canaryWorkflow(cfg);
    if (cfg.deps === "renovate") {
      files[".github/renovate.json"] = toJson({
        $schema: "https://docs.renovatebot.com/renovate-schema.json",
        extends: ["config:recommended", ":semanticCommits"]
      });
    } else if (cfg.deps === "dependabot") {
      files[".github/dependabot.yml"] = [
        "version: 2",
        "updates:",
        "  - package-ecosystem: npm",
        '    directory: "/"',
        "    schedule:",
        "      interval: weekly",
        "  - package-ecosystem: github-actions",
        '    directory: "/"',
        "    schedule:",
        "      interval: weekly",
        ""
      ].join("\n");
    }
    return { files, pkg: {} };
  }
};
function ciWorkflow(cfg, codecov) {
  const jobs = [];
  if (cfg.isTs) jobs.push(`      - run: ${pmRun(cfg, "typecheck")}`);
  if (cfg.lint !== "none") jobs.push(`      - run: ${pmRun(cfg, "lint")}`);
  if (cfg.test !== "none") jobs.push(`      - run: ${pmRun(cfg, codecov ? "coverage" : "test")}`);
  if (cfg.knip) jobs.push(`      - run: ${pmRun(cfg, "knip")}`);
  if (cfg.hasBuild) jobs.push(`      - run: ${pmRun(cfg, "build")}`);
  if (cfg.sizeLimit) jobs.push(`      - run: ${pmRun(cfg, "size")}`);
  if (cfg.pkgChecks) jobs.push(`      - run: ${pmRun(cfg, "check:pkg")}`);
  const cov = codecov ? "\n      - uses: codecov/codecov-action@v7\n        with:\n          token: ${{ secrets.CODECOV_TOKEN }}" : "";
  return [
    "name: CI",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "jobs:",
    "  ci:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    setupSteps(cfg),
    jobs.join("\n") + cov,
    ""
  ].join("\n");
}
function releaseWorkflow(cfg) {
  if (cfg.release === "changesets") {
    return [
      "name: Release",
      "on:",
      "  push:",
      "    branches: [main]",
      "concurrency: ${{ github.workflow }}-${{ github.ref }}",
      "permissions:",
      "  contents: write",
      "  pull-requests: write",
      "  id-token: write",
      "jobs:",
      "  release:",
      "    runs-on: ubuntu-latest",
      "    steps:",
      setupSteps(cfg),
      "      - uses: changesets/action@v1",
      "        with:",
      `          publish: ${pmRun(cfg, "release")}`,
      "          version: " + pmRun(cfg, "version"),
      "        env:",
      "          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
      '          NPM_CONFIG_PROVENANCE: "true"',
      "        # add NPM_TOKEN as a repo secret, or use npm Trusted Publishing (OIDC)",
      ""
    ].join("\n");
  }
  return [
    "name: Publish",
    "on:",
    "  push:",
    '    tags: ["v*"]',
    "permissions:",
    "  contents: read",
    "  id-token: write",
    "jobs:",
    "  publish:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    setupSteps(cfg),
    cfg.hasBuild ? `      - run: ${pmRun(cfg, "build")}` : null,
    "      - run: npm publish --provenance --access public",
    "        env:",
    "          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}",
    ""
  ].filter((l) => l !== null).join("\n");
}
function pagesWorkflow(cfg) {
  const build = cfg.storybook ? [setupSteps(cfg), `      - run: ${pmRun(cfg, "build-storybook")}`, "      - uses: actions/configure-pages@v5", "      - uses: actions/upload-pages-artifact@v3", "        with:", "          path: ./storybook-static"] : ["      - uses: actions/checkout@v7", "      - uses: actions/configure-pages@v5", "      - uses: actions/upload-pages-artifact@v3", "        with:", "          path: ./docs"];
  return [
    `name: Deploy ${cfg.storybook ? "Storybook" : "Pages"}`,
    "on:",
    "  push:",
    "    branches: [main]",
    "permissions:",
    "  contents: read",
    "  pages: write",
    "  id-token: write",
    "concurrency:",
    "  group: pages",
    "  cancel-in-progress: true",
    "jobs:",
    "  deploy:",
    "    environment:",
    "      name: github-pages",
    "      url: ${{ steps.deployment.outputs.page_url }}",
    "    runs-on: ubuntu-latest",
    "    steps:",
    build.join("\n"),
    "      - id: deployment",
    "        uses: actions/deploy-pages@v4",
    ""
  ].join("\n");
}
function codeqlWorkflow() {
  return [
    "name: CodeQL",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "  schedule:",
    '    - cron: "0 6 * * 1"',
    "jobs:",
    "  analyze:",
    "    runs-on: ubuntu-latest",
    "    permissions:",
    "      security-events: write",
    "    steps:",
    "      - uses: actions/checkout@v7",
    "      - uses: github/codeql-action/init@v3",
    "        with:",
    "          languages: javascript-typescript",
    "      - uses: github/codeql-action/analyze@v3",
    ""
  ].join("\n");
}
function e2eWorkflow(cfg) {
  return [
    "name: E2E",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "jobs:",
    "  e2e:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    setupSteps(cfg),
    "      - run: npx playwright install --with-deps chromium",
    `      - run: ${pmRun(cfg, "test:e2e")}`,
    "      - uses: actions/upload-artifact@v7",
    "        if: ${{ !cancelled() }}",
    "        with:",
    "          name: playwright-report",
    "          path: playwright-report/",
    "          retention-days: 7",
    ""
  ].join("\n");
}
function canaryWorkflow(cfg) {
  return [
    "name: Canary",
    "# Manually publish a snapshot (x.y.z-canary-<hash>) to the `canary` dist-tag",
    "# so consumers can test unreleased changes: npm i " + cfg.name + "@canary",
    "on:",
    "  workflow_dispatch:",
    "concurrency: canary-${{ github.ref }}",
    "permissions:",
    "  contents: read",
    "jobs:",
    "  canary:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    setupSteps(cfg),
    "      - name: Authenticate with npm",
    '        run: echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" >> ~/.npmrc',
    `      - run: ${pmExec(cfg, "changeset version --snapshot canary")}`,
    cfg.hasBuild ? `      - run: ${pmRun(cfg, "build")}` : null,
    `      - run: ${pmExec(cfg, "changeset publish --no-git-tag --tag canary")}`,
    ""
  ].filter((l) => l !== null).join("\n");
}
function staleWorkflow() {
  return [
    "name: Stale",
    "on:",
    "  schedule:",
    '    - cron: "0 0 * * *"',
    "jobs:",
    "  stale:",
    "    runs-on: ubuntu-latest",
    "    permissions:",
    "      issues: write",
    "      pull-requests: write",
    "    steps:",
    "      - uses: actions/stale@v9",
    "        with:",
    "          days-before-stale: 60",
    "          days-before-close: 7",
    ""
  ].join("\n");
}

// src/core/features/storybook.js
var FW = {
  react: { builder: "@storybook/react-vite", renderer: "@storybook/react", storyExt: "tsx" },
  vue: { builder: "@storybook/vue3-vite", renderer: "@storybook/vue3", storyExt: "ts" },
  svelte: { builder: "@storybook/svelte-vite", renderer: "@storybook/svelte", storyExt: "ts" }
};
var storybook_default = {
  id: "storybook",
  active: (cfg) => cfg.storybook,
  apply(cfg) {
    const fw = FW[cfg.framework];
    const files = {};
    files[".storybook/main.ts"] = [
      `import type { StorybookConfig } from '${fw.builder}';`,
      ``,
      `const config: StorybookConfig = {`,
      `	stories: ['../src/**/*.stories.@(ts|tsx|svelte)'],`,
      `	addons: [],`,
      `	framework: '${fw.builder}',`,
      `};`,
      `export default config;`,
      ``
    ].join("\n");
    files[".storybook/preview.ts"] = `export default { parameters: {} };
`;
    files[`src/Button.stories.${fw.storyExt}`] = story(cfg, fw);
    return {
      files,
      pkg: {
        scripts: {
          storybook: "storybook dev -p 6006",
          "build-storybook": "storybook build"
        },
        devDependencies: {
          storybook: V.storybook,
          [fw.builder]: V[fw.builder],
          [fw.renderer]: V[fw.renderer],
          vite: V.vite
        }
      }
    };
  }
};
function story(cfg, fw) {
  if (cfg.isReact) {
    return [
      `import type { Meta, StoryObj } from '${fw.renderer}';`,
      `import { Button } from './index';`,
      ``,
      `const meta: Meta<typeof Button> = { component: Button };`,
      `export default meta;`,
      ``,
      `export const Default: StoryObj<typeof Button> = { args: { label: 'Click me' } };`,
      ``
    ].join("\n");
  }
  if (cfg.isVue) {
    return [
      `import type { Meta, StoryObj } from '${fw.renderer}';`,
      `import { Button } from './index';`,
      ``,
      `const meta = { component: Button } satisfies Meta<typeof Button>;`,
      `export default meta;`,
      ``,
      `export const Default: StoryObj<typeof meta> = { args: { label: 'Click me' } };`,
      ``
    ].join("\n");
  }
  return [
    `import type { Meta, StoryObj } from '${fw.renderer}';`,
    `import Button from './Button.svelte';`,
    ``,
    `const meta = { component: Button } satisfies Meta<Button>;`,
    `export default meta;`,
    ``,
    `export const Default: StoryObj<typeof meta> = { args: { label: 'Click me' } };`,
    ``
  ].join("\n");
}

// src/core/features/community.js
var community_default = {
  id: "community",
  active: (cfg) => cfg.license !== "none" || cfg.community,
  apply(cfg) {
    const files = {};
    const year = (/* @__PURE__ */ new Date()).getFullYear();
    const holder = cfg.author || "the authors";
    if (cfg.license === "MIT") files["LICENSE"] = mit(year, holder);
    else if (cfg.license === "ISC") files["LICENSE"] = isc(year, holder);
    else if (cfg.license === "Apache-2.0") files["LICENSE"] = apacheStub(year, holder);
    if (cfg.community) {
      files["CONTRIBUTING.md"] = contributing(cfg);
      files["CODE_OF_CONDUCT.md"] = codeOfConduct(cfg);
      files["SECURITY.md"] = security();
      files[".github/ISSUE_TEMPLATE/bug_report.md"] = bugReport();
      files[".github/ISSUE_TEMPLATE/feature_request.md"] = featureRequest();
      files[".github/PULL_REQUEST_TEMPLATE.md"] = prTemplate();
    }
    return { files, pkg: {} };
  }
};
function mit(year, holder) {
  return `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}
function isc(year, holder) {
  return `ISC License

Copyright (c) ${year} ${holder}

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
`;
}
function apacheStub(year, holder) {
  return `Copyright ${year} ${holder}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Full text: https://www.apache.org/licenses/LICENSE-2.0.txt
`;
}
function contributing(cfg) {
  const pm = cfg.packageManager;
  const install = pm === "npm" ? "npm install" : `${pm} install`;
  return `# Contributing

Thanks for your interest in contributing!

## Development

\`\`\`sh
${install}
${pm === "npm" ? "npm test" : pm + " test"}
\`\`\`

## Pull requests

- Create a branch, make your change, and open a PR against \`main\`.
- Make sure lint, types and tests pass.
${cfg.release === "changesets" ? "- Run `npx changeset` to describe your change for the changelog.\n" : ""}
`;
}
function codeOfConduct() {
  return `# Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).
By participating, you are expected to uphold this code. Report unacceptable
behavior to the maintainers.
`;
}
function security() {
  return `# Security Policy

If you discover a security vulnerability, please **do not** open a public issue.
Instead, report it privately to the maintainers (e.g. via GitHub Security
Advisories). We will respond as quickly as possible.
`;
}
function bugReport() {
  return `---
name: Bug report
about: Report a problem
labels: bug
---

**Describe the bug**

**To reproduce**

**Expected behavior**

**Environment**
- Version:
- Node:
- OS:
`;
}
function featureRequest() {
  return `---
name: Feature request
about: Suggest an idea
labels: enhancement
---

**Problem**

**Proposed solution**

**Alternatives considered**
`;
}
function prTemplate() {
  return `## Summary

<!-- What does this change and why? -->

## Checklist

- [ ] Tests pass
- [ ] Lint & types pass
- [ ] Docs updated if needed
`;
}

// src/core/features/agents.js
var agents_default = {
  id: "agents",
  active: (cfg) => cfg.agents,
  apply(cfg) {
    const run2 = (s) => cfg.packageManager === "npm" ? `npm run ${s}` : `${cfg.packageManager} ${s}`;
    const test = cfg.packageManager === "npm" ? "npm test" : `${cfg.packageManager} test`;
    const commands = [];
    if (cfg.isTs) commands.push(`- Type-check: \`${run2("typecheck")}\``);
    if (cfg.lint !== "none") commands.push(`- Lint: \`${run2("lint")}\``);
    if (cfg.test !== "none") commands.push(`- Test: \`${test}\``);
    if (cfg.hasBuild) commands.push(`- Build: \`${run2("build")}\``);
    const stack = [
      `- Language: ${cfg.isTs ? "TypeScript (strict)" : "JavaScript (ESM)"}`,
      `- Module format: ${cfg.moduleFormat.toUpperCase()}`,
      `- Package manager: ${cfg.packageManager}`,
      cfg.bundler !== "none" ? `- Bundler: ${cfg.bundler}` : `- Build: ${cfg.isTs ? "tsc" : "none"}`,
      cfg.test !== "none" ? `- Tests: ${cfg.test}` : null,
      cfg.lint !== "none" ? `- Lint/format: ${cfg.lint}` : null
    ].filter(Boolean);
    const agents = [
      `# AGENTS.md`,
      ``,
      `Guidance for AI coding agents working in **${cfg.name}**.`,
      ``,
      `## Stack`,
      ``,
      ...stack,
      ``,
      `## Commands`,
      ``,
      ...commands,
      ``,
      `## Conventions`,
      ``,
      `- Source lives in \`src/\`. Keep the public API in \`src/index.${cfg.ext}\`.`,
      `- Add or update tests for any behavior change.`,
      cfg.isTs ? `- Prefer explicit types on exported functions; keep \`strict\` passing.` : `- Use ESM syntax and JSDoc types where helpful.`,
      cfg.release === "changesets" ? `- Run \`npx changeset\` after a user-facing change.` : null,
      `- Do not commit \`dist/\` or \`node_modules/\`.`,
      ``
    ].filter((l) => l !== null).join("\n");
    return {
      files: {
        "AGENTS.md": agents,
        "CLAUDE.md": `See [AGENTS.md](./AGENTS.md) for build/test commands and conventions.
`
      },
      pkg: {}
    };
  }
};

// src/core/features/vscode.js
var vscode_default = {
  id: "vscode",
  active: (cfg) => cfg.vscode,
  apply(cfg) {
    const biome = cfg.lint === "biome";
    const settings = {
      "editor.formatOnSave": cfg.lint !== "none",
      "editor.defaultFormatter": biome ? "biomejs.biome" : "esbenp.prettier-vscode",
      "editor.insertSpaces": false
    };
    if (cfg.lint === "eslint-prettier" || cfg.lint === "oxlint") {
      settings["editor.codeActionsOnSave"] = { "source.fixAll": "explicit" };
    }
    const recommendations = [];
    if (biome) recommendations.push("biomejs.biome");
    else {
      if (cfg.lint === "eslint-prettier") recommendations.push("dbaeumer.vscode-eslint");
      if (cfg.lint !== "none") recommendations.push("esbenp.prettier-vscode");
    }
    if (cfg.test === "vitest") recommendations.push("vitest.explorer");
    return {
      files: {
        ".vscode/settings.json": toJson(settings),
        ".vscode/extensions.json": toJson({ recommendations })
      },
      pkg: {}
    };
  }
};

// src/core/features/doctor.js
var doctor_default = {
  id: "doctor",
  active: (cfg) => cfg.doctor && !cfg.monorepo,
  apply(cfg) {
    const files = { "scripts/doctor.mjs": script(cfg) };
    const pkg = { scripts: { doctor: "node scripts/doctor.mjs" } };
    if (!cfg.publishable) pkg.scripts.postinstall = "node scripts/doctor.mjs";
    return { files, pkg };
  }
};
function script(cfg) {
  return [
    `/* global process, console, URL */`,
    `// Checks your environment matches this project. Warns only \u2014 never fails.`,
    `import { readFileSync } from 'node:fs';`,
    ``,
    `const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));`,
    `const gte = (a, b) => {`,
    `	const pa = String(a).split('.').map(Number);`,
    `	const pb = String(b).split('.').map(Number);`,
    `	for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);`,
    `	return true;`,
    `};`,
    ``,
    `let issues = 0;`,
    `const floor = (pkg.engines?.node || '').replace(/[^0-9.]/g, '');`,
    `const node = process.versions.node;`,
    `if (floor && !gte(node, floor)) {`,
    "	console.warn(`\u26A0  Node ${node} is below the required >=${floor} \u2014 run: nvm install ${floor.split('.')[0]}`);",
    `	issues++;`,
    `} else {`,
    "	console.log(`\u2713 Node ${node}`);",
    `}`,
    ``,
    `const expectedPm = '${cfg.packageManager}';`,
    `const usingPm = (process.env.npm_config_user_agent || '').split('/')[0];`,
    `if (usingPm && usingPm !== expectedPm) {`,
    "	console.warn(`\u26A0  This project uses ${expectedPm}, but you ran ${usingPm}.`);",
    `	issues++;`,
    `} else {`,
    "	console.log(`\u2713 Package manager: ${expectedPm}`);",
    `}`,
    ``,
    `if (issues) console.warn('\\nSee the README "Requirements" section to fix these.');`,
    ``
  ].join("\n");
}

// src/core/features/gitfiles.js
var GITIGNORE = `# dependencies
node_modules/
.pnp.*
.yarn/*

# build output
dist/
coverage/
*.tsbuildinfo

# test artifacts (Playwright)
test-results/
playwright-report/
playwright/.cache/

# logs
*.log
npm-debug.log*

# env & editor
.env
.env.*
!.env.example
.DS_Store
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/
`;
var EDITORCONFIG = `root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = tab

[*.{json,yml,yaml,md}]
indent_style = space
indent_size = 2
`;
var NPMRC = `engine-strict=true
`;
var gitfiles_default = {
  id: "gitfiles",
  active: () => true,
  apply(cfg) {
    const files = { ".gitignore": GITIGNORE, ".npmrc": NPMRC };
    if (cfg.editorconfig) files[".editorconfig"] = EDITORCONFIG;
    return { files, pkg: {} };
  }
};

// src/core/features/index.js
var features_default = [
  meta_default,
  bundler_default,
  typescript_default,
  frameworks_default,
  vite_default,
  service_default,
  env_default,
  test_default,
  e2e_default,
  lint_default,
  githooks_default,
  release_default,
  cli_default,
  checks_default,
  sizelimit_default,
  jsr_default,
  workflows_default,
  storybook_default,
  community_default,
  agents_default,
  vscode_default,
  doctor_default,
  gitfiles_default
];

// src/core/provenance.js
var TRANSIENT = /* @__PURE__ */ new Set(["gitInit", "install", "generatorVersion", "preset", "name"]);
var BASELINE_SCHEMA_VERSION = 1;
var DEP_SECTIONS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
var PROTECTED_FIELDS = ["exports", "bin", "main", "module", "types", "files", "engines", "packageManager"];
function provenance(cfg, baseline) {
  const defaults = defaultConfig();
  const settings = {};
  for (const [key, value] of Object.entries(cfg)) {
    if (!(key in defaults) || TRANSIENT.has(key)) continue;
    if (JSON.stringify(value) !== JSON.stringify(defaults[key])) settings[key] = value;
  }
  return toJson({
    $schema: "https://packkitjs.github.io/create-packkit/packkit.schema.json",
    generator: "create-packkit",
    ...cfg.generatorVersion ? { version: cfg.generatorVersion } : {},
    ...cfg.preset ? { preset: cfg.preset } : {},
    settings,
    ...baseline ? { baseline } : {}
  });
}
function buildBaseline(files) {
  const fileHashes = {};
  for (const path of Object.keys(files).sort()) {
    if (path === "packkit.json") continue;
    fileHashes[path] = { hash: contentHash(files[path]) };
  }
  let packageJson = { scripts: {}, dependencies: {}, protectedFields: {} };
  if (files["package.json"]) {
    try {
      const pkg = JSON.parse(files["package.json"]);
      const dependencies = {};
      for (const section of DEP_SECTIONS) if (pkg[section]) dependencies[section] = { ...pkg[section] };
      const protectedFields = {};
      for (const field of PROTECTED_FIELDS) if (field in pkg) protectedFields[field] = pkg[field];
      packageJson = { scripts: { ...pkg.scripts || {} }, dependencies, protectedFields };
    } catch {
    }
  }
  return { schemaVersion: BASELINE_SCHEMA_VERSION, files: fileHashes, packageJson };
}

// src/core/monorepo.js
function buildMonorepo(cfg) {
  if (cfg.monorepoLayout === "fullstack") return buildFullstack(cfg);
  const files = {};
  const pm = cfg.packageManager;
  const scope = cfg.name.replace(/^@/, "").split("/")[0];
  const core = `@${scope}/core`;
  const utils = `@${scope}/utils`;
  const wsProto = pm === "pnpm" ? "workspace:*" : "*";
  Object.assign(files, workspaceScaffold(cfg, { workspaceGlobs: ["packages/*"] }));
  const rootPkg = {
    name: cfg.name,
    version: "0.0.0",
    private: true,
    type: "module",
    ...cfg.license !== "none" ? { license: cfg.license } : {},
    ...pm === "pnpm" ? { packageManager: "pnpm@9.10.0" } : { workspaces: ["packages/*"] },
    scripts: {
      build: "turbo build",
      test: "turbo test",
      lint: "turbo lint",
      typecheck: "turbo typecheck",
      dev: "turbo dev",
      changeset: "changeset",
      version: "changeset version",
      release: "turbo build && changeset publish"
    },
    devDependencies: {
      turbo: V.turbo,
      typescript: V.typescript,
      tsup: V.tsup,
      vitest: V.vitest,
      eslint: V.eslint,
      "@eslint/js": V["@eslint/js"],
      "typescript-eslint": V["typescript-eslint"],
      prettier: V.prettier,
      "@changesets/cli": V["@changesets/cli"],
      "@types/node": `^${cfg.nodeVersion}.0.0`
    }
  };
  files["package.json"] = toJson(rootPkg);
  files["turbo.json"] = toJson({
    $schema: "https://turbo.build/schema.json",
    tasks: {
      build: { dependsOn: ["^build"], outputs: ["dist/**"] },
      test: { dependsOn: ["^build"] },
      typecheck: { dependsOn: ["^build"] },
      lint: {},
      dev: { cache: false, persistent: true }
    }
  });
  files[".changeset/config.json"] = toJson({
    $schema: "https://unpkg.com/@changesets/config@3.0.0/schema.json",
    changelog: "@changesets/cli/changelog",
    commit: false,
    access: "public",
    baseBranch: "main"
  });
  files[".changeset/README.md"] = "# Changesets\n\nRun `npx changeset` to record a version bump for your next release.\n";
  files["README.md"] = rootReadme(cfg, pm, core, utils);
  addPackage(files, {
    name: core,
    dir: "packages/core",
    src: [
      `/** Greet someone by name. */`,
      `export function greet(name: string): string {`,
      `	return \`Hello, \${name}!\`;`,
      `}`,
      ``
    ].join("\n"),
    test: exampleTest2(`import { greet } from './index.js';`, `expect(greet('world')).toBe('Hello, world!')`),
    deps: {}
  });
  addPackage(files, {
    name: utils,
    dir: "packages/utils",
    src: [
      `import { greet } from '${core}';`,
      ``,
      `/** Greet someone, loudly. */`,
      `export function shout(name: string): string {`,
      `	return greet(name).toUpperCase();`,
      `}`,
      ``
    ].join("\n"),
    test: exampleTest2(`import { shout } from './index.js';`, `expect(shout('world')).toBe('HELLO, WORLD!')`),
    deps: { [core]: wsProto }
  });
  files["packkit.json"] = provenance(cfg, buildBaseline(files));
  return {
    config: cfg,
    files,
    postCommands: cfg.gitInit ? ["git init", "git add -A", 'git commit -m "Initial commit from Packkit"'] : [],
    summary: {
      name: cfg.name,
      fileCount: Object.keys(files).length,
      stack: ["monorepo", `${pm}+turbo`, "TypeScript", "tsup", "vitest", "changesets"],
      workflows: ["ci"]
    }
  };
}
function buildFullstack(cfg) {
  const files = {};
  const pm = cfg.packageManager;
  const scope = cfg.name.replace(/^@/, "").split("/")[0];
  const shared = `@${scope}/shared`;
  const wsProto = pm === "pnpm" ? "workspace:*" : "*";
  Object.assign(files, workspaceScaffold(cfg, { workspaceGlobs: ["apps/*", "packages/*"], tsconfigLib: ["ES2022", "DOM"] }));
  files["package.json"] = toJson({
    name: cfg.name,
    version: "0.0.0",
    private: true,
    type: "module",
    ...cfg.license !== "none" ? { license: cfg.license } : {},
    ...pm === "pnpm" ? { packageManager: "pnpm@9.10.0" } : { workspaces: ["apps/*", "packages/*"] },
    scripts: {
      dev: "turbo dev",
      build: "turbo build",
      // Production runs the built server, which also serves the web build.
      start: `${pm === "npm" ? "npm --prefix apps/server run" : `${pm} --filter ./apps/server`} start`,
      test: "turbo test",
      lint: "turbo lint",
      typecheck: "turbo typecheck"
    },
    devDependencies: {
      turbo: V.turbo,
      typescript: V.typescript,
      vitest: V.vitest,
      eslint: V.eslint,
      "@eslint/js": V["@eslint/js"],
      "typescript-eslint": V["typescript-eslint"],
      prettier: V.prettier,
      "@types/node": `^${cfg.nodeVersion}.0.0`
    }
  });
  files["turbo.json"] = toJson({
    $schema: "https://turbo.build/schema.json",
    tasks: {
      build: { dependsOn: ["^build"], outputs: ["dist/**"] },
      // Shared is built before the apps start, so both sides always import a
      // current copy without a separate watch process.
      dev: { dependsOn: ["^build"], cache: false, persistent: true },
      test: { dependsOn: ["^build"] },
      typecheck: { dependsOn: ["^build"] },
      lint: {}
    }
  });
  files["README.md"] = fullstackReadme(cfg, pm, shared);
  files["packages/shared/package.json"] = toJson({
    name: shared,
    version: "0.0.0",
    private: true,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    scripts: {
      build: "tsup src/index.ts --format esm --dts --clean",
      test: "vitest run",
      typecheck: "tsc --noEmit",
      lint: "eslint ."
    },
    devDependencies: { tsup: V.tsup }
  });
  files["packages/shared/tsconfig.json"] = toJson({ extends: "../../tsconfig.base.json", include: ["src"] });
  files["packages/shared/src/index.ts"] = [
    `/** The shape the server returns and the web app renders. Change it once. */`,
    `export interface Health {`,
    `	ok: boolean;`,
    `	service: string;`,
    `	uptime: number;`,
    `}`,
    ``,
    `export function describeHealth(h: Health): string {`,
    `	return h.ok ? \`\${h.service} is up (\${Math.round(h.uptime)}s)\` : \`\${h.service} is down\`;`,
    `}`,
    ``
  ].join("\n");
  files["packages/shared/src/index.test.ts"] = exampleTest2(
    `import { describeHealth } from './index.js';`,
    `expect(describeHealth({ ok: true, service: 'api', uptime: 12 })).toBe('api is up (12s)')`
  );
  const fw = cfg.serviceFramework || "hono";
  const server = fullstackServer(cfg, fw, shared);
  files["apps/server/package.json"] = toJson({
    name: `@${scope}/server`,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "tsx watch src/index.ts",
      build: "tsup src/index.ts --format esm --clean",
      start: "node dist/index.js",
      test: "vitest run",
      typecheck: "tsc --noEmit",
      lint: "eslint ."
    },
    dependencies: { ...server.deps, [shared]: wsProto },
    devDependencies: { tsx: V.tsx, tsup: V.tsup, ...server.devDeps }
  });
  files["apps/server/tsconfig.json"] = toJson({ extends: "../../tsconfig.base.json", include: ["src"] });
  files["apps/server/src/app.ts"] = server.appTs;
  files["apps/server/src/index.ts"] = server.indexTs;
  files["apps/server/src/app.test.ts"] = server.appTestTs;
  files["apps/web/package.json"] = toJson({
    name: `@${scope}/web`,
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
      test: "vitest run",
      typecheck: "tsc --noEmit",
      lint: "eslint ."
    },
    dependencies: { react: V.react, "react-dom": V["react-dom"], [shared]: wsProto },
    devDependencies: {
      vite: V.vite,
      "@vitejs/plugin-react": V["@vitejs/plugin-react"],
      // Without the React types, `turbo typecheck` fails on the very first run
      // with TS7016/TS7026 on every JSX element.
      "@types/react": V["@types/react"],
      "@types/react-dom": V["@types/react-dom"],
      "@testing-library/react": V["@testing-library/react"],
      "@testing-library/dom": V["@testing-library/dom"],
      jsdom: V.jsdom
    }
  });
  files["apps/web/tsconfig.json"] = toJson({
    extends: "../../tsconfig.base.json",
    compilerOptions: { jsx: "react-jsx" },
    include: ["src"]
  });
  files["apps/web/vite.config.ts"] = [
    `/// <reference types="vitest" />`,
    `import { defineConfig } from 'vite';`,
    `import react from '@vitejs/plugin-react';`,
    ``,
    `export default defineConfig({`,
    `	plugins: [react()],`,
    `	// Same-origin /api in dev as in production, so no CORS and no base URL`,
    `	// juggling between environments.`,
    `	server: { proxy: { '/api': 'http://localhost:3000' } },`,
    `	test: { environment: 'jsdom' },`,
    `});`,
    ``
  ].join("\n");
  files["apps/web/src/App.test.tsx"] = [
    `import { describe, it, expect } from 'vitest';`,
    `import { render, screen } from '@testing-library/react';`,
    `import { App } from './App.js';`,
    ``,
    `describe('App', () => {`,
    `	it('renders the service name', () => {`,
    `		render(<App />);`,
    `		expect(screen.getByRole('heading', { name: '${cfg.name}' })).toBeDefined();`,
    `	});`,
    `});`,
    ``
  ].join("\n");
  files["apps/web/index.html"] = [
    `<!doctype html>`,
    `<html lang="en">`,
    `	<head>`,
    `		<meta charset="UTF-8" />`,
    `		<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `		<title>${cfg.name}</title>`,
    `	</head>`,
    `	<body>`,
    `		<div id="root"></div>`,
    `		<script type="module" src="/src/main.tsx"><\/script>`,
    `	</body>`,
    `</html>`,
    ``
  ].join("\n");
  files["apps/web/src/main.tsx"] = [
    `import { StrictMode } from 'react';`,
    `import { createRoot } from 'react-dom/client';`,
    `import { App } from './App.js';`,
    ``,
    `createRoot(document.getElementById('root')!).render(`,
    `	<StrictMode>`,
    `		<App />`,
    `	</StrictMode>,`,
    `);`,
    ``
  ].join("\n");
  files["apps/web/src/App.tsx"] = [
    `import { useEffect, useState } from 'react';`,
    `import { describeHealth, type Health } from '${shared}';`,
    ``,
    `export function App() {`,
    `	const [health, setHealth] = useState<Health | null>(null);`,
    ``,
    `	useEffect(() => {`,
    `		fetch('/api/health')`,
    `			.then((r) => r.json() as Promise<Health>)`,
    `			.then(setHealth)`,
    `			.catch(() => setHealth({ ok: false, service: '${cfg.name}', uptime: 0 }));`,
    `	}, []);`,
    ``,
    `	return (`,
    `		<main>`,
    `			<h1>${cfg.name}</h1>`,
    `			<p>{health ? describeHealth(health) : 'Checking\u2026'}</p>`,
    `		</main>`,
    `	);`,
    `}`,
    ``
  ].join("\n");
  files["packkit.json"] = provenance(cfg, buildBaseline(files));
  return {
    config: cfg,
    files,
    postCommands: cfg.gitInit ? ["git init", "git add -A", 'git commit -m "Initial commit from Packkit"'] : [],
    summary: {
      name: cfg.name,
      fileCount: Object.keys(files).length,
      stack: ["monorepo", "full-stack", `${pm}+turbo`, "React+Vite", { hono: "Hono", fastify: "Fastify", express: "Express" }[cfg.serviceFramework || "hono"], "TypeScript", "vitest"],
      workflows: ["ci"]
    }
  };
}
function fullstackServer(cfg, fw, shared) {
  const healthBody = `{ ok: true, service: '${cfg.name}', uptime: process.uptime() }`;
  if (fw === "fastify") {
    return {
      deps: { fastify: V.fastify, "@fastify/static": V["@fastify/static"] },
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
        `	app.register(fastifyStatic, { root: resolve('../web/dist') });`,
        `}`,
        ``
      ].join("\n"),
      indexTs: [
        `import { app } from './app.js';`,
        ``,
        `const port = Number(process.env.PORT ?? 3000);`,
        `app.listen({ port, host: '0.0.0.0' }).then((url) => console.log(\`Listening on \${url}\`));`,
        ``
      ].join("\n"),
      appTestTs: [
        `import { describe, it, expect } from 'vitest';`,
        `import { app } from './app.js';`,
        ``,
        `describe('api', () => {`,
        `	it('reports health', async () => {`,
        `		const res = await app.inject({ method: 'GET', url: '/api/health' });`,
        `		expect(res.statusCode).toBe(200);`,
        `		expect(res.json()).toMatchObject({ ok: true });`,
        `	});`,
        `});`,
        ``
      ].join("\n")
    };
  }
  if (fw === "express") {
    return {
      deps: { express: V.express },
      devDeps: { "@types/express": V["@types/express"], supertest: V.supertest, "@types/supertest": V["@types/supertest"] },
      appTs: [
        // Annotate the app type: the workspace tsconfig emits declarations, and
        // express()'s inferred type references a transitive package (TS2742).
        `import express, { type Express } from 'express';`,
        `import type { Health } from '${shared}';`,
        ``,
        `export const app: Express = express();`,
        ``,
        `app.get('/api/health', (_req, res) => {`,
        `	const body: Health = ${healthBody};`,
        `	res.json(body);`,
        `});`,
        ``,
        `// In production the API also serves the built web app, so one process and`,
        `// one port covers the whole thing. In dev, Vite serves the app and proxies`,
        `// /api here instead (see apps/web/vite.config.ts).`,
        `if (process.env.NODE_ENV === 'production') {`,
        `	app.use(express.static('../web/dist'));`,
        `}`,
        ``
      ].join("\n"),
      indexTs: [
        `import { app } from './app.js';`,
        ``,
        `const port = Number(process.env.PORT ?? 3000);`,
        `app.listen(port, () => console.log(\`Listening on http://localhost:\${port}\`));`,
        ``
      ].join("\n"),
      appTestTs: [
        `import { describe, it, expect } from 'vitest';`,
        `import request from 'supertest';`,
        `import { app } from './app.js';`,
        ``,
        `describe('api', () => {`,
        `	it('reports health', async () => {`,
        `		const res = await request(app).get('/api/health');`,
        `		expect(res.status).toBe(200);`,
        `		expect(res.body).toMatchObject({ ok: true });`,
        `	});`,
        `});`,
        ``
      ].join("\n")
    };
  }
  return {
    deps: { hono: V.hono, "@hono/node-server": V["@hono/node-server"] },
    devDeps: {},
    appTs: [
      `import { Hono } from 'hono';`,
      `import { serveStatic } from '@hono/node-server/serve-static';`,
      `import type { Health } from '${shared}';`,
      ``,
      `export const app = new Hono();`,
      ``,
      `app.get('/api/health', (c) => {`,
      `	const body: Health = ${healthBody};`,
      `	return c.json(body);`,
      `});`,
      ``,
      `// In production the API also serves the built web app, so one process and`,
      `// one port covers the whole thing. In dev, Vite serves the app and proxies`,
      `// /api here instead (see apps/web/vite.config.ts).`,
      `if (process.env.NODE_ENV === 'production') {`,
      `	app.use('/*', serveStatic({ root: '../web/dist' }));`,
      `}`,
      ``
    ].join("\n"),
    indexTs: [
      `import { serve } from '@hono/node-server';`,
      `import { app } from './app.js';`,
      ``,
      `const port = Number(process.env.PORT ?? 3000);`,
      `serve({ fetch: app.fetch, port });`,
      `console.log(\`Listening on http://localhost:\${port}\`);`,
      ``
    ].join("\n"),
    appTestTs: [
      `import { describe, it, expect } from 'vitest';`,
      `import { app } from './app.js';`,
      ``,
      `describe('api', () => {`,
      `	it('reports health', async () => {`,
      `		const res = await app.request('/api/health');`,
      `		expect(res.status).toBe(200);`,
      `		expect(await res.json()).toMatchObject({ ok: true });`,
      `	});`,
      `});`,
      ``
    ].join("\n")
  };
}
function fullstackReadme(cfg, pm, shared) {
  const install = pm === "npm" ? "npm install" : `${pm} install`;
  const run2 = (s) => pm === "npm" ? `npm run ${s}` : `${pm} ${s}`;
  const serverLabel = { hono: "Hono", fastify: "Fastify", express: "Express" }[cfg.serviceFramework || "hono"];
  return [
    `# ${cfg.name}`,
    "",
    cfg.description || "_A full-stack monorepo scaffolded with [Packkit](https://packkitjs.github.io/create-packkit/)._",
    "",
    "## Layout",
    "",
    "```",
    "apps/web       React + Vite front end",
    `apps/server    ${serverLabel} API (also serves the web build in production)`,
    "packages/shared  types and helpers both sides import",
    "```",
    "",
    "## Develop",
    "",
    "```sh",
    install,
    run2("dev") + "     # web on :5173, api on :3000",
    "```",
    "",
    `Vite proxies \`/api\` to the server, so requests are same-origin in development exactly as they are in production \u2014 no CORS, no environment-specific base URL.`,
    "",
    "## Production",
    "",
    "```sh",
    run2("build"),
    run2("start") + "   # one process serving the API and the built web app",
    "```",
    "",
    `\`${shared}\` is built before either app starts, so a change to a shared type surfaces as a type error on both sides rather than at runtime.`,
    "",
    cfg.license !== "none" ? `## License

${cfg.license}${cfg.author ? " \xA9 " + cfg.author : ""}
` : ""
  ].join("\n");
}
function workspaceScaffold(cfg, { workspaceGlobs, tsconfigLib = ["ES2022"] }) {
  const files = {};
  for (const feat of [community_default, agents_default, gitfiles_default]) {
    if (feat.active(cfg)) Object.assign(files, feat.apply(cfg).files);
  }
  if (cfg.packageManager === "pnpm") {
    files["pnpm-workspace.yaml"] = "packages:\n" + workspaceGlobs.map((g) => `  - "${g}"
`).join("");
  }
  files["tsconfig.base.json"] = toJson({
    $schema: "https://json.schemastore.org/tsconfig",
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      lib: tsconfigLib,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      declaration: true,
      noEmit: true
    }
  });
  files["eslint.config.js"] = [
    `import js from '@eslint/js';`,
    `import tseslint from 'typescript-eslint';`,
    ``,
    `export default tseslint.config(`,
    `	js.configs.recommended,`,
    `	...tseslint.configs.recommended,`,
    `	{ ignores: ['**/dist'] },`,
    `);`,
    ``
  ].join("\n");
  files[".prettierrc.json"] = toJson({ useTabs: true, singleQuote: true, semi: true, printWidth: 100, trailingComma: "all" });
  files[".github/workflows/ci.yml"] = ciWorkflow2(cfg, cfg.packageManager);
  return files;
}
function addPackage(files, { name, dir, src, test, deps: deps2 }) {
  const pkg = {
    name,
    version: "0.0.0",
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: { ".": { types: "./dist/index.d.ts", default: "./dist/index.js" } },
    files: ["dist"],
    scripts: {
      build: "tsup src/index.ts --format esm --dts --clean",
      dev: "tsup src/index.ts --format esm --dts --watch",
      test: "vitest run",
      typecheck: "tsc --noEmit",
      lint: "eslint ."
    },
    ...Object.keys(deps2).length ? { dependencies: deps2 } : {}
  };
  files[`${dir}/package.json`] = toJson(pkg);
  files[`${dir}/tsconfig.json`] = toJson({ extends: "../../tsconfig.base.json", include: ["src"] });
  files[`${dir}/src/index.ts`] = src;
  files[`${dir}/src/index.test.ts`] = test;
}
function exampleTest2(importLine, assertion) {
  return [`import { describe, it, expect } from 'vitest';`, importLine, ``, `describe('example', () => {`, `	it('works', () => {`, `		${assertion};`, `	});`, `});`, ``].join("\n");
}
function ciWorkflow2(cfg, pm) {
  const setup = ["      - uses: actions/checkout@v7"];
  if (pm === "pnpm") setup.push("      - uses: pnpm/action-setup@v6");
  setup.push(
    "      - uses: actions/setup-node@v7",
    "        with:",
    `          node-version: '${cfg.nodeVersion}'`,
    `          cache: '${pm === "yarn" ? "yarn" : pm === "pnpm" ? "pnpm" : "npm"}'`
  );
  const install = pm === "npm" ? "npm ci" : pm === "pnpm" ? "pnpm install --frozen-lockfile" : `${pm} install --frozen-lockfile`;
  const run2 = (s) => pm === "npm" ? `npm run ${s}` : `${pm} ${s}`;
  return [
    "name: CI",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "jobs:",
    "  ci:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    setup.join("\n"),
    `      - run: ${install}`,
    `      - run: ${run2("typecheck")}`,
    `      - run: ${run2("lint")}`,
    `      - run: ${run2("test")}`,
    `      - run: ${run2("build")}`,
    ""
  ].join("\n");
}
function rootReadme(cfg, pm, core, utils) {
  const install = pm === "npm" ? "npm install" : `${pm} install`;
  const run2 = (s) => pm === "npm" ? `npm run ${s}` : `${pm} ${s}`;
  return [
    `# ${cfg.name}`,
    "",
    cfg.description || "_A monorepo scaffolded with [Packkit](https://packkitjs.github.io/create-packkit/)._",
    "",
    "## Packages",
    "",
    `- \`${core}\` \u2014 the core library`,
    `- \`${utils}\` \u2014 utilities built on \`${core}\``,
    "",
    "## Develop",
    "",
    "```sh",
    install,
    run2("build") + "     # build all packages (Turborepo)",
    run2("test"),
    "```",
    "",
    cfg.license !== "none" ? `## License

${cfg.license}${cfg.author ? " \xA9 " + cfg.author : ""}
` : ""
  ].join("\n");
}

// src/core/presets.js
var PRESETS = {
  "ts-lib": { language: "ts", target: ["library"], moduleFormat: "esm" },
  "js-lib": { language: "js", target: ["library"], moduleFormat: "esm", bundler: "tsup" },
  "ts-cli": { language: "ts", target: ["cli", "library"], moduleFormat: "esm" },
  cli: { language: "ts", target: ["cli", "library"], moduleFormat: "esm" },
  "react-lib": { language: "ts", framework: "react", target: ["library"], moduleFormat: "esm", test: "vitest" },
  "react-lib-js": { language: "js", framework: "react", target: ["library"], moduleFormat: "esm", bundler: "tsup", test: "vitest" },
  "react-app": { language: "ts", framework: "react", target: ["app"], test: "vitest", release: "none", workflows: ["ci"] },
  "vue-lib": { language: "ts", framework: "vue", target: ["library"], test: "vitest" },
  "vue-app": { language: "ts", framework: "vue", target: ["app"], test: "vitest", release: "none", workflows: ["ci"] },
  "svelte-lib": { language: "ts", framework: "svelte", target: ["library"], test: "vitest" },
  "svelte-app": { language: "ts", framework: "svelte", target: ["app"], test: "vitest", release: "none", workflows: ["ci"] },
  "node-service": {
    language: "ts",
    target: ["service"],
    moduleFormat: "esm",
    bundler: "tsup",
    test: "vitest",
    lint: "eslint-prettier",
    gitHooks: "simple-git-hooks",
    release: "none",
    workflows: ["ci"],
    deps: "renovate",
    agents: true,
    vscode: true
  },
  monorepo: { monorepo: true, language: "ts", packageManager: "pnpm" },
  fullstack: {
    monorepo: true,
    monorepoLayout: "fullstack",
    language: "ts",
    packageManager: "pnpm",
    framework: "react",
    test: "vitest",
    release: "none",
    workflows: ["ci"]
  },
  oss: {
    language: "ts",
    target: ["library"],
    moduleFormat: "esm",
    bundler: "tsup",
    test: "vitest",
    coverage: true,
    lint: "eslint-prettier",
    gitHooks: "simple-git-hooks",
    release: "changesets",
    workflows: ["ci", "npm-publish", "codeql", "codecov"],
    deps: "renovate",
    community: true,
    agents: true,
    vscode: true,
    pkgChecks: true,
    knip: true
  },
  minimal: {
    language: "ts",
    target: ["library"],
    moduleFormat: "esm",
    bundler: "tsup",
    test: "none",
    lint: "none",
    gitHooks: "none",
    release: "none",
    workflows: ["ci"],
    deps: "none",
    community: false,
    agents: false,
    vscode: false
  },
  full: {
    language: "ts",
    target: ["library", "cli"],
    moduleFormat: "esm",
    bundler: "tsup",
    test: "vitest",
    coverage: true,
    lint: "eslint-prettier",
    gitHooks: "simple-git-hooks",
    release: "changesets",
    workflows: ["ci", "npm-publish", "pages", "codeql", "codecov", "stale"],
    deps: "renovate",
    community: true,
    agents: true,
    vscode: true
  }
};
var PRESET_NAMES = Object.keys(PRESETS);
var PRESET_ALIASES = {
  lib: "ts-lib",
  jslib: "js-lib",
  rlib: "react-lib",
  rapp: "react-app",
  vlib: "vue-lib",
  vapp: "vue-app",
  slib: "svelte-lib",
  sapp: "svelte-app",
  svc: "node-service",
  fs: "fullstack",
  app: "fullstack",
  service: "node-service"
};
function resolvePreset(name) {
  if (PRESETS[name]) return name;
  if (PRESET_ALIASES[name]) return PRESET_ALIASES[name];
  return void 0;
}
var PRESET_INFO = {
  "ts-lib": "TypeScript library \u2014 ESM-only, tsup, Vitest, ESLint.",
  "js-lib": "JavaScript (ESM) library \u2014 tsup, Vitest, ESLint.",
  "ts-cli": "TypeScript CLI + library \u2014 ESM, ships a bin.",
  cli: "TypeScript CLI tool \u2014 ESM, ships a bin.",
  "react-lib": "React component library (TS) \u2014 JSX, peer deps, jsdom tests.",
  "react-lib-js": "React component library (JS) \u2014 JSX, peer deps, jsdom tests.",
  "react-app": "React SPA \u2014 Vite dev server, build, Testing Library.",
  "vue-lib": "Vue component library \u2014 Vite lib build (SFCs), ESM + types.",
  "vue-app": "Vue SPA \u2014 Vite dev server, build, Testing Library.",
  "svelte-lib": "Svelte component library \u2014 ships source, peer svelte, jsdom tests.",
  "svelte-app": "Svelte SPA \u2014 Vite dev server, build, Testing Library.",
  "node-service": "Node HTTP service (Hono) \u2014 tsx dev, tsup build, Dockerfile.",
  monorepo: "pnpm + Turborepo workspace \u2014 two example packages, Changesets, CI.",
  fullstack: "Full-stack monorepo \u2014 React+Vite web, Hono/Fastify/Express API (--server), shared package; server serves the web build in production.",
  oss: "Full open-source library \u2014 coverage, CodeQL, Codecov, Renovate, Changesets.",
  minimal: "Bare TS library \u2014 tsup only, no tests/lint/CI.",
  full: "Everything on \u2014 library + CLI, all workflows and extras."
};

// src/core/index.js
function fromPreset(name, overrides = {}) {
  const canonical = resolvePreset(name);
  if (!canonical) throw new Error(`Unknown preset "${name}". Known: ${PRESET_NAMES.join(", ")}`);
  const cfg = normalizeConfig({ ...PRESETS[canonical], ...overrides });
  cfg.preset = canonical;
  return cfg;
}
function assemble(cfg) {
  const files = {};
  const fileSources = {};
  const fragments = [];
  let pkg = {};
  for (const feat of features_default) {
    if (!feat.active(cfg)) continue;
    const out = feat.apply(cfg) || {};
    if (out.files) {
      for (const [path, contents] of Object.entries(out.files)) {
        (fileSources[path] ||= []).push(feat.id);
        files[path] = contents;
      }
    }
    if (out.pkg) {
      fragments.push({ source: feat.id, pkg: out.pkg });
      pkg = deepMerge(pkg, out.pkg);
    }
  }
  return { files, fileSources, fragments, pkg };
}
function generateTracked(input, diagnostics = null) {
  const cfg = normalizeConfig(input, diagnostics);
  if (cfg.monorepo) {
    return { ...buildMonorepo(cfg), fileSources: {}, fragments: [] };
  }
  const { files, fileSources, fragments, pkg } = assemble(cfg);
  files["package.json"] = toJson(finalizePackageJson(pkg));
  files["packkit.json"] = provenance(cfg, buildBaseline(files));
  return {
    config: cfg,
    files,
    postCommands: postCommands(cfg),
    summary: summarize(cfg, files),
    fileSources,
    fragments
  };
}
function generate(input) {
  const { config, files, postCommands: postCommands2, summary } = generateTracked(input);
  return { config, files, postCommands: postCommands2, summary };
}
function postCommands(cfg) {
  const install = {
    npm: "npm install",
    pnpm: "pnpm install",
    yarn: "yarn install",
    bun: "bun install"
  }[cfg.packageManager];
  const cmds = [];
  if (cfg.gitInit) cmds.push("git init", "git add -A", 'git commit -m "Initial commit from Packkit"');
  if (cfg.install) cmds.push(install);
  return cmds;
}
function summarize(cfg, files) {
  return {
    name: cfg.name,
    fileCount: Object.keys(files).length,
    stack: [
      cfg.isTs ? "TypeScript" : "JavaScript",
      cfg.moduleFormat.toUpperCase(),
      cfg.target.join("+"),
      cfg.bundler !== "none" ? cfg.bundler : cfg.isTs ? "tsc" : "no-build",
      cfg.test !== "none" ? cfg.test : null,
      cfg.lint !== "none" ? cfg.lint : null,
      cfg.release !== "none" ? cfg.release : null
    ].filter(Boolean),
    workflows: cfg.workflows
  };
}
export {
  GROUPS,
  OPTIONS,
  OPTION_HELP,
  PRESETS,
  PRESET_ALIASES,
  PRESET_INFO,
  PRESET_NAMES,
  assemble,
  defaultConfig,
  fromPreset,
  generate,
  generateTracked,
  normalizeConfig,
  resolvePreset
};
