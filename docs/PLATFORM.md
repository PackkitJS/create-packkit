# Packkit Platform Migration — JS/TS scaffolder → multi-language platform

Status: **Phases 2–7 + the Universal-Embedding consolidation complete.** `packkit-web` is live at https://packkit-web.pages.dev/. The whole ecosystem runs on one lifecycle: `@packkit/core@0.3.0` owns the universal digest / extension / upgrade-envelope primitives + the `createPackkit()` facade + an **embedded lifecycle conformance suite** that both JS (`create-packkit@4.2.0`) and Python (`create-packkit-py@2.1.0`) pass; `provider-netlify@0.1.2` consumes core deployment contracts (no JS-generator coupling); `packkit-mcp@1.0.2` + `packkit-web` return the common upgrade envelope for both languages. **Phase 7** shipped `node-worker` + `py-worker` on the identical `WorkerDeploymentContract` with **zero core changes** — the cross-language proof. A host integrates once and drives any generator by id. **Phase 8 (Go spike) Slice 1 shipped**: [`create-packkit-go@0.1.0`](https://github.com/PackkitJS/create-packkit-go) `go-lib` passes both conformance suites with **zero core changes** (CI + Go integration green; publish pending the new-package npm Trusted Publisher). Next: **Phase 8 — `go-cli`/`go-service`/`go-worker`** · Owner: DanMat

### Universal-Embedding consolidation (done)
- **`@packkit/core` 0.2.0** — `calculateGeneratedProjectDigest` (canonical identity), `extendGeneratedProject` (generic add/replace host files + provenance), `computeProjectUpgrade` + common `UpgradeResult` envelope, `ProjectDefinition.baseline?`/`GeneratedProject.extensions?`, `runEmbeddedLifecycleConformance`. Default entry stays browser-safe; manifest semantics stay per-generator.
- **create-packkit 4.1.0** — delegates digest/extension/upgrade-envelope to core; rich embedded API kept intact; passes the lifecycle suite.
- **create-packkit-py 2.0.0** — common upgrade envelope, extension survives replay, uses the core Node writer; passes the lifecycle suite.
- **provider-netlify** — `provider × DeploymentContract`, not `provider × language` (dropped the `create-packkit` peer dep; consumes `@packkit/core`).
- **Docs** — org profile + `@packkit/core` README document the three integration levels (universal core / language embedded / Node writer). Deferred: `createPackkit()` facade (a thin registry + helpers already suffices); a release workflow for `provider-netlify`.

Packkit is evolving from "a JS/TS project generator" into a **provider-neutral
project bootstrap and lifecycle platform**, where a language-agnostic core defines
a **versioned protocol** and per-language generators implement it — proven not by a
shared TypeScript interface alone, but by an **executable conformance suite**.
`create-packkit-py` already proves the model (a JS generator that emits idiomatic
Python). This document is the plan and the backlog.

Guiding rule: **contract-first, not mechanical extraction.** We extract concepts
that are genuinely language-neutral, not whatever two repos happen to duplicate.
No files move until the extraction map shows clean dependency direction and the
Phase-1 characterization tests are in place (they are).

## 1. Target architecture

```text
PackkitJS/
├── packkit-core        # the versioned protocol + primitives + conformance suite — no language templates
├── create-packkit      # JS/TS generator (repo renamed to create-packkit-js LAST; npm name stays create-packkit)
├── create-packkit-py   # Python generator (exists)
├── packkit-actions     # reusable CI workflows — stood up BEFORE mcp/web so they don't duplicate CI
├── packkit-mcp         # extracted from create-packkit/mcp; fronts every generator
├── packkit-web         # extracted configurator; renders any generator's schema
├── provider-netlify    # exists; contract-driven
└── .github
```

Dependency direction is one-way and acyclic: `packkit-core` ← generators ←
{mcp, web, providers}. Nothing downstream imports a generator's internals.

## 2. The core contract & protocol (`@packkit/core`)

### 2.1 Protocol version, separate from package version

