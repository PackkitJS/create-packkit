// Package root. Re-exports the pure generation core plus the Node embedded API,
// so `import { generate, createProject, writeGeneratedProject } from 'create-packkit'`
// works for host applications.
//
// The browser configurator (PackkitJS/packkit-web) does NOT import this file — it
// bundles src/core/index.js directly — so pulling the Node-only embedded modules in
// here doesn't affect browser compatibility of the core. Consumers who want the core
// in isolation can import 'create-packkit/core'.

export * from './core/index.js';
export * from './embedded/index.js';
export { writeGeneratedProject, PackkitWriteError } from './embedded/writer.js';
