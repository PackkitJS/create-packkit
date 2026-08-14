import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createProject,
  extendProject,
  exportProjectDefinition,
  createProjectFromDefinition,
  calculateProjectDigest,
  PackkitValidationError,
  SCHEMA_VERSION,
} from '../src/embedded/index.js';
import { writeGeneratedProject, PackkitWriteError } from '../src/embedded/writer.js';
import { validateRelativePath } from '../src/embedded/paths.js';

const tmp = () => mkdtemp(join(tmpdir(), 'pk-embed-'));

// ---- createProject ---------------------------------------------------------

test('createProject: generates in memory with no side effects', () => {
  const p = createProject({ preset: 'react-app', name: 'app' });
  assert.ok(p.files['package.json']);
  assert.equal(p.summary.fileCount, Object.keys(p.files).length);
  assert.equal(p.metadata.preset, 'react-app');
  assert.equal(p.metadata.schemaVersion, SCHEMA_VERSION);
  // Protocol-native metadata (4.0): generatorId/generatorVersion/protocolVersion.
  assert.equal(p.metadata.generatorId, 'javascript');
  assert.ok(p.metadata.generatorVersion);
  assert.equal(p.metadata.protocolVersion, 1);
  // deterministic: no timestamp baked in unless asked
  assert.equal(p.metadata.generatedAt, undefined);
});

test('createProject: overrides apply after the preset', () => {
  const p = createProject({ preset: 'ts-lib', name: 'x', overrides: { packageManager: 'pnpm' } });
  assert.equal(p.config.packageManager, 'pnpm');
});

test('createProject: reports normalization changes instead of applying them silently', () => {
  const p = createProject({ preset: 'node-service', name: 'svc', overrides: { storybook: true } });
  const d = p.diagnostics.find((x) => x.code === 'STORYBOOK_REQUIRES_COMPONENT_LIBRARY');
  assert.ok(d, 'storybook coercion reported');
  assert.equal(d.previousValue, true);
  assert.equal(d.resolvedValue, false);
  assert.equal(d.severity, 'warning');
});

test('createProject: unknown options are a warning, not fatal', () => {
  const p = createProject({ name: 'x', config: { madeUpOption: 1 } });
  assert.ok(p.diagnostics.some((d) => d.code === 'UNKNOWN_OPTION' && d.field === 'madeUpOption'));
});

test('createProject: an out-of-range value is fatal', () => {
  assert.throws(
    () => createProject({ name: 'x', config: { language: 'cobol' } }),
    (e) => e instanceof PackkitValidationError && e.diagnostics[0].code === 'VALUE_NOT_ALLOWED',
  );
});

test('createProject: an unknown preset is fatal', () => {
  assert.throws(
    () => createProject({ preset: 'does-not-exist', name: 'x' }),
    (e) => e instanceof PackkitValidationError && e.diagnostics[0].code === 'UNKNOWN_PRESET',
  );
});

// ---- extendProject ---------------------------------------------------------

test('extendProject: adds files and never mutates the original', () => {
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  const beforeCount = Object.keys(base.files).length;
  const ext = extendProject(base, { files: { '.github/workflows/deploy.yml': 'name: deploy\n' } });
  assert.equal(Object.keys(base.files).length, beforeCount, 'base unchanged');
  assert.equal(ext.files['.github/workflows/deploy.yml'], 'name: deploy\n');
  assert.equal(ext.summary.fileCount, beforeCount + 1);
});

test('extendProject: default collision policy is error', () => {
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  assert.throws(
    () => extendProject(base, { files: { 'package.json': '{}' } }),
    (e) => e instanceof PackkitValidationError && e.diagnostics[0].code === 'EXTENSION_FILE_COLLISION',
  );
});

