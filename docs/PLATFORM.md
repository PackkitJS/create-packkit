# Packkit Platform — architecture & invariants

**What Packkit is:** a **provider-neutral project bootstrap and lifecycle
platform**. A language-agnostic core (`@packkit/core`) defines a **versioned
protocol**; per-language generators implement it; surfaces (MCP server, web
configurator) drive any generator through the protocol; deployment providers act
on the neutral **deployment contract**, never on a generator or a language. A
host integrates once and drives JavaScript, Python, or Go by id.

This document describes the platform **as it stands today**. The phase-by-phase
story of how it got here lives in
[`history/PLATFORM-MIGRATION.md`](./history/PLATFORM-MIGRATION.md).

Guiding rule that still governs every change: **contract-first, not mechanical
extraction.** Only genuinely language-neutral concepts belong in core. The Go
spike (a third language) proved this empirically — it forced exactly **one** core
change, the `node-service` → language-neutral `service` generalization.

---

## 1. Architecture

```text
PackkitLabs/
├── packkit-core        # @packkit/core — the versioned protocol + primitives + conformance suites
├── create-packkit-js   # JavaScript/TypeScript generator (npm name & CLI stay `create-packkit`)
├── create-packkit-py   # Python generator
├── create-packkit-go   # Go generator
├── packkit-actions     # reusable CI/release workflows (workflow_call)
├── packkit-mcp         # MCP server — fronts every generator through the protocol
├── packkit-web         # web configurator — renders any generator's schema (live on Cloudflare Pages)
├── provider-netlify    # deployment provider (API-driven: plan + apply)
├── provider-aws        # deployment provider (IaC-emitting: plan)
└── .github             # org profile
```

Dependency direction is one-way and acyclic:
`packkit-core` ← generators ← { mcp, web, providers }. Nothing downstream imports
a generator's internals; providers never import a generator at all — they consume
the neutral deployment contract structurally.

**Live surfaces:**
- Web configurator — <https://packkit-web.pages.dev/> (JS + Python + Go + fullstack composition, all client-side).
- JS generator docs/schema — <https://packkitlabs.github.io/create-packkit-js/>.
- MCP server — `packkit-mcp` on npm; official registry id `io.github.PackkitLabs/packkit-mcp`.

## 2. The core contract & protocol (`@packkit/core`)

### 2.1 Protocol version, separate from package version

The ecosystem contract has its own version, **decoupled from `@packkit/core`'s
semver**. Core can release a new minor without touching the protocol; only a
genuinely incompatible contract bumps the protocol.

```ts
export const PACKKIT_PROTOCOL_VERSION = 1;
```

Project definitions and provenance carry both:

