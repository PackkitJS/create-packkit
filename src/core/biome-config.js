// The biome.json emitted for a Biome project, shared by the single-package and
// monorepo lint paths so the two can't drift. Two things it gets right that a
// naive config doesn't:
//
//   * the $schema tracks the pinned @biomejs/biome version (derived from the
//     catalog), so a fresh install doesn't warn "schema does not match CLI".
//   * build output is excluded — via .gitignore (vcs.useIgnoreFile) and an
//     explicit ignore, so `biome lint` never scans dist/ after a build, with or
//     without a git repo.

import { V } from './versions.js';

// '^2.5.8' → '2.5.8'. The schema URL uses the exact version the devDep resolves
// to at its floor, which is what a clean install gets.
const BIOME_VERSION = V['@biomejs/biome'].replace(/^[\^~]/, '');

export function biomeConfig() {
  return {
    $schema: `https://biomejs.dev/schemas/${BIOME_VERSION}/schema.json`,
    // Respect .gitignore (dist, coverage, node_modules…) when a git repo exists.
    vcs: { enabled: true, clientKind: 'git', useIgnoreFile: true },
    // And exclude build output explicitly, so linting is correct before the
    // first commit / without a repo too. `**/…` covers monorepo packages.
    files: { includes: ['**', '!dist', '!**/dist', '!coverage', '!**/coverage'] },
    formatter: { enabled: true, indentStyle: 'tab', lineWidth: 100 },
    linter: { enabled: true },
    javascript: { formatter: { quoteStyle: 'single', trailingCommas: 'all' } },
  };
}