The ecosystem contract has its own version, **decoupled from `@packkit/core`'s
semver**. `@packkit/core` can release 1.4.0 without changing the protocol; only a
genuinely incompatible contract bumps the protocol.

```ts
export const PACKKIT_PROTOCOL_VERSION = 1;
```

Project definitions and provenance carry both:

```json
{ "schemaVersion": 3, "protocolVersion": 1, "generator": { "id": "python", "version": "1.2.0" } }
```

### 2.2 `PackkitGenerator` with capability negotiation

A generator advertises the protocol version and the capabilities it actually
implements, so consumers **degrade gracefully** instead of assuming every
generator does everything just because it satisfies the TS interface.

```ts
interface PackkitGenerator {
  id: string;                 // stable public identifier (see §2.5)
  language: string;
  version: string;            // the generator package version
  maturity: MaturityStatus;   // 'experimental' | 'preview' | 'stable' | 'deprecated'
  protocol: { version: 1; capabilities: GeneratorCapability[] };

  listPresets(): PresetDescriptor[];
  getSchema(): GeneratorSchema;
  createProject(input): GeneratedProject;
  createProjectFromDefinition(definition): GeneratedProject;
  upgradeProject(input): ProjectUpgradeResult;
}

type GeneratorCapability =
  | 'generate' | 'project-definition' | 'baseline-upgrade'
  | 'deployment-contract' | 'browser';
```

Consumers gate on capabilities: `generator.protocol.capabilities.includes('baseline-upgrade')`.
Python can ship `generate + schema` first and add `provenance` then `upgrades`
later without breaking MCP/web.

### 2.3 In core / not in core

**In core:** the protocol constant, `PackkitGenerator`/`ManifestDiffer` interfaces,
types (`Diagnostic`, `GeneratedProject`, `PresetDescriptor`, `GeneratorSchema`,
`ProjectDefinition`, `Baseline`, `ChangeClassification`, `DeploymentContract` incl.
`Worker`), deterministic hashing, the **file** three-way diff, extension/collision
rules, schema serialization, an **explicit-registration** generator registry, and
the conformance suite.

**Not in core (per generator, behind `ManifestDiffer`):** `package.json`/
`pyproject.toml` manipulation, npm/uv, bundlers, ESM/CJS, Vitest/Jest/ruff/pytest/
mypy, framework/service templates, language naming rules, and all manifest
semantics (npm `scripts`/`dependencies`/`exports` vs. Python `[project]`/
optional-deps/entry-points).

### 2.4 Node/browser packaging boundaries (protects `packkit-web`)

Core is browser-safe **by default**; anything that needs Node lives behind a
subpath export, so a browser bundle never transitively loads `node:*`.

```text
@packkit/core          # browser-safe: types, protocol, hashing, diffing, registry
@packkit/core/node     # filesystem writer, anything importing node:fs/path/child_process
@packkit/core/testing  # the conformance suite (dev-only)
```

**Phase-2 acceptance criterion:** importing `@packkit/core` must not transitively
load `node:fs`, `node:path`, `child_process`, or any network client (asserted in CI).

### 2.5 Stable identifiers & deprecation

Generator IDs, preset IDs, and option IDs are **public persistent identifiers** —
web/MCP/automation store `{ "generator": "python", "preset": "py-cli" }`. Once a
generator hits 1.0, its IDs cannot be silently renamed or reused. Renames go
through deprecation, carried in the descriptors:

```ts
interface PresetDescriptor { id: string; maturity: MaturityStatus; deprecated?: boolean; replacement?: string; /* … */ }
interface GeneratorSchema { schemaVersion: number; generatorId: string; options: OptionDescriptor[]; }
interface OptionDescriptor { id: string; /* stable key — UI labels/presentation change independently */ }
```

## 3. Conformance suites — the executable definition of "Packkit"

A shared GitHub Actions repo ensures every repo *runs* tests; the conformance
suite defines *what those tests must prove*. Every generator runs the same one:

```ts
import { runGeneratorConformanceSuite } from '@packkit/core/testing';
runGeneratorConformanceSuite(generator);
```

