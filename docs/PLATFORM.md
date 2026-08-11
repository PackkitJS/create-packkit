# Packkit Platform Migration — JS/TS scaffolder → multi-language platform

Status: **planning (Phase 0)** · Target release: **create-packkit 4.0.0** · Owner: DanMat

Packkit is evolving from "a JS/TS project generator" into a **provider-neutral
project bootstrap and lifecycle platform**, where a language-agnostic core
defines the contract and per-language generators implement it. `create-packkit-py`
already proves the model (a JS generator that emits idiomatic Python). This
document is the plan and the backlog. **No files move until the extraction map
below shows clean dependency direction and characterization tests are in place.**

Guiding rule: **contract-first, not mechanical extraction.** We extract concepts
that are genuinely language-neutral, not whatever two repos happen to duplicate.

## 1. Target architecture

```text
PackkitJS/
├── packkit-core        # the universal contract + primitives — no language templates
├── create-packkit      # JS/TS generator (repo renamed to create-packkit-js LAST; npm name stays create-packkit)
├── create-packkit-py   # Python generator (exists)
├── packkit-mcp         # extracted from create-packkit/mcp; fronts every generator
├── packkit-web         # extracted configurator; renders any generator's schema
├── packkit-actions     # reusable CI workflows (workflow_call)
├── provider-netlify    # exists; contract-driven
└── .github
```

Dependency direction is one-way and acyclic:

```text
packkit-core
   ▲        ▲
   │        │
create-packkit(-js)   create-packkit-py        (each implements PackkitGenerator)
   ▲        ▲
   └────────┴────────────┐
                         │
     packkit-mcp   packkit-web   provider-*     (consume the contract, never a generator's internals)
```

## 2. The core contract (`@packkit/core`)

Core owns the **universal Packkit protocol** and nothing language-specific.

**In core:**

- `PackkitGenerator` interface: `id`, `language`, `version`, `listPresets()`,
  `getSchema()`, `createProject()`, `createProjectFromDefinition()`, `upgradeProject()`.
- Types: `Diagnostic`, `GeneratedProject`, `PresetDescriptor`, `GeneratorSchema`,
  `ProjectDefinition`/provenance, `Baseline`, `ChangeClassification`,
  `DeploymentContract` (`Static | Service | Worker | Library | Cli | Fullstack`).
- Primitives: deterministic hashing (cyrb53), path-safety + the safe-writer contract,
  the **file** three-way diff (baseline/current/generated), extension/collision rules,
  schema serialization, generator registration/discovery, browser-safe surface.
- `ManifestDiffer` interface — the load-bearing seam. Core does file-level three-way;
  **structured manifest semantics are pluggable per generator.**

**NOT in core (stays per generator):** `package.json`/`pyproject.toml` manipulation,
npm/uv, bundlers, ESM/CJS, Vitest/Jest/ruff/pytest/mypy, framework and service
templates, language naming rules, and all manifest semantics (npm `scripts`/
`dependencies`/`peerDependencies`/`exports` vs. Python `[project]`/optional-deps/
entry-points) — those live behind `ManifestDiffer`.

## 3. Module extraction map (create-packkit today → destination)

| Current module | Destination | Notes |
| --- | --- | --- |
| `src/core/hash.js` (`contentHash`) | **core** | universal, browser-safe |
| `src/embedded/paths.js` (`validateRelativePath`) | **core** | path safety |
| `src/embedded/writer.js` (`writeGeneratedProject`) | **core** | generic safe writer |
| `src/embedded/contract.js` — **types** (`DeploymentContract` union) | **core** | add `WorkerContract` |
| `src/embedded/contract.js` — `deriveDeploymentContract` (npm commands) | **create-packkit-js** | JS-specific |
| `src/embedded/upgrade.js` — file three-way + diagnostics + baseline shape | **core** | universal |
| `src/embedded/upgrade.js` — package.json merge | **create-packkit-js** | behind `ManifestDiffer` |
| `src/embedded/pkg-merge.js` | **create-packkit-js** | npm manifest semantics |
| `src/core/provenance.js` — baseline/provenance **schema** | **core** | `buildBaseline` for package.json stays JS |
| `src/core/render.js` (`toJson` stable serialize) | **core** | deterministic JSON |
| Diagnostics types; `GeneratedProject`/`ProjectDefinition`/`PresetDescriptor` shapes | **core** | contract types |
| `src/core/options.js`, `presets.js`, `features/*` (24), `monorepo.js`, `pkg.js`, `node*.js`, `versions.js` | **create-packkit-js** | JS templates + options |
| `src/cli/*` | **create-packkit-js** | JS CLI |
| `mcp/*` | **packkit-mcp** | fronts all generators |
| `docs/*` (configurator + bundled core) | **packkit-web** | renders any generator |