test('extendProject: skip keeps the generated file; overwrite replaces it', () => {
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  const original = base.files['package.json'];
  const skipped = extendProject(base, { files: { 'package.json': 'REPLACED' }, collisionPolicy: 'skip' });
  assert.equal(skipped.files['package.json'], original);
  const overwritten = extendProject(base, { files: { 'package.json': 'REPLACED' }, collisionPolicy: 'overwrite' });
  assert.equal(overwritten.files['package.json'], 'REPLACED');
});

test('extendProject: rejects a traversal path in an extension', () => {
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  assert.throws(
    () => extendProject(base, { files: { '../escape.txt': 'x' } }),
    (e) => e instanceof PackkitValidationError && e.diagnostics[0].code === 'PATH_ESCAPE',
  );
});

test('extendProject: package.json overrides deep-merge, host wins', () => {
  const base = createProject({ preset: 'node-service', name: 'svc' });
  const ext = extendProject(base, { packageJson: { scripts: { deploy: 'do-it' } } });
  const pkg = JSON.parse(ext.files['package.json']);
  assert.equal(pkg.scripts.deploy, 'do-it');
  assert.ok(pkg.scripts.start, 'existing scripts preserved');
});

// ---- path validation -------------------------------------------------------

test('validateRelativePath: rejects the classic escapes', () => {
  for (const bad of ['../outside.txt', '/etc/passwd', 'C:\\outside.txt', 'src/../../outside.txt', '', 'a\0b']) {
    assert.equal(validateRelativePath(bad).ok, false, `should reject ${JSON.stringify(bad)}`);
  }
});

test('validateRelativePath: accepts normal nested paths', () => {
  const r = validateRelativePath('src/a/b/c.ts');
  assert.equal(r.ok, true);
  assert.equal(r.normalized, 'src/a/b/c.ts');
});

// ---- definition + digest ---------------------------------------------------

test('exportProjectDefinition + createProjectFromDefinition reproduce the same digest', () => {
  const project = createProject({ preset: 'react-app', name: 'example-app' });
  const extended = extendProject(project, { files: { '.github/workflows/deploy.yml': 'name: deploy\n' } });
  const definition = exportProjectDefinition(extended);
  assert.equal(definition.schemaVersion, SCHEMA_VERSION);
  const recreated = createProjectFromDefinition(definition);
  assert.equal(calculateProjectDigest(extended), calculateProjectDigest(recreated));
});

