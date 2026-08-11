# Changelog

All notable changes to `create-packkit` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Platform migration in progress (see [docs/PLATFORM.md](docs/PLATFORM.md)):
`@packkit/core` extraction, the `PackkitGenerator` contract, and a planned
`4.0.0` where the public embedded API reshapes to implement that contract.

## [3.3.3] - 2026-08-03

### Changed

- Migrated the MCP registry namespace to `io.github.PackkitJS`.

## [3.3.2] - 2026-08-03

### Changed

- De-namespaced URLs ahead of moving the project to the `PackkitJS` org.
- Refreshed the MCP lockfile for the prior release.

## [3.3.1] - 2026-08-02

### Changed

- Declared the Node version floor the project actually tests against and
  clarified the upgrade documentation.

## [3.3.0] - 2026-08-02

### Added

- `packkit upgrade` gained a baseline-aware three-way upgrade classification.
- Embedded `upgradeProject()` helper with machine-readable `--json` output.
- Composite fullstack deployment contract with explicit service runtime fields.
- Honest provenance reporting for partial upgrades.

### Changed

- `packkit upgrade --apply` is now non-destructive by default.

### Fixed

- Upgrade JSON error contract, input validation, and documentation corrections.

[Unreleased]: https://github.com/PackkitJS/create-packkit/compare/v3.3.3...HEAD
[3.3.3]: https://github.com/PackkitJS/create-packkit/compare/v3.3.2...v3.3.3
[3.3.2]: https://github.com/PackkitJS/create-packkit/compare/v3.3.1...v3.3.2
[3.3.1]: https://github.com/PackkitJS/create-packkit/compare/v3.3.0...v3.3.1
[3.3.0]: https://github.com/PackkitJS/create-packkit/compare/v3.2.0...v3.3.0