`create-packkit-py` mirrors the same split: Python keeps `pyproject.toml`, uv,
ruff, pytest, mypy, hatchling, naming, version handling; implements `ManifestDiffer`
for pyproject semantics.

## 4. Version & backward-compatibility strategy

- **create-packkit → 4.0.0** when it starts depending on `@packkit/core` and
  implements `PackkitGenerator` (the embedded API may reshape). This iteration is
  a **major** on purpose — it marks the platform.
- **npm name and CLI stay `create-packkit`.** The repo rename to `create-packkit-js`
  is cosmetic and happens LAST; `npx create-packkit` must never break.
- **`@packkit/core` → 0.1.0** (new). `create-packkit-py` aligns to the contract,
  reaches lifecycle parity, then → 1.0.0.
- **provider-netlify**: it consumes the deployment contract structurally (no import),
  so it keeps working. Bump its peer range to `create-packkit@^3.3.0 || ^4`. If it
  later wants real contract types, it depends on `@packkit/core`.
- **Characterization tests first.** Before any extraction, snapshot every preset's
  full file map (byte-for-byte) for both generators. Extraction must keep every
  snapshot identical — that is the safety net that lets us refactor aggressively.

## 5. Phased backlog

Each phase is independently shippable and gated by the previous. Worker (#44) and
Go are deliberately near the end so they double as end-to-end validation once the
platform is assembled.

### Phase 0 — Plan & backlog (this doc)
- [x] Migration plan + extraction map + version strategy
- [x] Phased backlog
- [ ] Create the tracking milestone + epic issue in the org

### Phase 1 — Characterization safety net
- [ ] Byte-parity snapshots of all `create-packkit` presets (every generated file)
- [ ] Byte-parity snapshots of all `create-packkit-py` presets
- [ ] Wire both into CI so any output drift fails loudly
- **Acceptance:** a no-op refactor keeps 100% of snapshots identical.

### Phase 2 — Stand up `packkit-core`
- [ ] New repo `PackkitJS/packkit-core`, publishes `@packkit/core@0.1.0`
- [ ] Move universal primitives: `contentHash`, path-safety + safe-writer, file
      three-way diff, `toJson`, diagnostics types
- [ ] Define contract types: `DeploymentContract` (+ `WorkerContract`),
      `GeneratedProject`, `PresetDescriptor`, `GeneratorSchema`, `ProjectDefinition`,
      `Baseline`, `ChangeClassification`
- [ ] Define interfaces: `PackkitGenerator`, `ManifestDiffer`, generator registry
- [ ] `create-packkit` depends on `@packkit/core`, implements `PackkitGenerator`;
      package.json semantics move behind its `ManifestDiffer`
- [ ] **create-packkit → 4.0.0**; re-export moved types for back-compat
- **Acceptance:** Phase-1 snapshots unchanged; `npx create-packkit` unchanged;
      provider-netlify still green.

### Phase 3 — Python parity
- [ ] `create-packkit-py` depends on `@packkit/core`, implements `PackkitGenerator`
- [ ] Add embedded API, schema discovery, project definitions/provenance,
      baseline-aware upgrade (pyproject `ManifestDiffer`), deployment contract
- **Acceptance:** JS and Python expose the identical core contract; py snapshots stable.

### Phase 4 — Extract `packkit-mcp`
- [ ] New repo; move `mcp/*` out of create-packkit
- [ ] MCP registers generators (`[jsGenerator, pythonGenerator]`); tools:
      `list_generators`, `list_presets`, `get_generator_schema`, `generate_project`,
      `plan_upgrade`
- [ ] Update MCP registry entry / `server.json`; keep `io.github.PackkitJS/packkit-mcp`
- **Acceptance:** an agent can list + generate JS **and** Python projects via one server.

### Phase 5 — Extract `packkit-web`
- [ ] New repo; move the configurator; render any generator's schema (language picker)
- [ ] JS + Python both generate + ZIP-download in one UI, no per-language fork
- [ ] **Pages moves here once** — the configurator URL relocates to packkit-web's
      Pages, and create-packkit's Pages is retired (the single, clean Pages move)
- **Acceptance:** one UI, both languages; old configurator URL redirects/updated.

### Phase 6 — `packkit-actions` (shared CI)
- [ ] New repo with reusable `workflow_call` workflows: `generator-ci`,
      `generator-integration`, `generated-project-validation`, `dependency-freshness`,
      `npm-release`, `security`
- [ ] Standardize generator npm scripts: `check`, `test:integration`, `check:generated`,
      `check:freshness` — shared YAML invokes scripts, never encodes language commands
- [ ] Weekly freshness + generated-project validation as an **org invariant**
- [ ] Adopt **OIDC trusted publishing** for new packages; keep the final `npm publish`
      job in each repo (reusable-workflow trusted-publish validator keys on the caller)
- **Acceptance:** both generator repos consume the shared workflows; weekly jobs run.

### Phase 7 — Worker target (#44) as cross-language validation
- [ ] `WorkerContract` already in core; implement `node-worker` (create-packkit-js)
      and, same wave, `py-worker` (create-packkit-py)
- [ ] Each: unit-testable `handler(message)` seam, graceful SIGTERM/SIGINT drain,
      structured stdout logging, poison-message seam, env/config parsing, Dockerfile
      with **no** EXPOSE / HTTP healthcheck, **no** transport SDK in deps
- [ ] Generated worker exits 0 on SIGTERM after draining, with a test proving it
- **Acceptance:** both languages express the same worker target sharing all platform
      infra — the proof the abstraction is real. Closes #44.

### Phase 8 — Go generator spike (`create-packkit-go`)
- [ ] Presets `go-lib`, `go-cli`, `go-service`, `go-worker` (go.mod, `go fmt`,
      `go test`, `go vet`, golangci-lint; service = net/http + `/health` + PORT +
      graceful shutdown + multi-stage Docker)
- [ ] Implements `PackkitGenerator` against `@packkit/core` unchanged
- **Acceptance:** Go needs **zero** core changes → core isn't secretly modeling
      npm/Python. If core needs changes, that's the signal to fix the abstraction.

### Phase 9 — Repo rename + full doc/URL audit
- [ ] Rename GitHub repo `create-packkit` → `create-packkit-js` (npm name unchanged)
- [ ] Audit + update: org profile README, all READMEs, `ARCHITECTURE.md`, `ROADMAP.md`,
      `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`/`CLAUDE.md`, `llms.txt`, MCP
      registry/config, GitHub Pages URLs, npm repository/homepage/bugs metadata,
      provider docs + peer-dep ranges, issue templates, badges, code examples, every
      `PackkitJS/create-packkit` reference, and all "JS/TS-only" wording
- **Acceptance:** no stale links; docs describe the multi-language platform accurately.

### Phase 10 — Org rename (the finale 😅)
- [ ] Branding checkpoint: is `PackkitJS` still right once JS/Python/Go/IaC ship?
      Decide + (if yes) rename the org; re-run the full URL/redirect audit
- **Acceptance:** deliberate branding decision, executed cleanly with redirects.

## 6. Deferred / out of scope

- **#45 Terraform/OpenTofu** — not in create-packkit-js. After Phase 8 proves the
  contract across programming languages, revisit as a dedicated `create-packkit-iac`
  / `create-packkit-tofu` generator implementing `PackkitGenerator`. Leave #45 open
  with that note.
- **Python tool matrix** (Poetry/PDM/Flit, black/isort/pyright, tox/nox, Django/
  FastAPI/Flask) — only after Python reaches lifecycle parity (Phase 3), never before.

## 7. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Breaking `create-packkit`'s output/API during extraction | Phase-1 byte-parity characterization tests gate every move |
| npm concepts leaking into core | `ManifestDiffer` seam; Go spike (Phase 8) as the proof |
| Pages churn | Deferred to a single move in Phase 5 (packkit-web) |
| provider-netlify coupling | Structural contract (no import) + peer range `^3.3.0 || ^4` |
| OIDC trusted-publish in reusable workflows | Keep the `npm publish` job local to each repo |

## 8. The org invariant

> A language generator is not "Packkit-compatible" unless it implements
> `PackkitGenerator`, emits provider-neutral deployment contracts, and its generated
> projects are continuously validated against their declared runtime/toolchain matrix.
