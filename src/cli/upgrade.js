// `packkit upgrade` — regenerate a scaffolded project's current recommended
// output and report (or apply) what has drifted from Packkit's templates.
//
// It reads packkit.json to learn the preset + settings the project came from,
// regenerates in memory through the embedded API, and diffs against disk.
//
// Safety: `--apply` is non-destructive. It brings in *additions* only — new
// files, new scripts, new dependencies, new package fields — and preserves
// anything that already exists but differs (it can't tell a template change
// from your own edit). Replacing differing values is opt-in per category.

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createProject, planUpgrade, isUpgradeEmpty, buildUpgradeWrite, summarizeUpgrade } from '../embedded/index.js';
import { writeGeneratedProject } from '../embedded/writer.js';

// Bumped if the --json output shape changes incompatibly.
const JSON_SCHEMA_VERSION = 1;

const DEP_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const UPGRADE_HELP = `
packkit upgrade — pull your project up to Packkit's current templates

Usage:
  packkit upgrade [directory] [options]

Reads packkit.json in the directory (default: current), regenerates the project
Packkit would produce today, and shows what changed since you scaffolded.

Options:
  --apply            Apply the safe, additive changes (new files/scripts/deps)
  --force            With --apply, also replace everything that differs
  --replace-files    With --apply, replace files that differ
  --update-scripts   With --apply, replace scripts that differ
  --update-deps      With --apply, replace dependency versions that differ
  --json             Print the plan as JSON (machine-readable; no other output)
  -h, --help         Show this help

Without --apply this is a dry run — it only reports.
By default, anything that already exists and differs is preserved (it might be
your edit); use the flags above to replace it.
`;

export async function runUpgrade(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      apply: { type: 'boolean' },
      force: { type: 'boolean' },
      'replace-files': { type: 'boolean' },
      'update-scripts': { type: 'boolean' },
      'update-deps': { type: 'boolean' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) return void console.log(UPGRADE_HELP);

  // A fatal exit that honors --json: in JSON mode stdout gets one error
  // document (nothing on stderr); otherwise a plain message on stderr. Sets a
  // non-zero exit code without calling process.exit() (keeps the command
  // testable and embeddable).
  const fail = (code, message, extra = {}) => {
    if (values.json) console.log(JSON.stringify({ schemaVersion: JSON_SCHEMA_VERSION, ok: false, error: { code, message, ...extra }, diagnostics: [] }, null, 2));
    else console.error(message);
    process.exitCode = 1;
  };

  const dir = resolve(positionals[0] || '.');
  const provPath = join(dir, 'packkit.json');
  if (!existsSync(provPath)) {
    return fail('PACKKIT_PROVENANCE_NOT_FOUND', `No packkit.json in "${dir}". Upgrade only works on a project Packkit scaffolded.`, { path: provPath });
  }

  let provenance;
  try {
    provenance = JSON.parse(readFileSync(provPath, 'utf8'));
  } catch (err) {
    return fail('PACKKIT_PROVENANCE_INVALID', `Could not read packkit.json: ${err.message}`, { path: provPath });
  }

  // The project name isn't a "setting", so it lives in package.json, not
  // packkit.json — read it back so regeneration reproduces the same names.
  const name = readName(dir) || provenance.name || 'my-package';
  const fromVersion = provenance.version || 'unknown';

  let project;
  try {
    project = createProject({ preset: provenance.preset, name, config: provenance.settings || {} });
  } catch (err) {
    return fail('PACKKIT_REGENERATION_FAILED', `Could not regenerate from packkit.json: ${err.message}`);
  }
  const toVersion = project.metadata.generatorVersion;

  const onDisk = {};
  for (const path of Object.keys(project.files)) {
    const full = join(dir, path);
    onDisk[path] = existsSync(full) ? readFileSync(full, 'utf8') : undefined;
  }

  const plan = planUpgrade({ generated: project.files, onDisk });

  // Machine-readable mode: emit only JSON, never a human log line. A fatal
  // diagnostic (e.g. an unparseable package.json) sets a non-zero exit code.
  if (values.json) {
    const out = jsonReport(plan, fromVersion, toVersion);
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) process.exitCode = 1;
    return;
  }

  if (isUpgradeEmpty(plan)) {
    console.log(`Already current with Packkit ${toVersion}. Nothing to upgrade.`);
    return;
  }

  report(plan, fromVersion, toVersion);

  if (!values.apply) {
    console.log('\nThis was a dry run. Re-run with --apply to bring in the additive changes.');
    return;
  }

  const policy = {
    files: values.force || values['replace-files'] ? 'replace-changed' : 'add-only',
    scripts: values.force || values['update-scripts'] ? 'replace-changed' : 'add-only',
    dependencies: values.force || values['update-deps'] ? 'replace-changed' : 'add-only',
    packageFields: values.force ? 'replace-changed' : 'add-only',
  };

  const writeMap = buildUpgradeWrite({ generated: project.files, onDisk, plan, policy });
  const paths = Object.keys(writeMap);
  if (paths.length) {
    await writeGeneratedProject({
      project: { config: project.config, files: writeMap },
      destination: dir,
      collisionPolicy: 'overwrite',
    });
    console.log(`\n✓ Applied updates to ${paths.length} file${paths.length > 1 ? 's' : ''}.`);
  }

  // Report what was preserved because it differs and the policy didn't replace it.
  const preserved = [];
  if (policy.files === 'add-only' && plan.files.changed.length) preserved.push(`${plan.files.changed.length} file(s) — re-run with --replace-files to take Packkit's version`);
  if (policy.scripts === 'add-only' && Object.keys(plan.packageJson.changedScripts).length) preserved.push(`${Object.keys(plan.packageJson.changedScripts).length} script(s) — --update-scripts`);
  const changedDepCount = countDeps(plan.packageJson.changedDependencies);
  if (policy.dependencies === 'add-only' && changedDepCount) preserved.push(`${changedDepCount} dependency version(s) — --update-deps`);
  if (policy.packageFields === 'add-only' && plan.packageJson.changedFields.length) preserved.push(`${plan.packageJson.changedFields.length} package field(s) — --force`);
  if (preserved.length) {
    console.log('\nPreserved (differs from the current template — likely your own changes):\n  ' + preserved.join('\n  '));
  }
}

