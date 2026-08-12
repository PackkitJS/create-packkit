# Architecture

Packkit is a project-generation engine with several front ends. The value of
that separation only holds if the layers stay distinct, so they're written down
here as rules rather than left as an accident of the current code.

```
   ┌── CLI ──┐   ┌─ web configurator ─┐   ┌─ MCP ─┐   ┌─ host apps ─┐
   │  (bin)  │   │   (docs, bundled)  │   │ (mcp) │   │  (embedded) │
   └────┬────┘   └──────────┬─────────┘   └───┬───┘   └──────┬──────┘
        │ embedded          │ core            │ core +       │ embedded
        │ + side effects    │ directly        │ scaffold     │
        │                   │                 │              │
   ┌────▼─────────────┐     │            ┌────▼────┐    ┌─────▼────────┐
   │  Embedded API    │◄────┼────────────┤ (mixed) │    │  Embedded    │
   │   src/embedded   │     │            └─────────┘    │              │
   │ orchestration,   │     │                                          │
   │ diagnostics,     │  ┌──▼───────────────────────────────────────┐  │
   │ definitions,     │  │                 Core                      │◄─┘
   │ upgrade, writer  ├─►│   src/core — config → { files }, pure,    │
   └──────────────────┘  │   no side effects, browser-safe          │
                         └──────────────────────────────────────────┘
```

## Public surfaces (what's supported)

| Import | What it is |
| --- | --- |
| `create-packkit` | Everything below, re-exported (Node). |
| `create-packkit/core` | The **low-level, browser-safe** generation API (`generate`, `fromPreset`, `normalizeConfig`, `OPTIONS`, …). Supported. |
| `create-packkit/embedded` | The **recommended Node orchestration API**: `createProject`, `extendProject`, definitions, digest, `deriveDeploymentContract`, the upgrade planner. Typed, versioned. |
| `create-packkit/writer` | The **safe filesystem adapter** (`writeGeneratedProject`). |

Anything under `src/**` not exported through those paths is internal and may
change without a major bump. Host applications should not import undocumented
internal modules.

## Principles

1. **The core never performs side effects and is browser-safe.** `src/core` is a
   pure `config → { files }` function — no network, filesystem, processes, or
   `node:crypto`. Everything it returns is data. It is a supported surface (the
   web configurator and MCP use it directly).

2. **The embedded API is the recommended programmatic surface.** It builds on the
   core and adds what raw generation doesn't: normalization diagnostics, the
   deployment contract, project definitions/digests, and upgrade planning. A host
   app should prefer it. But it is not the *only* supported surface — `/core` and
   `/writer` are supported too.

3. **Path safety lives in the writer, not everywhere.** Filesystem path
   validation and symlink/traversal protection apply when you write through
   `create-packkit/writer` (which the embedded API and CLI use). Raw `core`
   output is just data; a consumer that writes it itself is responsible for its
   own path handling.

4. **Diagnostics live in the embedded API, not the core.** `createProject`
   surfaces normalization coercions, collisions, and (for upgrades) baseline
   classification. A raw `core.generate()` call does not produce them — it just
   returns files.

5. **The CLI is an adapter over the embedded API plus local side effects.** It
   resolves, generates, and writes through the embedded pipeline (so it shares
   its diagnostics and path safety), then adds what the embedded API never does:
   `git init`, install, creating the remote.

6. **The web configurator uses the core directly.** [`PackkitJS/packkit-web`](https://github.com/PackkitJS/packkit-web)
   bundles `src/core` and runs it client-side to preview and zip. No embedded layer,
   no server — which is why the core must stay browser-safe.

7. **MCP uses the embedded API where it needs orchestration, and lower-level
   `core`/`scaffold` helpers where intentionally required.**

8. **Future providers never bypass the embedded API.** Any deployment or
   provisioning integration (Netlify, AWS, a portal) consumes it like any other
   host. Provider-specific logic lives in the host, never in Packkit — which is
   why the deployment contract is provider-neutral.
