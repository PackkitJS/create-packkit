// Upgrade planning.
//
// A project scaffolded by Packkit records what it came from in packkit.json —
// the settings, and (since the baseline was added) a hash of every generated
// file plus the package.json scripts/deps/fields at scaffold time. That lets an
// upgrade do a three-way comparison:
//
//   baseline (what Packkit generated)  vs  current (on disk)  vs  new (regenerated)
//
//   current == baseline, new != baseline  → template-only change → safe to apply
//   current != baseline, new == baseline  → user-only edit       → preserve
//   current != baseline, new != baseline  → both changed         → conflict, review
//
// Without a baseline (older projects) it falls back to the conservative model:
// anything that differs is preserved and needs manual review.
//
// This module is pure: it takes file maps and returns a classified plan.

import { finalizePackageJson } from '../core/pkg.js';
import { deepMerge, toJson } from '../core/render.js';
import { contentHash } from '../core/hash.js';
import { classifyChange } from '@packkit/core';

const STRUCTURAL = new Set(['package.json', 'packkit.json']);
const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
const PROTECTED_FIELDS = ['exports', 'bin', 'main', 'module', 'types', 'files', 'engines', 'packageManager'];

/** The conservative default: add what's new (and safe template-only changes),
 *  preserve everything a user may have edited. */
export const DEFAULT_UPGRADE_POLICY = Object.freeze({
  files: 'add-only',
  scripts: 'add-only',
  dependencies: 'add-only',
  packageFields: 'add-only',
});

const emptyDepMap = () => ({ dependencies: {}, devDependencies: {}, peerDependencies: {}, optionalDependencies: {} });
const APPLY_MODES = new Set(['add-only', 'replace-changed']);

// Validate a caller-supplied apply policy, so a typo ({ scripts: 'replace' })
// fails loudly instead of silently behaving like add-only.
function resolvePolicy(policy) {
  const p = { ...DEFAULT_UPGRADE_POLICY };
  for (const [category, mode] of Object.entries(policy || {})) {
    if (!(category in DEFAULT_UPGRADE_POLICY)) throw new TypeError(`Unknown upgrade policy category "${category}".`);
    if (!APPLY_MODES.has(mode)) throw new TypeError(`Invalid upgrade policy for "${category}": "${mode}" (expected 'add-only' or 'replace-changed').`);
    p[category] = mode;
  }
  return p;
}

// The three-way classification now lives in @packkit/core (classifyChange). This
// thin adapter keeps the call sites' signature (the baseline value itself is
// unused — only the equality booleans matter). Same output as before.
function classify(hasBaseline, _baseline, currentEqBaseline, generatedEqBaseline) {
  return classifyChange({ hasBaseline, currentEqualsBaseline: currentEqBaseline, generatedEqualsBaseline: generatedEqBaseline });
}

/**
 * Classify how a freshly-generated project differs from what's on disk.
 * The baseline is read from the on-disk packkit.json (when present).
 *
 * @param {object} input
 * @param {Record<string,string>} input.generated  current createProject().files
 * @param {Record<string,string|undefined>} input.onDisk  on-disk content per generated path
 */
export function planUpgrade({ generated, onDisk }) {
  const baseline = readBaseline(onDisk['packkit.json']);
  const hasBaseline = !!baseline;

  const added = [];
  const changed = [];
  const unchanged = [];
  const entries = {};

  for (const [path, content] of Object.entries(generated)) {
    if (STRUCTURAL.has(path)) continue;
    const disk = onDisk[path];
    if (disk === undefined) {
      added.push(path);
      continue;
    }
    if (disk === content) {
      unchanged.push(path);
      continue;
    }
    changed.push(path);
    const baseHash = baseline?.files?.[path]?.hash;
    const c = classify(hasBaseline && baseHash != null, baseHash, contentHash(disk) === baseHash, contentHash(content) === baseHash);
    entries[path] = c;
  }

  const diagnostics = [];
  if (!hasBaseline) {
    diagnostics.push({
      severity: 'warning',
      code: 'UPGRADE_BASELINE_UNAVAILABLE',
      message: 'This project has no baseline metadata; values that differ are preserved and need manual review.',
      source: 'upgrade',
    });
  }
  // Surface an unparseable package.json — the diff silently skips it, which
  // could otherwise read as "no package changes".
  if (onDisk['package.json'] !== undefined && !parseable(onDisk['package.json'])) {
    diagnostics.push({ severity: 'error', code: 'PACKAGE_JSON_PARSE_FAILED', message: 'The current package.json could not be parsed; package changes were not planned.', source: 'upgrade' });
  }

  return {
    files: { added: added.sort(), changed: changed.sort(), unchanged: unchanged.sort(), entries },
    packageJson: diffPackageJson(onDisk['package.json'], generated['package.json'], baseline),
    baselineAvailable: hasBaseline,
    diagnostics,
    // packkit.json records the generator version + baseline, so it always
    // "changes" on an upgrade; applying the upgrade refreshes it.
    provenanceOutdated: onDisk['packkit.json'] !== generated['packkit.json'],
  };
}

