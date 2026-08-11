import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCliArgs, CliArgError } from '../src/cli/args.js';

test('a preset in either positional slot yields the same preset + name (#43)', () => {
  const nameFirst = parseCliArgs(['my-svc', 'node-service']);
  const presetFirst = parseCliArgs(['node-service', 'my-svc']);
  assert.equal(nameFirst.preset, 'node-service');
  assert.equal(nameFirst.name, 'my-svc');
  assert.equal(presetFirst.preset, 'node-service');
  assert.equal(presetFirst.name, 'my-svc');
});

test('aliases resolve in either slot', () => {
  assert.equal(parseCliArgs(['api', 'svc']).preset, 'svc');
  assert.equal(parseCliArgs(['api', 'svc']).name, 'api');
  assert.equal(parseCliArgs(['svc', 'api']).name, 'api');
});

test('an unrecognized extra positional is a hard error, not silently dropped (#43)', () => {
  assert.throws(() => parseCliArgs(['zzz-proj', 'not-a-real-preset']), (err) => err instanceof CliArgError);
});

test('a mistyped preset gets a suggestion', () => {
  try {
    parseCliArgs(['my-app', 'node-servic']);
    assert.fail('expected a throw');
  } catch (err) {
    assert.ok(err instanceof CliArgError);
    assert.match(err.message, /node-service/);
  }
});

test('just a name or just a preset is accepted', () => {
  assert.equal(parseCliArgs(['my-lib']).name, 'my-lib');
  assert.equal(parseCliArgs(['my-lib']).preset, undefined);
  assert.equal(parseCliArgs(['ts-lib']).preset, 'ts-lib');
  assert.equal(parseCliArgs(['ts-lib']).name, undefined);
});

test('--preset flag coexists with a name positional', () => {
  const args = parseCliArgs(['my-lib', '--preset', 'cli']);
  assert.equal(args.preset, 'cli');
  assert.equal(args.name, 'my-lib');
});
