// Packkit core — pure, dependency-free, runs in Node AND the browser.
// generate(config) -> { config, files: { path: contents }, postCommands, summary }
// The CLI writes `files` to disk; the web configurator zips them.

import { normalizeConfig, OPTIONS, GROUPS, OPTION_HELP, defaultConfig } from './options.js';
import { deepMerge, toJson } from './render.js';
import { finalizePackageJson } from './pkg.js';
import features from './features/index.js';
import { buildMonorepo } from './monorepo.js';
import { provenance, buildBaseline } from './provenance.js';
import { PRESETS, PRESET_NAMES, PRESET_INFO, PRESET_ALIASES, resolvePreset } from './presets.js';

export { OPTIONS, GROUPS, OPTION_HELP, defaultConfig, normalizeConfig, PRESETS, PRESET_NAMES, PRESET_INFO, PRESET_ALIASES, resolvePreset };

/** Apply a named preset (or alias) over the defaults, returning a full config. */
export function fromPreset(name, overrides = {}) {
  const canonical = resolvePreset(name);
  if (!canonical) throw new Error(`Unknown preset "${name}". Known: ${PRESET_NAMES.join(', ')}`);
  const cfg = normalizeConfig({ ...PRESETS[canonical], ...overrides });
  // Recorded in packkit.json so a project knows which preset it came from.
  cfg.preset = canonical;
  return cfg;
}

/**
 * Run every active feature, collecting its files and package.json fragment.
 * Returns the raw material — file map, the fragments in contribution order,
 * and which feature produced each file — so callers that need provenance (the
 * embedded API's collision detection) get it without a second pass, while
 * `generate` folds it into the same output as before.
 */
export function assemble(cfg) {
  const files = {};
  const fileSources = {};
  const fragments = [];
  let pkg = {};

  for (const feat of features) {
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

/**
 * Generate, keeping the provenance assemble() produced. One assembly pass feeds
 * both the public files and the embedded API's conflict diagnostics, so the
 * bytes callers get and the provenance they inspect come from the same run.
 */
export function generateTracked(input, diagnostics = null) {
  const cfg = normalizeConfig(input, diagnostics);
  if (cfg.monorepo) {
    // The monorepo generator is a separate path with no per-feature fragments.
    return { ...buildMonorepo(cfg), fileSources: {}, fragments: [] };
  }

  const { files, fileSources, fragments, pkg } = assemble(cfg);
  files['package.json'] = toJson(finalizePackageJson(pkg));
  // Baseline covers every file generated so far (all but packkit.json itself).
  files['packkit.json'] = provenance(cfg, buildBaseline(files));

  return {
    config: cfg,
    files,
    postCommands: postCommands(cfg),
    summary: summarize(cfg, files),
    fileSources,
    fragments,
  };
}

/** Turn a config into a complete set of files. */
export function generate(input) {
  const { config, files, postCommands, summary } = generateTracked(input);
  return { config, files, postCommands, summary };
}

function postCommands(cfg) {
  const install = {
    npm: 'npm install',
    pnpm: 'pnpm install',
    yarn: 'yarn install',
    bun: 'bun install',
  }[cfg.packageManager];
  const cmds = [];
  if (cfg.gitInit) cmds.push('git init', 'git add -A', 'git commit -m "Initial commit from Packkit"');
  if (cfg.install) cmds.push(install);
  return cmds;
}

function summarize(cfg, files) {
  return {
    name: cfg.name,
    fileCount: Object.keys(files).length,
    stack: [
      cfg.isTs ? 'TypeScript' : 'JavaScript',
      cfg.moduleFormat.toUpperCase(),
      cfg.target.join('+'),
      // Framework apps build with Vite, not the standalone bundler (which they
      // don't use) — so report the tool the project actually runs.
      cfg.viteBuild && cfg.hasApp ? 'Vite' : cfg.bundler !== 'none' ? cfg.bundler : cfg.isTs ? 'tsc' : 'no-build',
      cfg.test !== 'none' ? cfg.test : null,
      cfg.lint !== 'none' ? cfg.lint : null,
      cfg.release !== 'none' ? cfg.release : null,
    ].filter(Boolean),
    workflows: cfg.workflows,
  };
}
