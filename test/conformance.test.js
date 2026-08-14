// create-packkit dogfoods @packkit/core's conformance suites: proof that it's a
// valid platform generator (generation) AND that a host can drive its full
// lifecycle (digest, definition replay, host extension, baseline upgrade)
// identically to any other generator — not merely that it satisfies a TS interface.
import { test } from 'node:test';
import { runGeneratorConformanceSuite, runEmbeddedLifecycleConformance } from '@packkit/core/testing';
import { packkitGenerator } from '../src/embedded/generator.js';

runGeneratorConformanceSuite(packkitGenerator, (name, fn) => test(`conformance: ${name}`, fn));
runEmbeddedLifecycleConformance(packkitGenerator, (name, fn) => test(`lifecycle: ${name}`, fn));