/** True when a plan found nothing to bring in. */
export function isUpgradeEmpty(plan) {
  const p = plan.packageJson;
  const depsEmpty = (m) => DEP_SECTIONS.every((s) => Object.keys(m[s]).length === 0);
  return (
    plan.files.added.length === 0 &&
    plan.files.changed.length === 0 &&
    Object.keys(p.addedScripts).length === 0 &&
    Object.keys(p.changedScripts).length === 0 &&
    depsEmpty(p.addedDependencies) &&
    depsEmpty(p.changedDependencies) &&
    p.addedFields.length === 0 &&
    p.changedFields.length === 0 &&
    !plan.provenanceOutdated
  );
}

/**
 * Count a plan into safe (additive + template-only, applied by default), review
 * (user edits and unclassified diffs, preserved), and conflicts (both-changed).
 */
export function summarizeUpgrade(plan) {
  const p = plan.packageJson;
  let safeChanges = plan.files.added.length + Object.keys(p.addedScripts).length + depCount(p.addedDependencies) + p.addedFields.length;
  let reviewChanges = 0;
  let conflicts = 0;

  const tally = (entry) => {
    if (entry.safeToApply) safeChanges++;
    else if (entry.status === 'both-changed') { conflicts++; reviewChanges++; }
    else reviewChanges++;
  };
  for (const path of plan.files.changed) tally(plan.files.entries[path]);
  for (const c of Object.values(p.changedScripts)) tally(c);
  for (const section of DEP_SECTIONS) for (const c of Object.values(p.changedDependencies[section])) tally(c);
  for (const c of p.changedFields) tally(c);

  return { safeChanges, reviewChanges, conflicts };
}

/**
 * Build the { path: content } map to write for a plan, under an apply policy.
 * Under 'add-only' (default), additions and *template-only* changes apply —
 * both are safe (the user hadn't edited them). 'replace-changed' also applies
 * user-edited and both-changed values.
 */
export function buildUpgradeWrite({ generated, onDisk, plan, policy } = {}) {
  const p = resolvePolicy(policy);
  const out = {};

  for (const path of plan.files.added) out[path] = generated[path];
  for (const path of plan.files.changed) {
    if (p.files === 'replace-changed' || plan.files.entries[path].safeToApply) out[path] = generated[path];
  }

  if (onDisk['package.json'] && generated['package.json']) {
    const merged = mergePackageJson(onDisk['package.json'], generated['package.json'], plan.packageJson, p);
    if (merged !== null) out['package.json'] = merged;
  }
  // Refresh packkit.json honestly: new baseline, but marked partial (with a
  // count) when the policy leaves changes unresolved — never implying the
  // project fully matches the new version when it doesn't.
  if (plan.provenanceOutdated && generated['packkit.json']) {
    out['packkit.json'] = upgradedProvenance(onDisk['packkit.json'], generated['packkit.json'], countUnresolved(plan, p));
  }
  return out;
}

const willApply = (mode, entry) => mode === 'replace-changed' || entry.safeToApply;

function mergePackageJson(diskStr, genStr, pkgPlan, policy) {
  let disk;
  let gen;
  try {
    disk = JSON.parse(diskStr);
    gen = JSON.parse(genStr);
  } catch {
    return null;
  }

  let touched = false;
  const patch = {};

  for (const section of DEP_SECTIONS) {
    for (const name of Object.keys(pkgPlan.addedDependencies[section])) { (patch[section] ||= {})[name] = gen[section][name]; touched = true; }
    for (const [name, change] of Object.entries(pkgPlan.changedDependencies[section])) {
      if (willApply(policy.dependencies, change)) { (patch[section] ||= {})[name] = gen[section][name]; touched = true; }
    }
  }

  const scripts = {};
  for (const name of Object.keys(pkgPlan.addedScripts)) { scripts[name] = gen.scripts[name]; touched = true; }
  for (const [name, change] of Object.entries(pkgPlan.changedScripts)) {
    if (willApply(policy.scripts, change)) { scripts[name] = gen.scripts[name]; touched = true; }
  }
  if (Object.keys(scripts).length) patch.scripts = scripts;

  let merged = deepMerge(disk, patch);
  // Protected fields are assigned whole (a merge could leave a stale nested key).
  for (const { field } of pkgPlan.addedFields) { merged = { ...merged, [field]: gen[field] }; touched = true; }
  for (const change of pkgPlan.changedFields) {
    if (willApply(policy.packageFields, change)) { merged = { ...merged, [change.field]: gen[change.field] }; touched = true; }
  }

  if (!touched) return null;
  return toJson(finalizePackageJson(merged));
}