// A versioned, machine-readable view of the plan for portals/automation.
function jsonReport(plan, fromVersion, toVersion) {
  const files = [
    ...plan.files.added.map((path) => ({ path, status: 'new-generated-file', safeToApply: true })),
    ...plan.files.changed.map((path) => ({ path, ...plan.files.entries[path] })),
  ];
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    ok: !plan.diagnostics.some((d) => d.severity === 'error'),
    fromPackkitVersion: fromVersion,
    toPackkitVersion: toVersion,
    baselineAvailable: plan.baselineAvailable,
    summary: summarizeUpgrade(plan),
    files,
    packageJson: plan.packageJson,
    diagnostics: plan.diagnostics,
  };
}

function readName(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).name;
  } catch {
    return null;
  }
}

function countDeps(map) {
  return DEP_SECTIONS.reduce((n, s) => n + Object.keys(map[s]).length, 0);
}

function flattenDeps(map, render) {
  const out = [];
  for (const section of DEP_SECTIONS) {
    for (const [name, change] of Object.entries(map[section])) out.push(render(section, name, change));
  }
  return out;
}

function report(plan, fromVersion, toVersion) {
  console.log(`Packkit ${fromVersion} → ${toVersion}\n`);
  const p = plan.packageJson;

  // Additive — applied by --apply.
  if (plan.files.added.length) console.log(`New files (${plan.files.added.length}):\n  ` + plan.files.added.join('\n  '));
  const addedDeps = flattenDeps(p.addedDependencies, (s, n, c) => `${n}@${c.generated} (${s})`);
  if (addedDeps.length) console.log(`\nNew dependencies (${addedDeps.length}):\n  ` + addedDeps.join('\n  '));
  const addedScripts = Object.keys(p.addedScripts);
  if (addedScripts.length) console.log(`\nNew scripts (${addedScripts.length}):\n  ` + addedScripts.join('\n  '));
  if (p.addedFields.length) console.log(`\nNew package fields (${p.addedFields.length}):\n  ` + p.addedFields.map((f) => f.field).join('\n  '));

  // Differences — preserved by default, need an explicit flag to replace.
  const changedDeps = flattenDeps(p.changedDependencies, (s, n, c) => `${n}: ${c.current} → ${c.generated} (${s})`);
  const changedScripts = Object.entries(p.changedScripts);
  const diffs = [];
  if (plan.files.changed.length) diffs.push(`Files that differ (${plan.files.changed.length}):\n  ` + plan.files.changed.join('\n  '));
  if (changedDeps.length) diffs.push(`Dependency versions that differ (${changedDeps.length}):\n  ` + changedDeps.join('\n  '));
  if (changedScripts.length) diffs.push(`Scripts that differ (${changedScripts.length}):\n  ` + changedScripts.map(([n, c]) => `${n}: ${c.current} → ${c.generated}`).join('\n  '));
  if (p.changedFields.length) diffs.push(`Package fields that differ (${p.changedFields.length}):\n  ` + p.changedFields.map((f) => f.field).join('\n  '));
  if (diffs.length) {
    console.log('\n— Preserved by default (review; these may be your own changes) —\n\n' + diffs.join('\n\n'));
  }
}
