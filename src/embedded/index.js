// Embedded API — the supported entry point for a Node application that wants
// to use Packkit as a project-generation engine.
//
// Everything here is pure and side-effect free except the writer (separate
// module). No prompts, no installs, no git, no network, no command execution.
// A host calls createProject() to generate in memory, extendProject() to add
// its own deployment files, and writeGeneratedProject() when it wants disk.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PACKKIT_PROTOCOL_VERSION, calculateGeneratedProjectDigest } from '@packkit/core';
import { GENERATOR_ID } from './constants.js';

import {
  generateTracked,
  normalizeConfig,
  resolvePreset,
  PRESETS,
  OPTIONS,
} from '../core/index.js';
import { finalizePackageJson } from '../core/pkg.js';
import { deepMerge, toJson } from '../core/render.js';
import { validateRelativePath, validatePathMap } from './paths.js';
import { analyzePkgFragments } from './pkg-merge.js';
import { deriveDeploymentContract } from './contract.js';
import { planUpgrade, isUpgradeEmpty, buildUpgradeWrite, DEFAULT_UPGRADE_POLICY, summarizeUpgrade } from './upgrade.js';

export { deriveDeploymentContract };
export { planUpgrade, isUpgradeEmpty, buildUpgradeWrite, DEFAULT_UPGRADE_POLICY, summarizeUpgrade };
// create-packkit as a @packkit/core PackkitGenerator (the platform interface).
export { packkitGenerator } from './generator.js';
export { packageJsonDiffer } from './manifest-differ.js';
export { GENERATOR_ID };

// Bumped when the shape of PackkitProjectDefinition changes incompatibly.
export const SCHEMA_VERSION = 2;

// Resource ceilings for definitions loaded from untrusted stores (a database,
// an upload, a queue). Generous enough for any real project, small enough to
// refuse a hostile blob before it reaches the filesystem.
const MAX_DEFINITION_FILES = 5000;
const MAX_DEFINITION_BYTES = 50_000_000;

const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** Non-OPTIONS config keys the pipeline sets itself; not "unknown". */
const KNOWN_EXTRA_KEYS = new Set(['preset', 'generatorVersion', 'resolved']);

// Fields where a host override silently changing an existing value is worth a
// diagnostic (matches pkg-merge's protected set + dependency maps).
const PROTECTED_PKG_FIELDS = new Set(['scripts', 'exports', 'bin', 'main', 'module', 'types', 'files', 'engines', 'packageManager']);
const DEP_MAPS = new Set(['dependencies', 'devDependencies', 'peerDependencies']);

// Replay state lives off to the side, keyed by the project object, so the
// public GeneratedProject stays clean (no leaking `_extensions`), immutable to
// consumers, and never accidentally serialized into logs or API responses.
const extensionState = new WeakMap();

/** Thrown when a config or definition cannot produce a valid project. */
export class PackkitValidationError extends Error {
  constructor(message, diagnostics) {
    super(message);
    this.name = 'PackkitValidationError';
    this.code = 'PACKKIT_VALIDATION_FAILED';
    this.diagnostics = diagnostics;
  }
}

