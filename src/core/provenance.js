// packkit.json — what this project was generated from.
//
// Packkit used to leave no trace, so a project couldn't answer "what did I
// start from?", couldn't be diffed against a newer template, and had no upgrade
// path. This records the answer next to the code.
//
// Only settings that differ from the defaults are stored, so the file reads as
// the decisions someone actually made rather than a dump of every option. It is
// deliberately free of timestamps and machine details: generation stays a pure
// function of the config, so the same config always produces the same bytes.

import { toJson } from './render.js';
import { defaultConfig } from './options.js';
import { contentHash } from './hash.js';

// How this particular run was invoked, rather than what the project is.
// Replaying a config shouldn't re-run someone else's `git init` or install.
const TRANSIENT = new Set(['gitInit', 'install', 'generatorVersion', 'preset', 'name']);

// Bumped if the baseline shape changes incompatibly.
const BASELINE_SCHEMA_VERSION = 1;
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const PROTECTED_FIELDS = ['exports', 'bin', 'main', 'module', 'types', 'files', 'engines', 'packageManager'];

/**
 * Serialize packkit.json: the settings that differ from the defaults, plus (when
 * supplied) a baseline of what was generated — per-file hashes and the
 * package.json scripts/deps/protected-fields at scaffold time — so a later
 * `packkit upgrade` can tell a user's edit from a template change.
 */
export function provenance(cfg, baseline) {
  const defaults = defaultConfig();
  const settings = {};
  for (const [key, value] of Object.entries(cfg)) {
    // Skip derived helpers (isTs, hasApp, ext…) — they aren't inputs.
    if (!(key in defaults) || TRANSIENT.has(key)) continue;
    if (JSON.stringify(value) !== JSON.stringify(defaults[key])) settings[key] = value;
  }

  return toJson({
    $schema: 'https://packkitlabs.github.io/create-packkit-js/packkit.schema.json',
    generator: 'create-packkit',
    ...(cfg.generatorVersion ? { version: cfg.generatorVersion } : {}),
    ...(cfg.preset ? { preset: cfg.preset } : {}),
    settings,
    ...(baseline ? { baseline } : {}),
  });
}

/**
 * Build the baseline from a fully-generated file map: a content hash for every
 * file (except packkit.json, which holds the baseline), plus a structural
 * snapshot of package.json. Deterministic — the same files always hash the same.
 */
export function buildBaseline(files) {
  const fileHashes = {};
  for (const path of Object.keys(files).sort()) {
    if (path === 'packkit.json') continue;
    fileHashes[path] = { hash: contentHash(files[path]) };
  }

  let packageJson = { scripts: {}, dependencies: {}, protectedFields: {} };
  if (files['package.json']) {
    try {
      const pkg = JSON.parse(files['package.json']);
      const dependencies = {};
      for (const section of DEP_SECTIONS) if (pkg[section]) dependencies[section] = { ...pkg[section] };
      const protectedFields = {};
      for (const field of PROTECTED_FIELDS) if (field in pkg) protectedFields[field] = pkg[field];
      packageJson = { scripts: { ...(pkg.scripts || {}) }, dependencies, protectedFields };
    } catch {
      /* leave the empty baseline */
    }
  }

  return { schemaVersion: BASELINE_SCHEMA_VERSION, files: fileHashes, packageJson };
}
