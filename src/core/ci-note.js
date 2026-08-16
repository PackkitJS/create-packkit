// The "first push" friction note, shared by every README (single package and
// monorepo). A brand-new repo has no lockfile yet, so CI's frozen install fails
// on commit #1 — and a repo created from the web UI never had a local install to
// produce one. The exact install command and lockfile name are package-manager
// specific, so say them precisely rather than hardcoding npm.

const LOCKFILE = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  bun: 'bun.lock',
};

// Markdown lines for the "## Continuous integration" section, or [] when the
// project has no CI workflow. Reused so the note stays consistent and correct.
export function ciFirstPushNote(cfg) {
  if (!cfg.workflows?.includes('ci')) return [];
  const pm = cfg.packageManager;
  const lockfile = LOCKFILE[pm] || LOCKFILE.npm;
  const installCmd = pm === 'npm' ? 'npm install' : `${pm} install`;

  const lines = [
    '## Continuous integration',
    '',
    `The \`CI\` workflow runs typecheck, lint, tests, and build on every push. It installs from a committed lockfile — so after creating the repo, run \`${installCmd}\` and commit the generated \`${lockfile}\`. Until then CI fails on the install step with a missing-lockfile error (expected on a brand-new repo).`,
    '',
  ];
  if (cfg.workflows.includes('pages')) {
    lines.push(
      'The Pages deploy needs Pages enabled first: **Settings → Pages → Source: GitHub Actions**. Until then it fails with _"Get Pages site failed"_ (also expected).',
      '',
    );
  }
  return lines;
}
