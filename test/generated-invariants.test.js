import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromPreset, generate } from '../src/core/index.js';

// These assert on the GENERATED FILES, not just the resolved config. The class
// of bug they guard against: an option that is parsed and stored on the config
// but never threaded into output — issue #71, where `--lint biome` was persisted
// on the config yet the monorepo path always emitted ESLint. The config-level
// invariants in invariants.test.js can't catch that; only inspecting what was
// actually written can. So this sweeps option combinations (the two monorepo
// layouts across every lint choice and package manager — where #71 lived — plus
// a representative set of single-package presets) and checks that the choice is
// realized and nothing from the other choices leaks in.

const LINT_TOOLS = ['eslint', '@biomejs/biome', 'oxlint'];

// The package name behind each lint binary a generated script may invoke.
const TOOL_OF_BIN = { eslint: 'eslint', biome: '@biomejs/biome', oxlint: 'oxlint', prettier: 'prettier' };

function allPackageJsons(files) {
  return Object.entries(files)
    .filter(([p]) => p === 'package.json' || p.endsWith('/package.json'))
    .map(([p, c]) => [p, JSON.parse(c)]);
}

function installedDeps(pkgs) {
  const names = new Set();
  for (const [, pkg] of pkgs)
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies'])
      for (const name of Object.keys(pkg[field] || {})) names.add(name);
  return names;
}

// Every preset (default options), plus the option axes #71 exposed: the two
// monorepo layouts × every lint choice × npm/pnpm, and single packages across
// the lint choices.
function sweep() {
  const configs = [];
  for (const preset of ['ts-lib', 'js-lib', 'react-app', 'react-lib', 'node-service', 'node-worker', 'monorepo', 'fullstack'])
    configs.push({ label: preset, cfg: fromPreset(preset, { name: 'x' }) });
  for (const preset of ['monorepo', 'fullstack'])
    for (const lint of ['eslint-prettier', 'biome', 'oxlint', 'none'])
      for (const packageManager of ['npm', 'pnpm'])
        configs.push({ label: `${preset} --lint ${lint} --pm ${packageManager}`, cfg: fromPreset(preset, { name: 'x', lint, packageManager }) });
  for (const lint of ['eslint-prettier', 'biome', 'oxlint', 'none'])
    configs.push({ label: `ts-lib --lint ${lint}`, cfg: fromPreset('ts-lib', { name: 'x', lint }) });
  return configs;
}

test('the chosen linter is applied, and no other linter leaks into the config files', () => {
  for (const { label, cfg } of sweep()) {
    const { files } = generate(cfg);
    const hasEslintCfg = 'eslint.config.js' in files;
    const hasBiome = 'biome.json' in files;

    if (cfg.lint === 'biome') {
      assert.ok(hasBiome, `${label}: expected biome.json`);
      assert.ok(!hasEslintCfg, `${label}: biome chosen but eslint.config.js was emitted`);
    } else if (cfg.lint === 'eslint-prettier') {
      assert.ok(hasEslintCfg, `${label}: expected eslint.config.js`);
      assert.ok(!hasBiome, `${label}: eslint chosen but biome.json was emitted`);
    } else {
      // oxlint (prettier-only config) and none emit neither linter's config file.
      assert.ok(!hasEslintCfg, `${label}: unexpected eslint.config.js for lint=${cfg.lint}`);
      assert.ok(!hasBiome, `${label}: unexpected biome.json for lint=${cfg.lint}`);
    }
  }
});

test('the lint tooling in dependencies matches the chosen linter exactly', () => {
  for (const { label, cfg } of sweep()) {
    const { files } = generate(cfg);
    const installed = installedDeps(allPackageJsons(files));
    const present = LINT_TOOLS.filter((t) => installed.has(t)).sort();
    const expected = { 'eslint-prettier': ['eslint'], biome: ['@biomejs/biome'], oxlint: ['oxlint'], none: [] }[cfg.lint].sort();
    assert.deepEqual(present, expected, `${label}: installed lint tools ${JSON.stringify(present)} != expected ${JSON.stringify(expected)}`);
  }
});

test('no generated script invokes a lint tool that is not a dependency', () => {
  for (const { label, cfg } of sweep()) {
    const { files } = generate(cfg);
    const pkgs = allPackageJsons(files);
    const installed = installedDeps(pkgs);
    for (const [path, pkg] of pkgs) {
      for (const [script, cmd] of Object.entries(pkg.scripts || {})) {
        const bin = String(cmd).trim().split(/\s+/)[0];
        const tool = TOOL_OF_BIN[bin];
        if (tool) assert.ok(installed.has(tool), `${label}: ${path} script "${script}" runs ${bin}, but ${tool} is not installed`);
      }
    }
  }
});

test('CI runs a lint step exactly when the root package has a lint script', () => {
  for (const { label, cfg } of sweep()) {
    const { files } = generate(cfg);
    const ci = files['.github/workflows/ci.yml'];
    if (!ci) continue;
    const hasLintScript = !!JSON.parse(files['package.json']).scripts?.lint;
    const run = cfg.packageManager === 'npm' ? 'npm run lint' : `${cfg.packageManager} lint`;
    assert.equal(ci.includes(`run: ${run}`), hasLintScript, `${label}: CI lint step must match presence of a root lint script`);
  }
});

test('the Turborepo cache is gitignored whenever turbo.json is generated', () => {
  for (const { label, cfg } of sweep()) {
    const { files } = generate(cfg);
    if (!('turbo.json' in files)) continue;
    assert.ok((files['.gitignore'] || '').includes('.turbo/'), `${label}: turbo.json present but .turbo/ is not gitignored`);
  }
});