```json
{ "schemaVersion": 3, "protocolVersion": 1, "generator": { "id": "python", "version": "2.2.0" } }
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

### 2.3 Deployment contracts

Every **deployable** preset emits a provider-neutral `DeploymentContract`.
Non-deployable targets (libraries) emit a non-deployable contract. The union:

```text
static | service | worker | library | cli | fullstack
```

- **`service`** is language-neutral: `runtime: string` (`'node'`,
  `'python-3.12'`, `'go-1.x'`). A Node, Python, or Go HTTP service emit the *same*
  contract; a provider matches on shape, never language. (This is the generalized
  form of what was once npm-flavored `node-service` — the last npm concept removed
  from core.)
- **`worker`** is likewise neutral — the same `WorkerDeploymentContract` is emitted
  by `node-worker`, `py-worker`, and `go-worker`.
- **`fullstack`** = `{ frontend: static, backend: service }`, produced by the
  `composeFullstack` primitive (§2.6).

### 2.4 In core / not in core

**In core:** the protocol constant, `PackkitGenerator`/`ManifestDiffer`/
`PackkitProvider` interfaces, contract types (`Diagnostic`, `GeneratedProject`,
`PresetDescriptor`, `GeneratorSchema`, `ProjectDefinition`, `Baseline`,
`ChangeClassification`, the `DeploymentContract` union), deterministic hashing, the
**file** three-way diff, extension/collision rules, schema serialization, an
**explicit-registration** generator registry, the `composeFullstack` primitive, and
the conformance suites.

**Not in core (per generator, behind `ManifestDiffer`):** `package.json` /
`pyproject.toml` / `go.mod` manipulation, npm/uv/go tooling, bundlers, ESM/CJS,
test runners, framework/service templates, language naming rules, and all manifest
semantics.

### 2.5 Node/browser packaging boundaries (protects `packkit-web`)

Core is browser-safe **by default**; anything that needs Node lives behind a
subpath export, so a browser bundle never transitively loads `node:*`.

```text
@packkit/core          # browser-safe: types, protocol, hashing, diffing, registry, composeFullstack
@packkit/core/node     # filesystem writer, anything importing node:fs/path/child_process
@packkit/core/testing  # the conformance suites (dev-only)
```

CI asserts the browser entry loads no `node:fs`, `node:path`, `child_process`, or
network client.

### 2.6 Fullstack composition (`composeFullstack`)

A language-neutral primitive: given a **static** frontend `GeneratedProject` and a
**service** backend `GeneratedProject`, it stitches them into `apps/web` +
`apps/server`, rewrites each sub-contract root-relative, and emits a neutral
`docker-compose`, a root README, and a `fullstack` deployment contract. Because it
operates on plain `GeneratedProject` data, any static generator can supply the
frontend and any service generator the backend — proven live in the web
configurator (React + FastAPI, React + Go) and the MCP `compose_fullstack` tool.

### 2.7 Stable identifiers & deprecation

Generator IDs, preset IDs, and option IDs are **public persistent identifiers** —
web/MCP/automation store `{ "generator": "python", "preset": "py-cli" }`. Once a
generator hits 1.0, its IDs cannot be silently renamed or reused; renames go
through deprecation carried in the descriptors (`deprecated?`, `replacement?`).

## 3. Conformance suites — the executable definition of "Packkit"

Membership in the platform is proven by executable suites in
`@packkit/core/testing`, not by a shared TypeScript interface alone.

### 3.1 Generator conformance

```ts
import { runGeneratorConformanceSuite } from '@packkit/core/testing';
runGeneratorConformanceSuite(generator);
```

Asserts universal behavior: unique generator ID · stable preset IDs · valid schema
(no duplicate option IDs) · every preset generatable · deterministic output · every
path safe · no file collisions · definition export/replay · digest stability ·
deployment contract validates · baseline round-trip · upgrade-planning semantics ·
diagnostics conform to schema · browser-safe **iff** the `browser` capability is
advertised. All three generators (JS, Python, Go) pass it, plus the embedded
lifecycle suite (`runEmbeddedLifecycleConformance`).

### 3.2 Provider conformance

```ts
import { runProviderConformanceSuite } from '@packkit/core/testing';
```

A `PackkitProvider` advertises a stable `id` and its `capabilities`
(`'plan'` / `'apply'`). The suite asserts: id non-empty · capabilities valid and
include `plan` · `supports()` accepts a supported contract and rejects an
unsupported one with a reason code · `supports()` is deterministic and tolerant of
`undefined` · `plan()` carries `provider === id` and a numeric `schemaVersion ≥ 1` ·
the plan is JSON round-trippable and deterministic · declared secrets never leak
into the plan · `apply` is present **iff** the `apply` capability is advertised.

Both providers pass it: **provider-netlify** (API-driven, `['plan','apply']` —
apply runs through an injected client, so the package never holds credentials) and
**provider-aws** (IaC-emitting, `['plan']` — it emits OpenTofu + a GitHub-OIDC
deploy pipeline, no runtime apply, no credentials held).

## 4. Deployment providers

A provider is `provider × DeploymentContract`, never `provider × language`. The
same `static` contract from any generator produces the same infrastructure.

| Provider | Model | Capabilities | Archetypes |
| --- | --- | --- | --- |
| provider-netlify | API-driven (injected client) | `plan`, `apply` | `static` → Netlify site |
| provider-aws | IaC-emitting (OpenTofu + GitHub OIDC pipeline) | `plan` | `static` → S3 + CloudFront (OAC) · `service` → App Runner · `worker` → ECS Fargate (no-NAT VPC) |

provider-aws is cost-conscious by construction (native S3 state locking, no
DynamoDB; no NAT gateway; explicit log retention) and credential-free (OIDC; no
runtime `apply`). All emitted IaC is `tofu validate`-clean in CI.

## 5. Version & compatibility

Core is pre-1.0 (`0.x`), so a minor bump can carry additive contract changes. The
ecosystem currently rides a **benign version split**: generators pin an older core
minor (they only need the stable contract types + generator conformance, which are
additively compatible), while surfaces and providers pin the minors that introduced
the APIs they use (`composeFullstack` in 0.5.0, the provider contract in 0.6.0).
This is safe precisely because the new primitives operate on plain data.

**Current compatibility matrix** (published versions):

| Package | Version | Protocol | `@packkit/core` | Maturity |
| --- | ---: | ---: | --- | --- |
| create-packkit (repo `create-packkit-js`) | 4.3.3 | 1 | `^0.4.0` | stable |
| create-packkit-py | 2.2.0 | 1 | `^0.4.0` | stable |
| create-packkit-go | 0.3.3 | 1 | `^0.4.0` | experimental |
| packkit-mcp | 1.2.0 | 1 | `^0.5.0` | stable |
| packkit-web | 0.1.0 | 1 | `^0.5.0` | stable |
| @packkit/provider-netlify | 0.2.0 | deployment-contract v1 | `^0.6.0` (peer) | stable |
| @packkit/provider-aws | 0.2.0 | deployment-contract v1 | `^0.6.0` (peer) | preview |
| @packkit/core | 0.6.0 | 1 | — | stable |

**Two compatibility gates, not one:**
- *Byte characterization* proves refactors don't change output (snapshots).
- *Semantic invariants* prove intentional evolution stays valid: every generated
  JSON/TOML/`go.mod` parses, every deployment contract + project definition
  validates, every path is safe, preset/option IDs are unique, and
  preset → config → definition → project round-trips.

**Releases** use Changesets automation (`changesets/action`, Version PR →
`changeset publish`) with tokenless OIDC + provenance; the final `npm publish`
stays local to each repo per supply-chain policy. `create-packkit` publishes via
`NPM_TOKEN`; the other packages use npm **OIDC Trusted Publishers**.

## 6. The org invariant & new-language onboarding

> **Every *deployable* preset emits a provider-neutral deployment contract.**
> **Providers determine support exclusively from the contract**, never from
> generator identity or language. A generator is "Packkit-compatible" only if it
> implements `PackkitGenerator`, **passes the conformance suite**, and its
> generated projects are continuously validated against their declared
> runtime/toolchain matrix.

Adding a language is an operational checklist, not an architecture project:

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

## 7. Deferred / out of scope

- **Dynamic/community generator plugins** — the registry is **explicit-registration
  only** (`registry.register(jsGenerator)`). No npm scanning, dynamic download, or
  arbitrary plugin execution until a trust model exists (signing, compatibility,
  sandboxing, permission declarations, discovery).
- **Standalone from-scratch IaC generator** (a `philatelyos-infra`-style repo) is
  explicitly **not** a provider concern and remains a separate future question.
- **Polyglot contract packages (#70)** — one repo publishing to npm **and** PyPI
  from one tag. Decided shape: a reusable release capability in `packkit-actions`
  (dual-registry OIDC + version-sync + partial-publish recovery), **not** a
  generator/core change. Deferred; does not touch the 1:1:1 generator↔language model.
- **`packkit-e2e`** — a released-version ecosystem harness running cross-repo E2E
  journeys against published packages. Under consideration.