test('definition carries no absolute paths or secrets, only config + extensions', () => {
  const p = extendProject(createProject({ preset: 'ts-lib', name: 'lib' }), { files: { 'x.txt': 'hi' } });
  const def = exportProjectDefinition(p);
  const json = JSON.stringify(def);
  assert.doesNotMatch(json, /\/(Users|home|tmp|var)\//, 'no machine paths');
  assert.deepEqual(def.extensions.files['x.txt'], { content: 'hi', mode: 'add' });
});

test('a definition from an incompatible schema version is rejected', () => {
  assert.throws(
    () => createProjectFromDefinition({ schemaVersion: 999, packkitVersion: '9.9.9', config: {} }),
    (e) => e instanceof PackkitValidationError && e.diagnostics[0].code === 'SCHEMA_VERSION_MISMATCH',
  );
});

test('calculateProjectDigest is stable across repeated generation', () => {
  const a = createProject({ preset: 'node-service', name: 'svc' });
  const b = createProject({ preset: 'node-service', name: 'svc' });
  assert.equal(calculateProjectDigest(a), calculateProjectDigest(b));
});

// ---- deployment contract ---------------------------------------------------

test('deriveDeploymentContract: shape per target, provider-neutral', () => {
  const svc = createProject({ preset: 'node-service', name: 'svc' }).deploymentContract;
  assert.equal(svc.type, 'service'); // language-neutral contract (core 0.4.0), runtime names the language
  assert.equal(svc.runtime, 'node');
  assert.equal(svc.defaultPort, 3000);
  assert.equal(svc.portEnvironmentVariable, 'PORT');
  assert.equal(svc.healthCheckPath, '/health');
  assert.equal(svc.containerFile, 'Dockerfile');
  assert.deepEqual(svc.requiredEnvironmentVariables, []);
  assert.deepEqual(svc.optionalEnvironmentVariables, ['PORT']);
  assert.equal(svc.port, undefined, 'ambiguous `port` replaced by defaultPort');

  const app = createProject({ preset: 'react-app', name: 'app' }).deploymentContract;
  assert.deepEqual(app, { type: 'static', buildCommand: 'npm run build', outputDirectory: 'dist' });

  const lib = createProject({ preset: 'ts-lib', name: 'lib' }).deploymentContract;
  assert.equal(lib.type, 'library');

  // Full-stack is a composite of a static front end + a node service.
  const fs = createProject({ preset: 'fullstack', name: 'fs' }).deploymentContract;
  assert.equal(fs.type, 'fullstack');
  assert.deepEqual(fs.frontend, { type: 'static', buildCommand: 'pnpm build', outputDirectory: 'apps/web/dist' });
  assert.equal(fs.backend.type, 'service');
  assert.equal(fs.backend.healthCheckPath, '/api/health');
  assert.equal(fs.backend.defaultPort, 3000);
  assert.equal(fs.backend.containerFile, undefined, 'the fullstack server has no Dockerfile');

  // No provider-specific fields leak in.
  const json = JSON.stringify([svc, app, lib, fs]);
  assert.doesNotMatch(json, /vercel|netlify|aws|cloudflare|github/i);
});

// ---- writer (filesystem) ---------------------------------------------------

test('writeGeneratedProject: writes to an empty dir, nested paths included', async () => {
  const dir = await tmp();
  const p = createProject({ preset: 'ts-lib', name: 'lib' });
  const res = await writeGeneratedProject({ project: p, destination: dir });
  assert.equal(res.writtenFiles.length, Object.keys(p.files).length);
  assert.ok((await stat(join(dir, 'package.json'))).isFile());
  assert.equal(await readFile(join(dir, 'package.json'), 'utf8'), p.files['package.json']);
});

test('writeGeneratedProject: refuses a traversal path at the boundary, writes nothing', async () => {
  const dir = await tmp();
  await assert.rejects(
    () => writeGeneratedProject({ project: { config: {}, files: { '../evil.txt': 'x', 'ok.txt': 'y' } }, destination: dir }),
    (e) => e instanceof PackkitWriteError && e.code === 'PATH_ESCAPE',
  );
  await assert.rejects(() => stat(join(dir, 'ok.txt')), 'nothing was written');
});

test('writeGeneratedProject: collision policies', async () => {
  const dir = await tmp();
  await writeFile(join(dir, 'keep.txt'), 'original');
  const project = { config: {}, files: { 'keep.txt': 'new', 'fresh.txt': 'new' } };

  await assert.rejects(
    () => writeGeneratedProject({ project, destination: dir, collisionPolicy: 'error' }),
    (e) => e instanceof PackkitWriteError && e.code === 'FILE_EXISTS',
  );

  const skip = await writeGeneratedProject({ project, destination: dir, collisionPolicy: 'skip' });
  assert.deepEqual(skip.skippedFiles, ['keep.txt']);
  assert.equal(await readFile(join(dir, 'keep.txt'), 'utf8'), 'original');
});

test('writeGeneratedProject: filenames with spaces and Unicode', async () => {
  const dir = await tmp();
  const project = { config: {}, files: { 'a folder/rΓⁿ file 日本.txt': 'ok' } };
  const res = await writeGeneratedProject({ project, destination: dir });
  assert.equal(res.writtenFiles.length, 1);
  assert.equal(await readFile(join(dir, 'a folder/rΓⁿ file 日本.txt'), 'utf8'), 'ok');
});

test('writeGeneratedProject: does not install, init git, or run commands', async () => {
  const dir = await tmp();
  const p = createProject({ preset: 'node-service', name: 'svc' });
  await writeGeneratedProject({ project: p, destination: dir });
  await assert.rejects(() => stat(join(dir, 'node_modules')), 'no install');
  await assert.rejects(() => stat(join(dir, '.git')), 'no git init');
});

// ---- review fixes: security & correctness ----------------------------------

test('writer: refuses to write through a symlinked directory component', async () => {
  const { symlink, mkdir: mkdirp } = await import('node:fs/promises');
  const dir = await tmp();
  const outside = await tmp();
  await mkdirp(join(outside, 'real'));
  await symlink(join(outside, 'real'), join(dir, 'link'));
  await assert.rejects(
    () => writeGeneratedProject({ project: { config: {}, files: { 'link/escaped.txt': 'x' } }, destination: dir }),
    (e) => e instanceof PackkitWriteError && e.code === 'SYMLINK_PATH',
  );
});

test('writer: rejects a symlinked destination itself', async () => {
  const { symlink } = await import('node:fs/promises');
  const dir = await tmp();
  const outside = await tmp();
  const linkDest = join(dir, 'dest');
  await symlink(outside, linkDest);
  await assert.rejects(
    () => writeGeneratedProject({ project: { config: {}, files: { 'a.txt': 'x' } }, destination: linkDest }),
    (e) => e instanceof PackkitWriteError && e.code === 'SYMLINK_PATH',
  );
});

test('writer: error policy preflights all collisions, writes nothing', async () => {
  const dir = await tmp();
  await writeFile(join(dir, 'a.txt'), 'existing');
  const project = { config: {}, files: { 'a.txt': 'new', 'b.txt': 'new' } };
  await assert.rejects(
    () => writeGeneratedProject({ project, destination: dir, collisionPolicy: 'error' }),
    (e) => e instanceof PackkitWriteError && e.code === 'FILE_EXISTS' && e.message.includes('a.txt'),
  );
  // b.txt must NOT have been written — the collision aborts before any write.
  await assert.rejects(() => stat(join(dir, 'b.txt')));
});

test('writer errors carry structured properties', async () => {
  const dir = await tmp();
  const err = await writeGeneratedProject({ project: { config: {}, files: { '../x': 'y' } }, destination: dir }).catch((e) => e);
  assert.equal(err.code, 'PATH_ESCAPE');
  assert.equal(err.path, '../x');
  assert.equal(err.destination, (await import('node:path')).resolve(dir));
});

test('definition replay flags an add that a newer base now generates', () => {
  // Simulate: the host added a file that (pretend) Packkit now generates too.
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  const generatedPath = Object.keys(base.files)[0]; // any real generated path
  const definition = {
    schemaVersion: SCHEMA_VERSION,
    packkitVersion: '0.0.1',
    preset: 'ts-lib',
    config: { name: 'lib', preset: 'ts-lib' },
    extensions: { files: { [generatedPath]: { content: 'host-owned', mode: 'add' } }, packageJson: {} },
  };
  const result = createProjectFromDefinition(definition);
  const drift = result.diagnostics.find((d) => d.code === 'EXTENSION_ADD_COLLIDES_WITH_NEW_BASE');
  assert.ok(drift, 'collision surfaced');
  assert.equal(drift.severity, 'error');
  assert.equal(result.files[generatedPath], 'host-owned', 'stored copy still reproduced');
});

test('extendProject: host package overrides are reported', () => {
  const base = createProject({ preset: 'node-service', name: 'svc' });
  const ext = extendProject(base, { packageJson: { scripts: { start: 'my-custom-start' } } });
  const d = ext.diagnostics.find((x) => x.code === 'EXTENSION_PACKAGE_FIELD_OVERRIDE' && x.field === 'scripts.start');
  assert.ok(d, 'override reported');
  assert.equal(d.resolvedValue, 'my-custom-start');
});

test('extendProject: non-string file content is rejected', () => {
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  assert.throws(
    () => extendProject(base, { files: { 'x.txt': { not: 'a string' } } }),
    (e) => e instanceof PackkitValidationError && e.diagnostics[0].code === 'INVALID_FILE_CONTENT',
  );
});

test('dependency conflicts are keyed per section, not across them', async () => {
  const { analyzePkgFragments } = await import('../src/embedded/pkg-merge.js');
  // Different sections with different version ranges is NOT a conflict.
  const cross = analyzePkgFragments([
    { source: 'a', pkg: { dependencies: { react: '^19' } } },
    { source: 'b', pkg: { peerDependencies: { react: '>=18' } } },
  ]).diagnostics;
  assert.equal(cross.filter((d) => d.code === 'DEPENDENCY_VERSION_CONFLICT').length, 0);
  // Two disagreeing versions in the SAME section IS a conflict.
  const same = analyzePkgFragments([
    { source: 'a', pkg: { dependencies: { react: '^18' } } },
    { source: 'b', pkg: { dependencies: { react: '^19' } } },
  ]).diagnostics;
  assert.equal(same.filter((d) => d.code === 'DEPENDENCY_VERSION_CONFLICT').length, 1);
});

test('deepMerge cannot pollute the prototype via host extension keys', () => {
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  // __proto__ as an own key (JSON.parse) must not leak onto Object.prototype.
  extendProject(base, { packageJson: JSON.parse('{"__proto__":{"polluted":true},"scripts":{"x":"1"}}') });
  assert.equal({}.polluted, undefined, 'Object.prototype untouched');
});

test('createProjectFromDefinition: rejects unsafe keys and oversized definitions', () => {
  assert.throws(
    () => createProjectFromDefinition({ schemaVersion: SCHEMA_VERSION, packkitVersion: '1.0.0', config: JSON.parse('{"__proto__":{"x":1}}') }),
    (e) => e instanceof PackkitValidationError && e.diagnostics.some((d) => d.code === 'UNSAFE_KEY'),
  );
  const many = Object.fromEntries(Array.from({ length: 5001 }, (_, i) => [`f${i}.txt`, { content: '', mode: 'add' }]));
  assert.throws(
    () => createProjectFromDefinition({ schemaVersion: SCHEMA_VERSION, packkitVersion: '1.0.0', config: {}, extensions: { files: many } }),
    (e) => e instanceof PackkitValidationError && e.diagnostics.some((d) => d.code === 'DEFINITION_TOO_LARGE'),
  );
});

test('deployment contract makes PORT explicitly optional (it has a default)', () => {
  const svc = createProject({ preset: 'node-service', name: 'svc', overrides: { env: true } }).deploymentContract;
  assert.deepEqual(svc.requiredEnvironmentVariables, [], 'nothing is required');
  assert.deepEqual(svc.optionalEnvironmentVariables, ['PORT'], 'PORT is optional, overriding the default');
  assert.equal(svc.defaultPort, 3000);
});

test('the public project has no leaked internal extension state', () => {
  const p = createProject({ preset: 'ts-lib', name: 'lib' });
  assert.equal(p._extensions, undefined, 'no _extensions on the object');
  assert.deepEqual(Object.keys(p).sort(), ['config', 'deploymentContract', 'diagnostics', 'files', 'metadata', 'summary']);
});

test('definition replay preserves the original add/replace mode across a round-trip', () => {
  // add: a host file Packkit does NOT generate must stay "add" after replay,
  // so a future version that starts generating it can still flag the drift.
  const added = extendProject(createProject({ preset: 'ts-lib', name: 'lib' }), {
    files: { 'custom-file.txt': 'host content' },
  });
  const replayedAdd = createProjectFromDefinition(exportProjectDefinition(added));
  assert.equal(exportProjectDefinition(replayedAdd).extensions.files['custom-file.txt'].mode, 'add');

  // replace: a deliberate override of a generated file must stay "replace".
  const replaced = extendProject(createProject({ preset: 'ts-lib', name: 'lib' }), {
    files: { 'package.json': 'REPLACED' },
    collisionPolicy: 'overwrite',
  });
  const replayedReplace = createProjectFromDefinition(exportProjectDefinition(replaced));
  assert.equal(exportProjectDefinition(replayedReplace).extensions.files['package.json'].mode, 'replace');
});

// ---- two-phase resolution (the CLI runs on this) ---------------------------

test('resolveProjectConfig + createProjectFromResolvedConfig equals createProject', async () => {
  const { resolveProjectConfig, createProjectFromResolvedConfig } = await import('../src/embedded/index.js');
  // Two-phase (what the CLI does) must match the one-shot createProject.
  const { config, diagnostics } = resolveProjectConfig({ preset: 'node-service', name: 'svc', overrides: { storybook: true } });
  assert.ok(config.name === 'svc');
  assert.ok(diagnostics.some((d) => d.code === 'STORYBOOK_REQUIRES_COMPONENT_LIBRARY'), 'coercion captured at resolve time');

  const two = createProjectFromResolvedConfig(config, { diagnostics });
  const one = createProject({ preset: 'node-service', name: 'svc', overrides: { storybook: true } });
  assert.equal(calculateProjectDigest(two), calculateProjectDigest(one));
  // The resolution diagnostics carried through to the project.
  assert.ok(two.diagnostics.some((d) => d.code === 'STORYBOOK_REQUIRES_COMPONENT_LIBRARY'));
});

test('createProjectFromResolvedConfig honors a field set after resolution (repo)', async () => {
  const { resolveProjectConfig, createProjectFromResolvedConfig } = await import('../src/embedded/index.js');
  const { config, diagnostics } = resolveProjectConfig({ preset: 'ts-lib', name: 'lib' });
  config.repo = 'https://github.com/acme/lib'; // the CLI does this after resolving the remote
  const project = createProjectFromResolvedConfig(config, { diagnostics });
  assert.match(project.files['package.json'], /acme\/lib/);
});

test('driftPolicy: error throws on an add-collision; report returns it as a diagnostic', () => {
  const base = createProject({ preset: 'ts-lib', name: 'lib' });
  const generatedPath = Object.keys(base.files)[0];
  const definition = {
    schemaVersion: SCHEMA_VERSION,
    packkitVersion: '0.0.1',
    preset: 'ts-lib',
    config: { name: 'lib', preset: 'ts-lib' },
    extensions: { files: { [generatedPath]: { content: 'host-owned', mode: 'add' } }, packageJson: {} },
  };
  // default 'report' returns the project with an error diagnostic (no throw)
  const reported = createProjectFromDefinition(definition);
  assert.ok(reported.diagnostics.some((d) => d.code === 'EXTENSION_ADD_COLLIDES_WITH_NEW_BASE'));
  // 'error' throws instead
  assert.throws(
    () => createProjectFromDefinition(definition, { driftPolicy: 'error' }),
    (e) => e instanceof PackkitValidationError && e.diagnostics[0].code === 'EXTENSION_ADD_COLLIDES_WITH_NEW_BASE',
  );
});

test('driftPolicy: error does NOT throw on a clean replay (version drift alone is fine)', () => {
  const ext = extendProject(createProject({ preset: 'ts-lib', name: 'lib' }), { files: { 'novel.txt': 'x' } });
  const def = { ...exportProjectDefinition(ext), packkitVersion: '0.0.1' }; // force a version-drift warning
  const rec = createProjectFromDefinition(def, { driftPolicy: 'error' });
  assert.ok(rec.diagnostics.some((d) => d.code === 'PACKKIT_VERSION_DRIFT'));
  assert.ok(rec.files['novel.txt'] === 'x');
});