let cachedVersion;
function packkitVersion() {
  if (cachedVersion) return cachedVersion;
  try {
    const url = new URL('../../package.json', import.meta.url);
    cachedVersion = JSON.parse(readFileSync(fileURLToPath(url), 'utf8')).version;
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion;
}

/**
 * Resolve a preset + overrides into a complete, validated config, collecting
 * the diagnostics normalization produced — without generating anything.
 *
 * Generation and resolution are split so a trusted caller (the CLI) can make
 * decisions on the resolved config — a Node-floor check, creating the remote —
 * and then generate, while a host app just uses createProject() which does both.
 * Throws PackkitValidationError if the config is fatally invalid.
 *
 * @returns {{ config: object, diagnostics: object[] }}
 */
export function resolveProjectConfig(input = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('resolveProjectConfig expects an input object.');

  const merged = { ...(input.config || {}), ...(input.overrides || {}) };
  if (input.name != null) merged.name = input.name;

  const preErrors = validateInput(merged);
  if (preErrors.length) {
    throw new PackkitValidationError('The configuration is not valid; see error.diagnostics.', preErrors);
  }

  const diagnostics = [...unknownOptionDiagnostics(merged)];

  let canonicalPreset;
  if (input.preset) {
    canonicalPreset = resolvePreset(input.preset);
    if (!canonicalPreset) {
      throw new PackkitValidationError(`Unknown preset "${input.preset}".`, [
        { severity: 'error', code: 'UNKNOWN_PRESET', field: 'preset', message: `Unknown preset "${input.preset}".`, source: 'validate' },
      ]);
    }
  }
  // Normalize ONCE, with the collector, over the raw preset+overrides — a second
  // pass would see values already settled and report nothing. The preset is
  // folded into `raw` (not set afterwards) so it reaches provenance during this
  // pass; otherwise a replayed definition, whose config carries the preset, would
  // bake it into packkit.json while the original did not — and the digests diverge.
  const raw = canonicalPreset
    ? { ...PRESETS[canonicalPreset], ...merged, preset: canonicalPreset }
    : merged;
  const config = normalizeConfig({ ...raw, generatorVersion: packkitVersion() }, diagnostics);
  return { config, diagnostics };
}

/**
 * Generate a complete project in memory. No files are written, nothing is
 * installed, no commands run. Returns a GeneratedProject with diagnostics.
 * Throws PackkitValidationError if the config is fatally invalid.
 */
export function createProject(input = {}) {
  const { config, diagnostics } = resolveProjectConfig(input);
  return assembleProject(config, diagnostics);
}

/**
 * Build a project from an already-resolved config (from resolveProjectConfig,
 * possibly with a field like `repo` set since). For trusted callers only — the
 * config is assumed valid; pass its resolution diagnostics through so they
 * appear on the project. Re-normalizes idempotently.
 */
export function createProjectFromResolvedConfig(config, { diagnostics = [] } = {}) {
  const resolved = normalizeConfig({ generatorVersion: packkitVersion(), ...config });
  return assembleProject(resolved, [...diagnostics]);
}

// Shared generation core: turn a resolved config into a GeneratedProject,
// appending collision and package-conflict diagnostics to whatever the caller
// already collected during resolution.
function assembleProject(config, diagnostics) {
  const { files, summary, fileSources, fragments } = generateTracked(config);

  for (const [path, sources] of Object.entries(fileSources)) {
    if (sources.length > 1) {
      diagnostics.push({
        severity: 'warning',
        code: 'FEATURE_FILE_COLLISION',
        field: path,
        message: `"${path}" was written by more than one feature (${sources.join(', ')}); the last one wins.`,
        source: 'assemble',
      });
    }
  }
  diagnostics.push(...analyzePkgFragments(fragments).diagnostics);

  return finish({
    config,
    files,
    summary,
    diagnostics,
    // Protocol-native metadata (4.0): create-packkit's embedded API speaks the
    // @packkit/core platform shape directly, so its GeneratedProject IS a valid
    // core GeneratedProject (the packkitGenerator adapter is a near pass-through).
    metadata: {
      generatorId: GENERATOR_ID,
      generatorVersion: packkitVersion(),
      protocolVersion: PACKKIT_PROTOCOL_VERSION,
      schemaVersion: SCHEMA_VERSION,
      preset: config.preset,
    },
    deploymentContract: deriveDeploymentContract(config),
  }, { files: {}, packageJson: {} });
}

/**
 * Return a NEW project with the extension's files and package.json fields
 * layered on. Never mutates `project`. Extension file paths and contents are
 * validated; collisions with existing files follow collisionPolicy ('error'
 * by default), and host overrides of existing package fields are reported.
 */
export function extendProject(project, extension = {}, internal = {}) {
  assertProject(project);
  // Internal: a path→mode map lets definition replay preserve the ORIGINAL
  // add/replace intent instead of re-deriving it against the current base.
  // Without it, an `add` that now collides would be re-recorded as `replace`,
  // and the drift warning would vanish after one load-and-save cycle.
  const storedModes = internal.fileModes || null;
  const policy = extension.collisionPolicy || 'error';
  if (!['error', 'skip', 'overwrite'].includes(policy)) {
    throw new TypeError(`Unknown collisionPolicy "${policy}".`);
  }

  const files = { ...project.files };
  const diagnostics = [...project.diagnostics];
  const extFiles = extension.files || {};

  // Validate paths AND content up front: an invalid path or a non-string value
  // anywhere means the whole extension is rejected, not half-applied.
  const { diagnostics: pathDiag } = validatePathMap(extFiles);
  const fatal = [...pathDiag.filter((d) => d.severity === 'error')];
  for (const [path, contents] of Object.entries(extFiles)) {
    if (typeof contents !== 'string') {
      fatal.push({ severity: 'error', code: 'INVALID_FILE_CONTENT', field: path, message: `Contents of "${path}" must be a string.`, source: 'extend' });
    }
  }
  if (fatal.length) throw new PackkitValidationError('Extension files are not valid; see error.diagnostics.', fatal);

  const prevState = extensionState.get(project) || { files: {}, packageJson: {} };
  const stateFiles = { ...prevState.files };

  for (const [path, contents] of Object.entries(extFiles)) {
    const target = validateRelativePath(path).normalized;
    const collides = target in files;
    if (collides) {
      if (policy === 'error') {
        throw new PackkitValidationError(`Extension file "${path}" collides with a generated file.`, [
          { severity: 'error', code: 'EXTENSION_FILE_COLLISION', field: path, message: `"${path}" already exists in the generated project.`, source: 'extend' },
        ]);
      }
      diagnostics.push({
        severity: 'info',
        code: policy === 'skip' ? 'EXTENSION_FILE_SKIPPED' : 'EXTENSION_FILE_OVERWRITTEN',
        field: path,
        message: policy === 'skip' ? `"${path}" was kept from the generated project.` : `"${path}" was replaced by the extension.`,
        source: 'extend',
      });
      if (policy === 'skip') continue;
    }
    files[target] = contents;
    // "add" = the host introduced a path Packkit didn't generate; "replace" =
    // deliberately overriding generated output. Recorded so a stored definition
    // can tell, on replay under a newer Packkit, whether an add now collides
    // with a file that version started generating. A stored mode (from replay)
    // wins over the freshly-computed one, so the original intent survives a
    // load-and-save round-trip.
    const mode = storedModes && target in storedModes ? storedModes[target] : collides ? 'replace' : 'add';
    stateFiles[target] = { content: contents, mode };
  }

  let packageJson = prevState.packageJson;
  if (extension.packageJson && Object.keys(extension.packageJson).length) {
    const current = JSON.parse(files['package.json']);
    diagnostics.push(...extensionPackageDiagnostics(current, extension.packageJson));
    const mergedPkg = finalizePackageJson(deepMerge(current, extension.packageJson));
    files['package.json'] = toJson(mergedPkg);
    // Keep the raw override for definition export, minus prototype-poisoning keys.
    packageJson = deepMerge(packageJson, extension.packageJson);
  }

  return finish({
    config: project.config,
    files,
    summary: { ...project.summary, fileCount: Object.keys(files).length },
    diagnostics,
    metadata: { ...project.metadata, ...(extension.metadata ? { extension: extension.metadata } : {}) },
    deploymentContract: project.deploymentContract,
  }, { files: stateFiles, packageJson });
}

/**
 * A serializable definition that reproduces this project later. Contains no
 * secrets and no absolute paths — the config, preset, and the extension
 * material the host layered on (each file tagged add/replace).
 */
export function exportProjectDefinition(project) {
  assertProject(project);
  const state = extensionState.get(project) || { files: {}, packageJson: {} };
  // Honor BOTH extension sources: the rich embedded extendProject (WeakMap state)
  // and @packkit/core's generic extendGeneratedProject (project.extensions). Both
  // record { mode, content } per file, so a host can layer files either way and
  // the intent survives export → replay.
  const coreFiles = project.extensions?.files || {};
  return {
    schemaVersion: SCHEMA_VERSION,
    packkitVersion: project.metadata.generatorVersion,
    preset: project.metadata.preset,
    config: serializableConfig(project.config),
    extensions: {
      files: {
        ...coreFiles,
        ...Object.fromEntries(Object.entries(state.files).map(([p, e]) => [p, { content: e.content, mode: e.mode }])),
      },
      packageJson: { ...state.packageJson },
    },
  };
}

/**
 * Rebuild a project from a stored definition, re-applying its extensions.
 *
 * If a file the host originally *added* now collides with one the current
 * Packkit generates, that's surfaced as an error-severity diagnostic. With
 * `driftPolicy: 'error'` that condition throws instead — for a caller that
 * wants an unreconciled definition to fail loudly rather than reproduce
 * silently. The default, `'report'`, returns the project with the diagnostic.
 */
export function createProjectFromDefinition(definition, { driftPolicy = 'report' } = {}) {
  if (!['report', 'error'].includes(driftPolicy)) {
    throw new TypeError(`Unknown driftPolicy "${driftPolicy}".`);
  }
  validateDefinition(definition);
  const current = packkitVersion();
  const base = createProject({ preset: definition.preset, config: definition.config });

  const drift = [];
  if (definition.packkitVersion && definition.packkitVersion !== current) {
    drift.push({
      severity: 'warning',
      code: 'PACKKIT_VERSION_DRIFT',
      field: 'packkitVersion',
      message: `Definition was created with Packkit ${definition.packkitVersion}; this is ${current}. Output may differ.`,
      source: 'definition',
      previousValue: definition.packkitVersion,
      resolvedValue: current,
    });
  }

  const ext = definition.extensions || {};
  const extFiles = ext.files || {};
  const plainFiles = {};
  const storedModes = {};
  for (const [path, entry] of Object.entries(extFiles)) {
    const { content, mode } = normalizeDefinitionFile(entry);
    plainFiles[path] = content;
    storedModes[validateRelativePath(path).normalized] = mode;
    // A file the host originally *added* now collides with something this
    // Packkit version generates: surface it loudly instead of silently taking
    // the stored copy. The definition still reproduces (the host file wins, as
    // it did originally), but the drift is now visible for reconciliation.
    if (mode === 'add' && base.files[path] !== undefined) {
      drift.push({
        severity: 'error',
        code: 'EXTENSION_ADD_COLLIDES_WITH_NEW_BASE',
        field: path,
        message: `"${path}" was originally added by the host, but Packkit ${current} now generates it too. The stored copy was used; review the difference.`,
        source: 'definition',
      });
    }
  }

  // With driftPolicy: 'error', an unreconciled add-collision fails the rebuild
  // rather than reproducing silently. Version drift alone (a warning) never
  // throws — only the error-severity collision does.
  const fatalDrift = drift.filter((d) => d.severity === 'error');
  if (driftPolicy === 'error' && fatalDrift.length) {
    throw new PackkitValidationError('The definition no longer reconciles with this Packkit version; see error.diagnostics.', fatalDrift);
  }

  const hasExt = Object.keys(plainFiles).length || Object.keys(ext.packageJson || {}).length;
  // Carry the stored modes so re-exporting the replayed project preserves the
  // original add/replace intent rather than re-deriving it against this base.
  const result = hasExt
    ? extendProject(base, { files: plainFiles, packageJson: ext.packageJson || {}, collisionPolicy: 'overwrite' }, { fileModes: storedModes })
    : base;
  result.diagnostics.push(...drift);
  return result;
}

/**
 * High-level upgrade orchestration for a host application. Takes a stored
 * definition and the current repository files, regenerates with this Packkit
 * version, and returns a classified plan plus a write patch — entirely in
 * memory. Writes nothing, runs no git/commands, makes no network calls. The
 * host decides whether to write the patch, commit it, or open a pull request.
 *
 * @param {object} input
 * @param {object} input.definition  a PackkitProjectDefinition (from exportProjectDefinition)
 * @param {Record<string,string>} input.currentFiles  the repo's current file contents
 * @param {object} [input.currentPackageJson]  the current package.json, if not in currentFiles
 * @param {object} [input.policy]  UpgradeApplyPolicy (default: non-destructive add-only)
 */
export function upgradeProject(input = {}) {
  const { definition, currentFiles, currentPackageJson, policy } = input;
  // currentFiles must be a plain { path: string } map — not an array, and not
  // carrying non-string values or unsafe paths. It's never written, so no
  // containment check is needed, but malformed input should fail predictably.
  if (!currentFiles || typeof currentFiles !== 'object' || Array.isArray(currentFiles)) {
    throw new TypeError('upgradeProject needs currentFiles: a plain { path: contents } map of the repository.');
  }
  for (const [path, contents] of Object.entries(currentFiles)) {
    if (typeof contents !== 'string' && contents !== undefined) {
      throw new TypeError(`currentFiles["${path}"] must be a string (or undefined); got ${typeof contents}.`);
    }
    if (!validateRelativePath(path).ok) {
      throw new TypeError(`currentFiles has an unsafe path: ${JSON.stringify(path)}.`);
    }
  }

  // Recreate with the current Packkit version (validates the definition and
  // preserves extension add/replace semantics).
  const generatedProject = createProjectFromDefinition(definition);

  // Compare only the paths Packkit generates against what the repo has there.
  const onDisk = {};
  for (const path of Object.keys(generatedProject.files)) onDisk[path] = currentFiles[path];
  if (onDisk['package.json'] === undefined && currentPackageJson && typeof currentPackageJson === 'object') {
    onDisk['package.json'] = JSON.stringify(currentPackageJson);
  }

  const plan = planUpgrade({ generated: generatedProject.files, onDisk });
  const patch = buildUpgradeWrite({ generated: generatedProject.files, onDisk, plan, policy });
  const summary = summarizeUpgrade(plan);

  return {
    generatedProject,
    plan,
    patch,
    // The plan is the single source of upgrade diagnostics (baseline
    // availability, malformed package.json) — the CLI reads the same list.
    diagnostics: plan.diagnostics,
    metadata: {
      fromPackkitVersion: definition?.packkitVersion,
      toPackkitVersion: generatedProject.metadata.generatorVersion,
      baselineAvailable: plan.baselineAvailable,
      hasConflicts: summary.conflicts > 0,
      hasSafeChanges: summary.safeChanges > 0,
    },
  };
}

/**
 * A stable digest of the project's config and file contents. Two projects with
 * the same Packkit version, config, and extensions produce the same digest;
 * nondeterministic metadata (timestamps) is deliberately excluded.
 */
export function calculateProjectDigest(project) {
  assertProject(project);
  // The canonical digest is a platform concept — delegate to @packkit/core so the
  // same project yields the same identity across the CLI, embedded, MCP, web, and
  // a replayed definition (and matches other generators' digests byte-for-byte).
  return calculateGeneratedProjectDigest(project);
}

// ---- internals -------------------------------------------------------------

function finish(project, state) {
  extensionState.set(project, state);
  return project;
}

function assertProject(project) {
  if (!project || typeof project !== 'object' || !project.files || !project.config) {
    throw new TypeError('Expected a GeneratedProject from createProject().');
  }
}

function serializableConfig(config) {
  const out = {};
  for (const key of Object.keys(OPTIONS)) {
    if (config[key] !== undefined) out[key] = config[key];
  }
  if (config.preset) out.preset = config.preset;
  return sortObject(out);
}

function sortObject(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

function validateInput(config) {
  const errors = [];
  if (config.name != null && (typeof config.name !== 'string' || config.name.trim() === '')) {
    errors.push({ severity: 'error', code: 'INVALID_NAME', field: 'name', message: 'name must be a non-empty string.', source: 'validate' });
  }
  for (const [key, value] of Object.entries(config)) {
    const opt = OPTIONS[key];
    if (!opt) continue;
    if (opt.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(valueError(key, value, 'must be true or false'));
    } else if (opt.choices) {
      const allowed = opt.choices.map((c) => c.value);
      const values = opt.type === 'multiselect' ? (Array.isArray(value) ? value : [value]) : [value];
      for (const v of values) {
        if (!allowed.includes(v)) errors.push(valueError(key, v, `must be one of: ${allowed.join(', ')}`));
      }
    }
  }
  return errors;
}

function valueError(field, value, detail) {
  return { severity: 'error', code: 'VALUE_NOT_ALLOWED', field, previousValue: value, message: `${field} ${detail}.`, source: 'validate' };
}

function unknownOptionDiagnostics(config) {
  const out = [];
  for (const key of Object.keys(config)) {
    if (OPTIONS[key] || KNOWN_EXTRA_KEYS.has(key)) continue;
    out.push({ severity: 'warning', code: 'UNKNOWN_OPTION', field: key, message: `"${key}" is not a Packkit option and was ignored.`, source: 'validate' });
  }
  return out;
}

// Report host package overrides that change an existing generated value, so the
// host still wins but the change is visible (it can invalidate the deployment
// contract — e.g. redefining scripts.build).
function extensionPackageDiagnostics(current, override) {
  const out = [];
  for (const [topKey, value] of Object.entries(override)) {
    if (DEP_MAPS.has(topKey) && current[topKey]) {
      for (const [dep, version] of Object.entries(value || {})) {
        const prev = current[topKey][dep];
        if (prev !== undefined && prev !== version) {
          out.push({ severity: 'warning', code: 'EXTENSION_DEPENDENCY_VERSION_OVERRIDE', field: `${topKey}.${dep}`, message: `The extension changed ${topKey}.${dep} from ${prev} to ${version}.`, source: 'extend', previousValue: prev, resolvedValue: version });
        }
      }
    } else if (PROTECTED_PKG_FIELDS.has(topKey) && current[topKey] !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value) && typeof current[topKey] === 'object') {
        for (const [k, v] of Object.entries(value)) {
          const prev = current[topKey][k];
          if (prev !== undefined && JSON.stringify(prev) !== JSON.stringify(v)) {
            out.push({ severity: 'warning', code: 'EXTENSION_PACKAGE_FIELD_OVERRIDE', field: `${topKey}.${k}`, message: `The extension changed ${topKey}.${k}.`, source: 'extend', previousValue: prev, resolvedValue: v });
          }
        }
      } else if (JSON.stringify(current[topKey]) !== JSON.stringify(value)) {
        out.push({ severity: 'warning', code: 'EXTENSION_PACKAGE_FIELD_OVERRIDE', field: topKey, message: `The extension changed ${topKey}.`, source: 'extend', previousValue: current[topKey], resolvedValue: value });
      }
    }
  }
  return out;
}

