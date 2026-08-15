# Packkit Platform Migration — JS/TS scaffolder → multi-language platform

> **Historical record.** This is the phase-by-phase narrative of how Packkit went
> from a single JS/TS project generator to a provider-neutral multi-language
> platform. For the platform **as it stands today** — the live architecture, the
> protocol, conformance, providers, and the current compatibility matrix — see
> [`../PLATFORM.md`](../PLATFORM.md). Version numbers and "current" statements below
> are frozen at the time each phase shipped and are **not** kept up to date.

## Outcome

**The 10-phase migration is complete.** Packkit evolved from "a JS/TS project
generator" into a provider-neutral project bootstrap and lifecycle platform: a
language-agnostic core (`@packkit/core`) defines a versioned protocol; per-language
generators (JS, Python, Go) implement it, each proven by an **executable
conformance suite**; `packkit-mcp` + `packkit-web` front all three languages; and
`provider-netlify` + `provider-aws` deploy any of them from the neutral deployment
contract. The Go spike validated the thesis empirically — a third language forced
exactly **one** core change (the `node-service` → language-neutral `service`
generalization), the last npm concept in core.

Guiding rule throughout: **contract-first, not mechanical extraction.** Extract
only genuinely language-neutral concepts, never whatever two repos happen to
duplicate. No files moved until the extraction map showed clean dependency
direction and Phase-1 characterization tests were in place.

## Universal-Embedding consolidation

Before the language spikes, the embedded lifecycle was consolidated into core:

- **`@packkit/core` 0.2.0** — `calculateGeneratedProjectDigest` (canonical
  identity), `extendGeneratedProject` (generic add/replace host files +
  provenance), `computeProjectUpgrade` + common `UpgradeResult` envelope,
  `ProjectDefinition.baseline?` / `GeneratedProject.extensions?`,
  `runEmbeddedLifecycleConformance`. Default entry stayed browser-safe; manifest
  semantics stayed per-generator.
- **create-packkit 4.1.0** — delegates digest/extension/upgrade-envelope to core;
  rich embedded API kept intact; passes the lifecycle suite.
- **create-packkit-py 2.0.0** — common upgrade envelope, extension survives replay,
  uses the core Node writer; passes the lifecycle suite.
- **provider-netlify** — `provider × DeploymentContract`, not `provider × language`
  (dropped the `create-packkit` peer dep; consumes `@packkit/core`).

## Module extraction map (create-packkit → destination)

The one-time map that guided the extraction. All of these moves are **done**; the
table is preserved to show where each concept landed and why.

| Original module | Destination | Notes |
| --- | --- | --- |
| `src/core/hash.js` (`contentHash`) | **core** (browser-safe) | universal |
| `src/embedded/paths.js` (`validateRelativePath`) | **core** (browser-safe) | path safety |
| `src/embedded/writer.js` (`writeGeneratedProject`) | **`@packkit/core/node`** | needs `node:fs` |
| `src/embedded/contract.js` — **types** (`DeploymentContract` union) | **core** | + `Worker` |
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

## Phased backlog

