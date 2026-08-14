# Embedding Packkit

Packkit can run inside another Node.js application as a project-generation
engine. You give it a preset and some configuration, it produces a complete
project **in memory**, you layer on your own deployment files, and you write it
to disk when you're ready.

The embedded API performs **no authentication, cloud provisioning, repository
creation, dependency installation, or command execution**. It generates files
and hands them to you. What you do with them — deploy, commit, push, install —
is entirely yours.

```js
import {
  createProject,
  extendProject,
  writeGeneratedProject,
} from 'create-packkit/embedded';
```

The same names are re-exported from the package root (`create-packkit`) if you
prefer a single import.

## Generate in memory

`createProject` resolves a preset, applies your overrides, normalizes and
validates the result, and generates every file — without touching the
filesystem.

```js
const project = createProject({
  preset: 'react-app',
  name: 'weather-dashboard',
  overrides: {
    packageManager: 'npm',
    install: false,
    gitInit: false,
  },
});

project.files;            // { 'package.json': '…', 'src/main.tsx': '…', … }
project.config;           // the resolved configuration
project.summary;          // { name, fileCount, stack, workflows }
project.diagnostics;      // see below
project.metadata;         // { packkitVersion, schemaVersion, preset }
project.deploymentContract; // see "Deployment contract"
```

Precedence is **preset → config → overrides**, with `name` applied last.

## Handle diagnostics

Packkit normalizes configurations that don't quite fit — a bundle-size budget
on a project that isn't published, Storybook on something that isn't a component
library. Rather than doing that silently, it reports each change:

```js
for (const d of project.diagnostics) {
  // d.severity: 'info' | 'warning' | 'error'
  // d.code, d.message, d.field, d.previousValue, d.resolvedValue
  console.log(`[${d.severity}] ${d.code}: ${d.message}`);
}
```

Diagnostics also cover unknown options, feature-level file collisions, and
conflicting `package.json` fields. A **fatal** problem — an out-of-range value,
an unknown preset — throws a `PackkitValidationError` whose `.diagnostics`
array explains what was wrong, so generation never produces a broken project.

## Add your own files

`extendProject` returns a **new** project with your files and `package.json`
fields layered on. It never mutates the original.

```js
const extended = extendProject(project, {
  files: {
    '.github/workflows/deploy.yml': deploymentWorkflow,
    '.platform/project.json': JSON.stringify(
      { applicationId: 'weather-dashboard', deploymentType: 'static' },
      null,
      2,
    ),
  },
  packageJson: {
    scripts: { deploy: 'my-platform deploy' },
  },
});
```

Every extension path is validated (no absolute paths, no `..` escapes, no
case-insensitive duplicates). A file that collides with a generated one is an
**error by default**; pass `collisionPolicy: 'skip'` or `'overwrite'` to choose
otherwise. `package.json` fields deep-merge, with your values winning.

## Read the deployment contract

Every project carries a provider-neutral description of how to build and run it,
derived from the resolved config. It contains no AWS-, Vercel-, Netlify-,
Cloudflare-, or GitHub-specific fields — mapping it to a real platform is your
application's job.

```js
project.deploymentContract;
// static app:    { type: 'static', buildCommand: 'npm run build', outputDirectory: 'dist' }
// http service:  { type: 'service', runtime: 'node', buildCommand, startCommand, defaultPort, healthCheckPath }
// library / cli: { type: 'library' | 'cli', buildCommand? }
```

## Export a reproducible definition

A `PackkitProjectDefinition` is a small, serializable record — config, preset,
and the extensions you added — that reproduces the same project later. It holds
**no secrets and no machine paths**.

```js
const definition = exportProjectDefinition(extended);
// store it (a file, a database, a field on your record)…

const recreated = createProjectFromDefinition(definition);
```

Loading a definition validates its schema and warns if it was created with a
different Packkit version (output may differ across versions).

If a file the host originally *added* is now one that the current Packkit
generates, that's reported as an error-severity diagnostic and the stored copy
is used. To make that condition fail loudly instead:

```js
const recreated = createProjectFromDefinition(definition, { driftPolicy: 'error' });
// throws PackkitValidationError when an added file now collides with generated output
```

The default, `driftPolicy: 'report'`, returns the project with the diagnostic so
you can decide. A returned project may therefore carry error-severity
diagnostics without `createProjectFromDefinition` having thrown — inspect
`project.diagnostics` if you treat those as failures.

## Calculate a digest

For change detection or caching, a digest over the normalized config and file
contents is stable across regenerations of the same inputs:

```js
import { calculateProjectDigest } from 'create-packkit/embedded';

calculateProjectDigest(extended) === calculateProjectDigest(recreated); // true
```

## Write it safely

`writeGeneratedProject` is the only part that touches disk. It validates every
path again at the boundary, refuses anything that would escape the destination,
and does nothing else — no install, no git, no lifecycle scripts.

```js
import { writeGeneratedProject } from 'create-packkit/writer';

const result = await writeGeneratedProject({
  project: recreated,
  destination: '/tmp/weather-dashboard',
  // collisionPolicy: 'error' (default) | 'skip' | 'overwrite'
});

result.writtenFiles; // string[]
result.skippedFiles; // string[]
result.diagnostics;  // per-file write outcomes
```

An invalid path anywhere in the project makes the whole write fail before
anything is written, so you never get half-escaped output.

### What the writer protects against, and what it doesn't

The writer is safe against a **hostile file map** and **pre-existing symlinks**:
absolute paths, `..` escapes, null bytes, and paths that resolve through an
existing symbolic link (including the destination itself, and the final file
component) are all rejected before anything is written.

It is **not** race-proof against a concurrently malicious process. There is a
window between the symlink/collision preflight and the `mkdir`/`writeFile`, so
another process mutating the destination directory *at the same time* — swapping
a checked directory for a symlink — could still redirect a write. Closing that
would require atomic `openat`/`O_NOFOLLOW`-style writes.

For the intended use — writing a freshly generated project into a private
temporary workspace your application controls — this doesn't arise. If you're
writing into a directory another process can mutate concurrently, treat that as
outside the writer's guarantees.

## Stable vs internal

Stable, versioned API (import from `create-packkit`, `create-packkit/embedded`,
or `create-packkit/writer`):

- `createProject`, `extendProject`
- `exportProjectDefinition`, `createProjectFromDefinition`
- `calculateProjectDigest`, `deriveDeploymentContract`
- `writeGeneratedProject`
- `PackkitValidationError`, `PackkitWriteError`, `SCHEMA_VERSION`

Everything under `src/core/**` beyond the documented core exports
(`generate`, `fromPreset`, `normalizeConfig`, `OPTIONS`, …) is internal and may
change without a major bump. Import through the package exports above rather
than reaching into implementation paths.