// How many changed items the policy leaves unresolved (preserved, not applied).
function countUnresolved(plan, policy) {
  let n = 0;
  for (const path of plan.files.changed) if (!willApply(policy.files, plan.files.entries[path])) n++;
  for (const c of Object.values(plan.packageJson.changedScripts)) if (!willApply(policy.scripts, c)) n++;
  for (const section of DEP_SECTIONS) for (const c of Object.values(plan.packageJson.changedDependencies[section])) if (!willApply(policy.dependencies, c)) n++;
  for (const c of plan.packageJson.changedFields) if (!willApply(policy.packageFields, c)) n++;
  return n;
}

// Build the packkit.json to write after an upgrade. Its baseline moves to the
// current-version generated state (so preserved user edits are correctly seen
// as customizations next time), but it does NOT claim the project was generated
// with the new version — `version` (generatedWith) stays original, and upgrade
// tracking fields record what actually happened. A partial upgrade is marked as
// such rather than looking fully current.
function upgradedProvenance(diskStr, genStr, unresolved) {
  let disk = {};
  let gen;
  try {
    gen = JSON.parse(genStr);
    if (diskStr) disk = JSON.parse(diskStr);
  } catch {
    return genStr; // can't reason about it — fall back to the regenerated file
  }
  const toVersion = gen.version;
  const out = {
    ...gen,
    version: disk.version || gen.version, // generatedWith: unchanged by an upgrade
  };
  if (toVersion) {
    out.lastUpgradeCheckedWith = toVersion;
    out.lastUpgradeAppliedWith = toVersion;
  }
  out.upgradeStatus = unresolved > 0 ? 'partial' : 'current';
  if (unresolved > 0) out.unresolvedChanges = unresolved;
  return toJson(out);
}

// Structural package.json diff, three-way-classified against the baseline
// snapshot when present.
export function diffPackageJson(diskStr, genStr, baseline) {
  const empty = {
    addedScripts: {},
    changedScripts: {},
    addedDependencies: emptyDepMap(),
    changedDependencies: emptyDepMap(),
    addedFields: [],
    changedFields: [],
  };
  if (!diskStr || !genStr) return empty;

  let disk;
  let gen;
  try {
    disk = JSON.parse(diskStr);
    gen = JSON.parse(genStr);
  } catch {
    return empty;
  }

  const base = baseline?.packageJson;
  const hasBase = !!base;

  const addedDependencies = emptyDepMap();
  const changedDependencies = emptyDepMap();
  for (const section of DEP_SECTIONS) {
    for (const [name, version] of Object.entries(gen[section] || {})) {
      const current = disk[section]?.[name];
      if (current === undefined) {
        addedDependencies[section][name] = { generated: version };
      } else if (current !== version) {
        const b = base?.[section]?.[name];
        changedDependencies[section][name] = { current, generated: version, ...classify(hasBase && b !== undefined, b, current === b, version === b) };
      }
    }
  }

  const addedScripts = {};
  const changedScripts = {};
  for (const [name, cmd] of Object.entries(gen.scripts || {})) {
    const current = disk.scripts?.[name];
    if (current === undefined) addedScripts[name] = cmd;
    else if (current !== cmd) {
      const b = base?.scripts?.[name];
      changedScripts[name] = { current, generated: cmd, ...classify(hasBase && b !== undefined, b, current === b, cmd === b) };
    }
  }

  const addedFields = [];
  const changedFields = [];
  for (const field of PROTECTED_FIELDS) {
    if (!(field in gen)) continue;
    if (!(field in disk)) {
      addedFields.push({ field, generated: gen[field] });
    } else if (JSON.stringify(disk[field]) !== JSON.stringify(gen[field])) {
      const b = base?.protectedFields?.[field];
      const bStr = JSON.stringify(b);
      changedFields.push({
        field,
        current: disk[field],
        generated: gen[field],
        ...classify(hasBase && b !== undefined, b, JSON.stringify(disk[field]) === bStr, JSON.stringify(gen[field]) === bStr),
      });
    }
  }

  return { addedScripts, changedScripts, addedDependencies, changedDependencies, addedFields, changedFields };
}

function depCount(map) {
  return DEP_SECTIONS.reduce((n, s) => n + Object.keys(map[s]).length, 0);
}

function parseable(str) {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Read the baseline out of an on-disk packkit.json string. Returns null when
// absent or unreadable (older projects), which drives the conservative fallback.
function readBaseline(packkitJsonStr) {
  if (!packkitJsonStr) return null;
  try {
    const b = JSON.parse(packkitJsonStr).baseline;
    return b && typeof b === 'object' && b.files ? b : null;
  } catch {
    return null;
  }
}