### Phase 0 — Plan & backlog ✅
- Migration plan, extraction map, version strategy, phased backlog.
- Tracking milestone + phase issues (#49–#58).

### Phase 1 — Characterization safety net ✅
- Byte-parity snapshots of all `create-packkit` and `create-packkit-py` presets.
- Semantic invariant tests (JSON/TOML parse, contract + definition validation, path
  safety, unique IDs, round-trip).

### Phase 2 — `packkit-core`: protocol, primitives, conformance ✅
- New package `@packkit/core` with browser/node/testing subpaths.
- `PACKKIT_PROTOCOL_VERSION`, `PackkitGenerator` (+ capabilities/maturity),
  `ManifestDiffer`, deployment contracts (+ `Worker`), stable-ID/deprecation types.
- Universal primitives: hashing, file three-way diff, `toJson`, diagnostics,
  path-safety; writer under `@packkit/core/node`.
- `runGeneratorConformanceSuite` in `@packkit/core/testing`.
- `create-packkit` depends on core, implements `PackkitGenerator` (pkg semantics
  behind its `ManifestDiffer`), passes the suite → **4.0.0** (the public embedded
  API intentionally reshaped; `npx create-packkit` and the npm name never broke).

### Phase 3 — Python lifecycle parity ✅
- `create-packkit-py` implements `PackkitGenerator` on `@packkit/core`, passes the
  conformance suite (embedded API, schema, definitions/provenance, baseline-aware
  upgrade via a pyproject `ManifestDiffer`, deployment contract) → **1.0.0**.

### Phase 4 — `packkit-actions` (shared CI, moved ahead of mcp/web) ✅
- Reusable `workflow_call` workflows: `generator-ci`, `generator-integration`,
  `security`, `dependency-freshness`. `npm-release` intentionally **not** shared —
  publishing stays local per supply-chain policy.
- Standard generator scripts `check` + `test:integration` + `check:freshness`;
  shared YAML invokes scripts, never encodes language commands.
- Version policy: consumers pin `@v1`; third-party actions SHA-pinned.
- Weekly `dependency-freshness` as an org invariant (single tracking issue).
- OIDC trusted publishing for all packages; final `npm publish` stays local.
- **Changesets automation** — release workflows use `changesets/action@v1.9.0`
  (Version PR → `changeset publish`), tokenless OIDC + provenance, publish in-repo.

### Phase 5 — Extract `packkit-mcp` ✅
- Own repo; registers generators via `@packkit/core`'s registry and drives them
  purely through the protocol; tools `list_generators` / `list_presets` /
  `get_generator_schema` / `generate_project` / `plan_upgrade`. Shipped
  **`packkit-mcp@1.0.0`** (breaking: old JS-only `packkit_*` tools replaced);
  tokenless OIDC + provenance; official-registry entry
  `io.github.PackkitLabs/packkit-mcp`. The `mcp/` subfolder was removed from
  create-packkit.

### Phase 6 — Extract `packkit-web` ✅
- Own repo; one UI renders any generator's schema via a per-generator adapter +
  language picker; generate + ZIP + share links, all client-side (esbuild bundle of
  the browser-safe cores + JSZip).
- **Live on Cloudflare Pages: <https://packkit-web.pages.dev/>** — chosen over
  GitHub Pages so a future "create + push to a GitHub repo" feature can drop into a
  reserved `functions/` backend seam. The old `create-packkit/docs` configurator now
  redirects there.

### Phase 7 — Worker target as cross-language validation ✅
- `node-worker` (`create-packkit@4.2.0`) + `py-worker` (`create-packkit-py@2.1.0`)
  on the shared `WorkerDeploymentContract` — **zero core changes**, proving the
  contract is truly universal. Each emits a unit-testable `handle()` seam, a runner
  that drains in-flight work on SIGTERM/SIGINT and exits 0, structured JSON logs, a
  poison-message seam, and a Dockerfile with no EXPOSE/HTTP healthcheck.

### Phase 8 — Go generator spike (`create-packkit-go`) ✅
- **Slice 1 — `go-lib`** (zero core changes): a JS generator whose output is an
  idiomatic Go project; passes both `runGeneratorConformanceSuite` and
  `runEmbeddedLifecycleConformance`; `go.mod` semantics in `goModDiffer`, never in
  core. Real-Go CI via a `setup-go` path in `packkit-actions`. Published `0.1.0`.
- **Slice 2 — `go-cli`** (zero core changes): testable library package at the module
  root + a thin `cmd/<name>/main.go`. Emits a `cli` contract.
- **Slice 3 — `go-worker`** (zero core changes) — cross-language worker proof #3:
  the same `WorkerDeploymentContract` as JS/Python, with a context-driven drain that
  exits 0 on SIGTERM/SIGINT (channel-fed reader + `select`).
- **Slice 4 — `go-service`** — surfaced **the one permitted core change**. A
  `net/http` server forced `@packkit/core@0.4.0` to rename the npm-flavored
  `node-service` deployment type (`type:'node-service'`, `runtime:'node'`) to the
  language-neutral **`service`** (`type:'service'`, `runtime:string`), mirroring the
  already-neutral `worker` contract. This was the last npm concept in core — the Go
  spike's whole justification.
- **Cascade:** the whole ecosystem realigned to `@packkit/core@0.4.0` with no split
  core at the time: `create-packkit@4.3.0`, `create-packkit-py@2.1.1`,
  `create-packkit-go@0.3.1`, `provider-netlify@0.1.3`; `packkit-mcp@1.1.0` +
  `packkit-web` gained the Go generator → all three languages fronted.

### Phase 9 — Repo rename + full doc/URL audit ✅
- Renamed `PackkitLabs/create-packkit` → **`PackkitLabs/create-packkit-js`** (GitHub
  keeps repo-URL redirects). The **npm package name and CLI stay `create-packkit`**.
  Audited & updated every reference, including the GitHub Pages URL (Pages project
  URLs do **not** auto-redirect) and the `$schema` URL emitted into every generated
  `packkit.json` (snapshots regenerated). Note: the local working-copy dir is still
  `create-packkit/` (cosmetic; the remote is `create-packkit-js`).

### Phase 10 — Org rename ✅
- Org renamed **`PackkitJS` → `PackkitLabs`** (GitHub redirects all repo URLs +
  `uses:` refs). Full code sweep across all repos: every `PackkitJS` reference and
  the `packkitjs.github.io` → `packkitlabs.github.io` Pages subdomain (URLs, badges,
  workflow `uses:`, repo metadata, MCP registry id, web adapter `repoUrl`s, and the
  emitted `$schema` in all three generators' output). The `@packkit` npm scope and
  all package names/CLIs unchanged.
- Account-level follow-up (done): reconfigured the npm **OIDC Trusted Publishers**
  from `PackkitJS/<repo>` → `PackkitLabs/<repo>` for the OIDC packages;
  `create-packkit` publishes via `NPM_TOKEN`, unaffected.

## Post-migration work

After the 10 phases, the platform was **proven as a system** rather than
reorganized further:

- **`service` for Python** — `create-packkit-py@2.2.0` added a FastAPI `py-service`
  target on the neutral `service` contract, with a live-uvicorn integration check.
- **Fullstack composition** — `composeFullstack` landed in `@packkit/core@0.5.0` as
  a language-neutral primitive (static frontend + service backend → `apps/web` +
  `apps/server` + neutral docker-compose + `fullstack` contract), wired into
  `packkit-mcp` (`compose_fullstack` tool) and `packkit-web` (verified in-browser:
  React + FastAPI, React + Go).
- **`provider-aws`** — a second deployment provider (IaC-emitting: OpenTofu +
  GitHub-OIDC pipeline; `static` → S3 + CloudFront, `service` → App Runner,
  `worker` → ECS Fargate on a no-NAT VPC), resolving the long-standing #45
  Terraform/OpenTofu question via the provider shape.
- **Provider conformance** — `@packkit/core@0.6.0` added `PackkitProvider` +
  `runProviderConformanceSuite`; both providers (netlify `['plan','apply']`, aws
  `['plan']`) pass it. Published as provider-netlify@0.2.0 + provider-aws@0.2.0.
- **Go freshness net** — `create-packkit-go` gained `check:freshness` + a weekly
  workflow tracking the emitted Go toolchain floor and distroless base against
  upstream; it immediately caught a stale distroless base (debian12 → debian13).

## Version & compatibility strategy (as designed)

- **create-packkit → 4.0.0** because the public embedded API intentionally
  reshaped to implement `PackkitGenerator` — not merely because code moved. Semver
  describes consumer impact; `npx create-packkit` and the npm name never break.
- **`@packkit/core` → 0.1.0** (new); `create-packkit-py` → 1.0.0 at lifecycle parity.
- **Two compatibility gates:** byte characterization (refactors don't change output)
  + semantic invariants (intentional evolution stays valid).
- **provider-netlify** consumes the contract structurally (no import), so
  compatibility is expressed against the **deployment-contract version**, verified
  by tests, not primarily against a create-packkit range.
- **Changelogs** started hand-maintained (Keep a Changelog format) from the first
  commit, then flipped to generated per-package changelogs when Changesets automation
  landed in Phase 4.

## Risks & mitigations (migration-era)

| Risk | Mitigation |
| --- | --- |
| Breaking `create-packkit`'s output during extraction | Phase-1 byte-parity snapshots gate every move |
| npm concepts leaking into core | `ManifestDiffer` seam; conformance suite; the Go spike as proof |
| Node modules pulled into the browser bundle | core browser-safe by default; writer under `/node`; CI asserts no `node:*` |
| Independently versioned repos drifting apart | Protocol version + capability negotiation + compatibility matrix |
| Pages churn | Deferred to a single move in Phase 6 (packkit-web) |
| provider-netlify coupling | Structural contract (no import); verified by tests against deployment-contract v1 |
| Reusable-workflow trusted-publishing quirk | Keep the `npm publish` job local to each repo; pin `@v1` |
