// The package.json ManifestDiffer — create-packkit's manifest semantics as a
// first-class @packkit/core ManifestDiffer. This is the seam the platform keeps
// per-generator: core does the file-level three-way diff; each generator plugs in
// its structured manifest semantics (package.json here, pyproject.toml for Python).
// The npm-specific concepts (scripts / dependency sections / protected fields)
// live behind this interface, never in core.
//
// It reuses the exact serialization and three-way diff the upgrade path already
// uses, so there's a single source of truth for package.json behavior.

import { toJson } from '@packkit/core';
import { finalizePackageJson } from '../core/pkg.js';
import { diffPackageJson } from './upgrade.js';

const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const PROTECTED_FIELDS = ['exports', 'bin', 'main', 'module', 'types', 'files', 'engines', 'packageManager'];

/** @type {import('@packkit/core').ManifestDiffer} */
export const packageJsonDiffer = {
  filename: 'package.json',

  parse(content) {
    return JSON.parse(content);
  },

  serialize(pkg) {
    return toJson(finalizePackageJson(pkg));
  },

  // Structural snapshot stored in the baseline: scripts, dependency sections, and
  // protected fields — the inputs a later three-way diff compares against.
  snapshot(pkg) {
    const dependencies = {};
    for (const section of DEP_SECTIONS) if (pkg[section]) dependencies[section] = { ...pkg[section] };
    const protectedFields = {};
    for (const field of PROTECTED_FIELDS) if (field in pkg) protectedFields[field] = pkg[field];
    return { scripts: { ...(pkg.scripts || {}) }, dependencies, protectedFields };
  },

  // Three-way package.json diff (added + changed, with safe-to-apply classification
  // for each changed script/dependency/field). Delegates to the upgrade path's
  // diffPackageJson so behavior is identical to a real `packkit upgrade`.
  diff({ baseline, current, generated }) {
    // The ManifestDiffer contract's `baseline` is this manifest's snapshot; the
    // upgrade path's diffPackageJson reads it from `.packageJson` (the project
    // baseline nests it), so wrap it to match.
    return diffPackageJson(JSON.stringify(current), JSON.stringify(generated), baseline ? { packageJson: baseline } : undefined);
  },
};
