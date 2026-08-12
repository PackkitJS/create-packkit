// create-packkit dogfoods @packkit/core's generator conformance suite: proof that
// it's a valid platform generator, not merely that it satisfies a TS interface.
import { test } from 'node:test';
import { runGeneratorConformanceSuite } from '@packkit/core/testing';
import { packkitGenerator } from '../src/embedded/generator.js';

runGeneratorConformanceSuite(packkitGenerator, (name, fn) => test(`conformance: ${name}`, fn));
