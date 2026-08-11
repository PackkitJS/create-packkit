import { parseArgs } from 'node:util';
import { resolvePreset, PRESET_NAMES, PRESET_ALIASES } from '../core/presets.js';

/** Thrown for malformed CLI input the caller should report and exit non-zero on. */
export class CliArgError extends Error {}

// Map friendly flag names to config keys for non-interactive use.
const OVERRIDE_FLAGS = {
  language: 'language',
  module: 'moduleFormat',
  framework: 'framework',
  bundler: 'bundler',
  test: 'test',
  lint: 'lint',
  hooks: 'gitHooks',
  release: 'release',
  deps: 'deps',
  license: 'license',
  pm: 'packageManager',
  node: 'nodeVersion',
  server: 'serviceFramework',
  author: 'author',
  description: 'description',
  keywords: 'keywords',
  repo: 'repo',
  'monorepo-layout': 'monorepoLayout',
};

// Boolean options that default ON — a --no-<flag> turns them off.
const NEGATABLE = {
  'no-coverage': 'coverage',
  'no-sourcemaps': 'sourcemaps',
  'no-community': 'community',
  'no-agents': 'agents',
  'no-vscode': 'vscode',
  'no-editorconfig': 'editorconfig',
};

export function parseCliArgs(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      preset: { type: 'string' },
      from: { type: 'string' },
      name: { type: 'string' },
      yes: { type: 'boolean', short: 'y' },
      recommended: { type: 'boolean' },
      here: { type: 'boolean' },
      merge: { type: 'boolean' },
      github: { type: 'boolean' },
      'git-remote': { type: 'string' },
      public: { type: 'boolean' },
      'no-install': { type: 'boolean' },
      'no-git': { type: 'boolean' },
      minify: { type: 'boolean' },
      target: { type: 'string', multiple: true },
      workflows: { type: 'string', multiple: true },
      monorepo: { type: 'boolean' },
      storybook: { type: 'boolean' },
      e2e: { type: 'boolean' },
      env: { type: 'boolean' },
      canary: { type: 'boolean' },
      'pkg-checks': { type: 'boolean' },
      knip: { type: 'boolean' },
      'size-limit': { type: 'boolean' },
      doctor: { type: 'boolean' },
      jsr: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      schema: { type: 'boolean' },
      ...Object.fromEntries(Object.keys(OVERRIDE_FLAGS).map((k) => [k, { type: 'string' }])),
      ...Object.fromEntries(Object.keys(NEGATABLE).map((k) => [k, { type: 'boolean' }])),
    },
  });

  // A preset may be given in either positional slot — `name preset` or
  // `preset name` — so check both, not only the first. (A preset in the second
  // slot used to be swallowed silently, producing the wrong project at exit 0.)
  let preset = values.preset;
  const pos = [...positionals];
  if (!preset) {
    const at = pos.findIndex((p) => resolvePreset(p));
    if (at !== -1) preset = pos.splice(at, 1)[0];
  }
  const name = values.name || pos.shift();

  // Anything still unconsumed is unrecognized. Erroring is the point: the silence
  // was the real defect — a mistyped preset must not yield the wrong project.
  if (pos.length) {
    const bad = pos[0];
    const guess = closestPreset(bad);
    throw new CliArgError(
      `Unrecognized argument "${bad}".` +
        (guess ? ` Did you mean the "${guess}" preset?` : '') +
        ' Run `create-packkit --help` to see presets and flags.',
    );
  }

  const overrides = {};
  for (const [flag, key] of Object.entries(OVERRIDE_FLAGS)) {
    if (values[flag] != null) overrides[key] = values[flag];
  }
  if (values.target) overrides.target = values.target;
  if (values.workflows) overrides.workflows = values.workflows;
  if (values.minify) overrides.minify = true;
  if (values.monorepo) overrides.monorepo = true;
  if (values.storybook) overrides.storybook = true;
  if (values.e2e) overrides.e2e = true;
  if (values.env) overrides.env = true;
  if (values.canary) overrides.canary = true;
  if (values['pkg-checks']) overrides.pkgChecks = true;
  if (values.knip) overrides.knip = true;
  if (values['size-limit']) overrides.sizeLimit = true;
  if (values.doctor) overrides.doctor = true;
  if (values.jsr) overrides.jsr = true;
  for (const [flag, key] of Object.entries(NEGATABLE)) {
    if (values[flag]) overrides[key] = false;
  }
  if (name) overrides.name = name;

  // Config flags provided (anything beyond the name) → the user knows what they
  // want, so we can skip the wizard.
  const hasConfigFlags = Object.keys(overrides).some((k) => k !== 'name');

  return {
    preset,
    from: values.from,
    name,
    here: !!values.here,
    merge: !!values.merge,
    github: !!values.github,
    gitRemote: values['git-remote'] || null,
    // Publishing code outward is opt-in, and private is the safe default — a
    // wrong guess here leaks source, so --public must be asked for explicitly.
    private: !values.public,
    yes: !!values.yes || !!values.recommended,
    hasConfigFlags,
    install: !values['no-install'],
    git: !values['no-git'],
    help: !!values.help,
    version: !!values.version,
    schema: !!values.schema,
    overrides,
  };
}

// Suggest the nearest preset or alias to an unrecognized token, but only when
// it's actually close — a wild typo gets no misleading suggestion.
function closestPreset(token) {
  const candidates = [...PRESET_NAMES, ...Object.keys(PRESET_ALIASES)];
  let best;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(token, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return bestDistance <= Math.max(2, Math.ceil(token.length / 3)) ? best : undefined;
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}
