// The package.json ManifestDiffer conforms to the @packkit/core seam and reuses
// the real upgrade three-way, so it agrees with `packkit upgrade`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packageJsonDiffer as d } from '../src/embedded/manifest-differ.js';

test('owns package.json and round-trips parse/serialize', () => {
  assert.equal(d.filename, 'package.json');
  const pkg = d.parse('{"name":"x","scripts":{"build":"tsup"}}');
  assert.equal(pkg.name, 'x');
  assert.match(d.serialize(pkg), /"name": "x"/);
  assert.ok(d.serialize(pkg).endsWith('\n'));
});

test('snapshot captures scripts, dependency sections, and protected fields', () => {
  const snap = d.snapshot({
    scripts: { build: 'tsup', test: 'vitest' },
    dependencies: { hono: '^4' },
    devDependencies: { tsup: '^8' },
    exports: { '.': './dist/index.js' },
    private: true, // not a protected field → excluded
  });
  assert.deepEqual(snap.scripts, { build: 'tsup', test: 'vitest' });
  assert.deepEqual(snap.dependencies.dependencies, { hono: '^4' });
  assert.deepEqual(snap.dependencies.devDependencies, { tsup: '^8' });
  assert.deepEqual(snap.protectedFields.exports, { '.': './dist/index.js' });
  assert.equal('private' in snap.protectedFields, false);
});

test('diff classifies added vs changed scripts/deps (three-way)', () => {
  const current = { scripts: { build: 'custom' }, dependencies: { hono: '^4.5.0' } };
  const generated = { scripts: { build: 'tsup', test: 'vitest' }, dependencies: { hono: '^4.5.0' } };
  const baseline = d.snapshot({ scripts: { build: 'tsup' }, dependencies: { hono: '^4.5.0' } });

  const diff = d.diff({ baseline, current, generated });
  assert.equal(diff.addedScripts.test, 'vitest'); // new script → added
  // build differs from generated; user edited it away from the baseline → user-only-change
  assert.equal(diff.changedScripts.build.status, 'user-only-change');
  assert.equal(diff.changedScripts.build.safeToApply, false);
});