It asserts universal behavior: unique generator ID · stable preset IDs · valid
schema (no duplicate option IDs) · every preset generatable · deterministic output
· every path safe · no file collisions · definition export/replay · digest
stability · deployment contract validates · baseline round-trip · upgrade-planning
semantics · diagnostics conform to schema · browser-safe **iff** the `browser`
capability is advertised.

A **provider** conformance suite mirrors it (added before provider #2): stable
provider ID · deterministic `supports()` · unsupported contracts explain why ·
serializable, schema-versioned plan · `apply` validates provider+plan · secrets
never appear in state · partial results representable · serializable state ·
provider never inspects generator-specific config.

## 4. Module extraction map (create-packkit today → destination)

| Current module | Destination | Notes |
| --- | --- | --- |
| `src/core/hash.js` (`contentHash`) | **core** (browser-safe) | universal |
| `src/embedded/paths.js` (`validateRelativePath`) | **core** (browser-safe) | path safety |
| `src/embedded/writer.js` (`writeGeneratedProject`) | **`@packkit/core/node`** | needs `node:fs` — NOT browser-safe core |
| `src/embedded/contract.js` — **types** (`DeploymentContract` union) | **core** | add `WorkerContract` |
| `src/embedded/contract.js` — `deriveDeploymentContract` | **create-packkit-js** | npm-specific |
| `src/embedded/upgrade.js` — file three-way + diagnostics + baseline shape | **core** | universal |
| `src/embedded/upgrade.js` + `pkg-merge.js` — package.json semantics | **create-packkit-js** | behind `ManifestDiffer` |
| `src/core/provenance.js` — baseline/provenance **schema** | **core** | `buildBaseline` for package.json stays JS |
| `src/core/render.js` (`toJson`) | **core** | deterministic JSON |
| Diagnostics / `GeneratedProject` / `ProjectDefinition` / `PresetDescriptor` / `GeneratorSchema` types | **core** | contract types |
| `src/core/options.js`, `presets.js`, `features/*`, `monorepo.js`, `pkg.js`, `node*.js`, `versions.js` | **create-packkit-js** | JS templates + options |
| `src/cli/*` | **create-packkit-js** | JS CLI |
| `mcp/*` | **packkit-mcp** | fronts all generators |
| `docs/*` (configurator + bundled core) | **packkit-web** | renders any generator |

## 5. Version & compatibility strategy

- **create-packkit → 4.0.0** because the **public embedded API intentionally
  reshapes** to implement `PackkitGenerator` — *not* merely because code moved to
  `@packkit/core`. Semver describes consumer impact. `npx create-packkit` and the
  npm name never break.
- **`@packkit/core` → 0.1.0** (new); `create-packkit-py` → 1.0.0 at lifecycle parity.
- **Cross-repo compatibility matrix** (kept current in this doc + checked in CI where practical):

  | Package | Protocol | `@packkit/core` | Maturity |
  | --- | ---: | --- | --- |
  | create-packkit(-js) | 1 | `^1` | stable |
  | create-packkit-py | 1 | `^1` | stable |
  | packkit-mcp | 1 | `^1` | stable |
  | packkit-web | 1 | `^1` | stable |
  | create-packkit-go | 1 | `^1` | experimental |
  | provider-netlify | deployment-contract v1 | — | stable |

- **Two compatibility gates, not one:**
  - *Byte characterization* (Phase 1, done) proves refactors don't change output.
  - *Semantic invariants* prove intentional evolution stays valid: every generated
    JSON/TOML parses, every deployment contract + project definition validates,
    every path is safe, preset/option IDs are unique, and
    preset→config→definition→project round-trips. Snapshots catch accidents;
    invariants protect evolution.
- **provider-netlify** consumes the contract structurally (no import), so it keeps
  working; compatibility is verified by tests, and expressed against the
  **deployment-contract version**, not primarily against a create-packkit range.

### 5.1 Release notes & changelogs

Every ecosystem repo keeps a **hand-maintained `CHANGELOG.md`** starting now, in
the [Keep a Changelog](https://keepachangelog.com) format: a top
`## [Unreleased]` section, then released versions newest-first, using
`Added / Changed / Fixed / Removed / Deprecated / Security` categories as needed.
This is deliberately low-tech so migration progress is tracked from the first
commit onward, before any release tooling is unified.

**Full [Changesets](https://github.com/changesets/changesets) automation is
adopted later, in Phase 4 (`packkit-actions`)** — the reusable-CI phase, where
release workflows get standardized across the org. Packages are already scaffolded
with `@changesets/cli`, but the live release flow (create-packkit's custom
`release.yml`) is not wired to `changeset version`/`changeset publish` yet, so that
switch is deferred to avoid churn now. Until then, changelog entries are written by
hand; Phase 4 flips them over to generated, per-package changelogs.

## 6. Phased backlog

### Phase 0 — Plan & backlog ✅
- [x] Migration plan, extraction map, version strategy, phased backlog
- [x] Tracking milestone + phase issues (#49–#58)

### Phase 1 — Characterization safety net ✅ (byte) / ▶ (semantic)
- [x] Byte-parity snapshots of all `create-packkit` presets (#49)
- [x] Byte-parity snapshots of all `create-packkit-py` presets
- [ ] **Semantic invariant tests** in both repos (JSON/TOML parse, contract +
      definition validation, path safety, unique IDs, round-trip) — Addition 6

### Phase 2 — `packkit-core`: protocol, primitives, conformance ✅
- [x] New repo/package `@packkit/core` with browser/node/testing subpaths
      (shipped 0.1.0; now 0.1.2 — OIDC trusted publishing live)
- [x] `PACKKIT_PROTOCOL_VERSION`, `PackkitGenerator` (+ capabilities/maturity),
      `ManifestDiffer`, deployment contracts (+ `Worker`), stable-ID/deprecation types
- [x] Universal primitives: hashing, file three-way diff, `toJson`, diagnostics,
      path-safety; **writer under `@packkit/core/node`**
- [x] `runGeneratorConformanceSuite` in `@packkit/core/testing`
- [x] `create-packkit` depends on core, implements `PackkitGenerator` (pkg semantics
      behind its `ManifestDiffer`), passes the conformance suite → **4.0.0**
- **Acceptance:** Phase-1 snapshots byte-identical; browser entry loads no `node:*`;
      `npx create-packkit` unchanged; provider-netlify green; conformance suite passes.

### Phase 3 — Python lifecycle parity ✅
- [x] `create-packkit-py` implements `PackkitGenerator` on `@packkit/core`, passes
      the conformance suite: embedded API, schema, definitions/provenance,
      baseline-aware upgrade (pyproject `ManifestDiffer`), deployment contract → 1.0.0

### Phase 4 — `packkit-actions` (shared CI, moved ahead of mcp/web) ✅
- [x] Reusable `workflow_call` workflows: `generator-ci`, `generator-integration`,
      `security`, `dependency-freshness` shipped (`packkit-actions` v1.2.0, moving `v1`
      tag). `npm-release` intentionally NOT shared — publishing stays local per
      supply-chain policy. `generated-project-validation` folded into `generator-integration`.
- [x] Standard generator npm scripts `check` + `test:integration` + `check:freshness`
      (create-packkit-py is the reference: scaffold each preset → uv + pytest/ruff/mypy;
      freshness reads emitted deps from generated pyproject → PyPI). Shared YAML
      invokes scripts, never encodes language commands.
- [x] **Version policy:** consumers pin `@v1`; third-party actions (setup-uv,
      changesets/action) SHA-pinned. core + py adopted; create-packkit took `security@v1`.
- [x] Weekly `dependency-freshness` as an org invariant — reusable workflow manages a
      single tracking issue. Reference impl caught pytest/mypy a major behind → bumped
      the emitted floors current (integration-verified); ran live, green, no false issue.
- [x] OIDC trusted publishing for all packages; final `npm publish` stays local.
- [x] **Changesets automation** — release workflows use `changesets/action@v1.9.0`
      (Version PR → `changeset publish`), tokenless OIDC + provenance, publish in-repo.
      Proven end-to-end: shipped `create-packkit-py@1.0.2` and `@packkit/core@0.1.3`.

### Phase 5 — Extract `packkit-mcp` ✅
- [x] Own repo (`PackkitJS/packkit-mcp`); registers both generators via
      `@packkit/core`'s registry and drives them purely through the protocol; tools
      `list_generators`/`list_presets` (experimental hidden)/`get_generator_schema`/
      `generate_project` (preview or write)/`plan_upgrade`; JS + Python in v1.
      Shipped **`packkit-mcp@1.0.0`** (breaking: the old JS-only `packkit_*` tools are
      replaced) — tokenless OIDC npm publish + provenance, and the official-registry
      entry `io.github.PackkitJS/packkit-mcp@1.0.0` now points at the new repo. The
      `mcp/` subfolder and its release machinery were removed from create-packkit.
- **Manual follow-ups (Dan):** Glama admin → Build & Release to re-point the listing
      at `PackkitJS/packkit-mcp` (see RELEASING.md for the known-good config), and
      update the awesome-mcp-servers entry's Glama score-badge URL to the new repo.

### Phase 6 — Extract `packkit-web` ✅
- [x] Own repo (`PackkitJS/packkit-web`); one UI renders any generator's schema via a
      per-generator adapter + language picker; **JS + Python** generate + ZIP + share
      links, all client-side (esbuild bundle of the browser-safe cores + JSZip).
      CI green (shared `generator-ci@v1` runs build + an adapter smoke).
- [x] **Live on Cloudflare Pages: https://packkit-web.pages.dev/** (verified in-browser
      for both generators). Chosen over GitHub Pages so a future "create + push to a
      GitHub repo" feature drops into the reserved `functions/` seam (OAuth token
      exchange needs a backend a static site can't hold) with no re-platforming.
- [x] **Single clean Pages move done:** retired the old `create-packkit/docs`
      configurator → it now redirects to the new URL (GitHub Pages stays up for
      `llms.txt` + old links); dropped `build:web` + the bundle-fresh CI job.

### Phase 7 — Worker target (#44) as cross-language validation ✅
- [x] `node-worker` (`create-packkit@4.2.0`) + `py-worker` (`create-packkit-py@2.1.0`)
      on the shared `WorkerDeploymentContract` — **zero core changes**, proving the
      contract is truly universal. Each emits a unit-testable `handle()` seam, a
      runner that drains in-flight work on SIGTERM/SIGINT and **exits 0**, structured
      JSON stdout logs, a poison-message seam (bounded retries), env config, a
      `python -m` / `node dist/index.js` entry, and a Dockerfile with **no
      EXPOSE/HTTP healthcheck** (`STOPSIGNAL SIGTERM`). No transport SDK — a `receive()`
      seam is wired to a stdin demo source. Each generator's own test proves the
      SIGTERM drain exits 0, and both integration matrices run the worker in CI. Closes #44.

### Phase 8 — Go generator spike (`create-packkit-go`)
- [x] **Slice 1 — `go-lib` (shipped repo, ✅ zero core changes).**
      [`create-packkit-go`](https://github.com/PackkitJS/create-packkit-go) is a JS
      generator whose output is an idiomatic Go project (a `go.mod` module, a
      documented package, a table test). `goGenerator` passes BOTH
      `runGeneratorConformanceSuite` and `runEmbeddedLifecycleConformance` — the same
      suites JS/Python pass — with **no `@packkit/core` change**. Go-specific `go.mod`
      semantics live in `goModDiffer` (never in core). Generated `go-lib` is
      gofmt-clean and passes `go vet`/`go build`/`go test`, proven end-to-end in CI
      (`scripts/integration.mjs` + a new `setup-go` path in
      `packkit-actions@v1.3.0`'s `generator-integration`). CI + Integration green;
      `0.1.0` publish awaits the npm Trusted Publisher config for the new package name.
- [ ] `go-cli`/`go-service`/`go-worker` implementing `PackkitGenerator`, still with
      **zero core changes** — except `go-service` is expected to surface the one
      legitimate generalization: `DeploymentType 'node-service'` → a language-neutral
      service type (the milestone's permitted core improvement).

### Phase 9 — Repo rename + full doc/URL audit
- [ ] Rename `create-packkit` → `create-packkit-js` (npm name/CLI unchanged); audit
      every doc, badge, Pages URL, npm metadata, provider peer-dep, llms.txt, MCP
      config, and `PackkitJS/create-packkit` reference; remove all JS/TS-only wording.

### Phase 10 — Org rename (finale 😅)
- [ ] Branding checkpoint once JS/Python/Go(/IaC) ship; if renaming, execute with a
      full redirect/URL audit. The last task.

## 7. Deferred / out of scope

- **Dynamic/community generator plugins** — the registry is **explicit-registration
  only** for now (`registry.register(jsGenerator)`). No npm scanning, dynamic
  download, or arbitrary plugin execution until a trust model exists (signing,
  compatibility, sandboxing, permission declarations, discovery).
- **#45 Terraform/OpenTofu** — not in create-packkit-js. After Phase 8 proves the
  contract across programming languages, revisit as a dedicated `create-packkit-iac`
  / `create-packkit-tofu` generator. Leave #45 open with that note.
- **#70 Polyglot contract packages** (one repo → npm **and** PyPI from one tag; a
  JS-package-and-Python-package with a language-neutral schema source of truth).
  **Decided shape: Shape 2 — a reusable release capability in `packkit-actions`
  (dual-registry OIDC + version-sync check + partial-publish recovery + optional
  codegen-drift gate), NOT a generator/core change.** Deferred (non-blocking); does
  not touch the generator↔language 1:1:1 model, so it never influences the protocol
  or new-language work. Partial-publish recovery = publish PyPI first (recoverable),
  gate npm (immutable) on its success. Leave #70 open.
- **Python tool matrix** (Poetry/PDM/Flit, black/isort/pyright, tox/nox, Django/
  FastAPI/Flask) — only after Python reaches lifecycle parity (Phase 3).

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Breaking `create-packkit`'s output during extraction | Phase-1 byte-parity snapshots gate every move |
| npm concepts leaking into core | `ManifestDiffer` seam; conformance suite; Go spike (Phase 8) as proof |
| Node modules pulled into the browser bundle | `@packkit/core` browser-safe by default; writer under `/node`; CI asserts no `node:*` |
| Independently versioned repos drifting apart | Protocol version + capability negotiation + compatibility matrix |
| Pages churn | Deferred to a single move in Phase 6 (packkit-web) |
| provider-netlify coupling | Structural contract (no import); compatibility verified by tests against deployment-contract v1 |
| Reusable-workflow trusted publishing quirk | Keep the `npm publish` job local to each repo; pin `@v1` |

## 9. The org invariant & new-language onboarding

> **Every *deployable* preset emits a provider-neutral deployment contract**
> (non-deployable targets such as libraries emit a `library`/non-deployable
> contract). **Providers determine support exclusively from the contract**, never
> from generator identity or language. A generator is "Packkit-compatible" only if
> it implements `PackkitGenerator`, **passes the conformance suite**, and its
> generated projects are continuously validated against their declared
> runtime/toolchain matrix.

Adding a language is then an operational checklist, not an architecture project:

```text
□ PackkitGenerator implementation + stable generator ID
□ preset & schema discovery (stable IDs, maturity)
□ embedded generation + deterministic output
□ project definitions / provenance
□ baseline-aware upgrade (its own ManifestDiffer)
□ deployment contracts (deployable presets)
□ web + MCP support
□ shared CI + weekly tool/dependency freshness + generated-project matrix
□ package artifact validation
□ passes runGeneratorConformanceSuite
□ documentation
```