function normalizeDefinitionFile(entry) {
  // v2 stores { content, mode }; tolerate a bare string (mode unknown → treat as
  // a deliberate replace so it never falsely reports an add-collision).
  if (typeof entry === 'string') return { content: entry, mode: 'replace' };
  return { content: entry.content, mode: entry.mode === 'add' ? 'add' : 'replace' };
}

// Definitions can arrive from untrusted stores, so validate structure, guard
// against prototype-pollution keys, cap resource use, and re-check every path
// before any of it can reach generation or disk.
function validateDefinition(definition) {
  const errs = [];
  const fail = (code, message, field) => errs.push({ severity: 'error', code, message, field, source: 'definition' });

  if (!isPlainObject(definition)) throw new PackkitValidationError('A definition object is required.', [{ severity: 'error', code: 'INVALID_DEFINITION', message: 'Definition must be a plain object.', source: 'definition' }]);
  if (definition.schemaVersion !== SCHEMA_VERSION) fail('SCHEMA_VERSION_MISMATCH', `Definition schemaVersion ${definition.schemaVersion} is not supported (expected ${SCHEMA_VERSION}).`, 'schemaVersion');
  if (definition.config !== undefined && !isPlainObject(definition.config)) fail('INVALID_DEFINITION', 'config must be a plain object.', 'config');
  if (definition.config) assertNoUnsafeKeys(definition.config, 'config', fail);

  const ext = definition.extensions;
  if (ext !== undefined) {
    if (!isPlainObject(ext)) fail('INVALID_DEFINITION', 'extensions must be a plain object.', 'extensions');
    else {
      const files = ext.files || {};
      if (!isPlainObject(files)) fail('INVALID_DEFINITION', 'extensions.files must be an object.', 'extensions.files');
      else {
        const paths = Object.keys(files);
        if (paths.length > MAX_DEFINITION_FILES) fail('DEFINITION_TOO_LARGE', `Definition has ${paths.length} files (max ${MAX_DEFINITION_FILES}).`, 'extensions.files');
        let total = 0;
        for (const [p, entry] of Object.entries(files)) {
          const content = typeof entry === 'string' ? entry : entry && entry.content;
          if (typeof content !== 'string') fail('INVALID_FILE_CONTENT', `extensions.files["${p}"] must have string content.`, p);
          else total += Buffer.byteLength(content, 'utf8'); // count UTF-8 bytes, matching the "bytes" limit
        }
        if (total > MAX_DEFINITION_BYTES) fail('DEFINITION_TOO_LARGE', `Definition content is ${total} bytes (max ${MAX_DEFINITION_BYTES}).`, 'extensions.files');
        for (const d of validatePathMap(Object.fromEntries(paths.map((p) => [p, '']))).diagnostics) errs.push({ ...d, source: 'definition' });
      }
      if (ext.packageJson !== undefined && !isPlainObject(ext.packageJson)) fail('INVALID_DEFINITION', 'extensions.packageJson must be an object.', 'extensions.packageJson');
      if (isPlainObject(ext.packageJson)) assertNoUnsafeKeys(ext.packageJson, 'extensions.packageJson', fail);
    }
  }

  if (errs.length) throw new PackkitValidationError('The project definition is not valid; see error.diagnostics.', errs);
}

function assertNoUnsafeKeys(obj, path, fail) {
  for (const key of Object.keys(obj)) {
    if (UNSAFE_KEYS.has(key)) fail('UNSAFE_KEY', `"${path}.${key}" is not an allowed key.`, `${path}.${key}`);
    else if (isPlainObject(obj[key])) assertNoUnsafeKeys(obj[key], `${path}.${key}`, fail);
  }
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}
