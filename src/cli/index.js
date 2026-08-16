import { resolve, basename } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import { PRESET_NAMES, OPTIONS, OPTION_HELP, PRESET_INFO, PRESET_ALIASES } from '../core/index.js';
import { engineFloor, meetsNodeFloor } from '../core/node.js';
// The CLI is an adapter over the embedded API: it resolves + generates through
// the same pipeline every other surface uses (so it shares diagnostics,
// collision handling, and path safety), and adds the side effects the embedded
// API deliberately never performs — git, install, and creating the remote.
import { resolveProjectConfig, createProjectFromResolvedConfig, PackkitValidationError } from '../embedded/index.js';
import { writeGeneratedProject } from '../embedded/writer.js';
import { parseCliArgs, CliArgError } from './args.js';
import { runWizard } from './wizard.js';
import {
  existingEntries,
  gitInit,
  installDeps,
  hasCommand,
  githubLogin,
  createGithubRepo,
  pushToRemote,
  writeLockfile,
  commitAll,
} from './write.js';

const pkgVersion = () => {
  try {
    const url = new URL('../../package.json', import.meta.url);
    return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')).version;
  } catch {
    return '0.0.0';
  }
};

const HELP = `
packkit — scaffold a modern npm package, CLI, service, or app

Usage:
  npm create packkit@latest [name] [options]
  npx packkit [preset] [name] [options]
  npx packkit upgrade [dir]                Pull a scaffolded project up to current templates

Run with no options for an interactive wizard, or add -y for recommended
defaults in one shot. Every option is documented (with why-you'd-use-it) at:
  https://packkit-web.pages.dev/   ·   and in the README reference.

Presets:
  ${PRESET_NAMES.join('  ')}
  shortcuts: lib jslib rlib rapp vlib vapp slib sapp svc fs

Getting started:
  --preset <name>      Start from a preset (skips the wizard)
  --from <file>        Load defaults from a JSON profile (or packkit.config.json)
  -y, --yes            Accept defaults / preset, no prompts (one-shot)
  --recommended        Alias for -y
  --here               Scaffold into the current directory
  --merge              Scaffold into a non-empty directory (never overwrites)
  --no-install         Skip dependency install
  --no-git             Skip git init

Create the repo:
  --github             Create it on GitHub and push (uses the gh CLI)
  --git-remote <url>   Push to an existing remote (GitLab, Bitbucket, self-hosted)
  --public             Make the created repo public (default: private)

Stack:
  --language <ts|js>
  --module <esm|cjs|dual>                 ESM-only is the default
  --framework <none|react|vue|svelte>
  --target <library|cli|service|app>      repeatable
  --server <hono|fastify|express>         HTTP service framework
  --pm <npm|pnpm|yarn|bun>
  --monorepo                              pnpm + Turborepo workspace
  --monorepo-layout <libraries|fullstack> Linked packages, or web+server+shared

Build & test:
  --bundler <tsup|tsdown|unbuild|rollup|none>
  --minify                                Minify the build output
  --no-sourcemaps                         Don't ship source / sourcemaps
  --test <vitest|jest|node|none>
  --e2e                                   Playwright end-to-end tests (apps)
  --size-limit                            Bundle-size budget + CI gate (libs)

Quality:
  --lint <eslint-prettier|biome|oxlint|none>
  --hooks <simple-git-hooks|husky|lefthook|none>
  --pkg-checks                            publint + are-the-types-wrong
  --knip                                  Find unused files / deps / exports
  --doctor                                Warn on Node / pm mismatch
  --env                                   Type-safe env validation (services/CLIs)

Release & CI:
  --release <changesets|release-it|np|none>
  --canary                                Snapshot/canary release workflow
  --jsr                                   Also publish to JSR
  --workflows <ci|npm-publish|pages|codeql|codecov|stale>   repeatable
  --deps <renovate|dependabot|none>

Repo & extras:
  --license <MIT|Apache-2.0|ISC|none>
  --storybook                             Storybook (component libraries)
  --no-coverage  --no-community  --no-agents  --no-vscode  --no-editorconfig

Other:
  --schema             Print the full option/preset schema as JSON (for agents)
  -h, --help           Show this help          -v, --version   Show version

Examples:
  npx packkit ts-lib my-lib -y
  npx packkit react-app my-app --e2e
  npx packkit node-service api --server fastify --env
  npx packkit fullstack acme --github        # web + API + shared, repo created
  npm create packkit@latest my-pkg -- --preset oss --pm pnpm
`;

export async function run(argv = process.argv.slice(2)) {
  // Subcommands take the first positional. `upgrade` is a distinct flow (it
  // reads an existing project rather than scaffolding one), so route it early.
  if (argv[0] === 'upgrade') {
    const { runUpgrade } = await import('./upgrade.js');
    return runUpgrade(argv.slice(1));
  }

  let args;
  try {
    args = parseCliArgs(argv);
  } catch (err) {
    if (err instanceof CliArgError) {
      console.error(`✖ ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
  if (args.help) return void console.log(HELP);
  if (args.version) return void console.log(pkgVersion());
  if (args.schema) {
    // Machine-readable interface for tools/agents: every option, preset, and alias.
    return void console.log(JSON.stringify({ version: pkgVersion(), options: OPTIONS, optionHelp: OPTION_HELP, presets: PRESET_INFO, aliases: PRESET_ALIASES }, null, 2));
  }

  // Only prompt when the user gave nothing to go on — a preset, --yes, a
  // profile, or any config flag makes it a one-shot.
  const interactive = !args.preset && !args.yes && !args.from && !args.hasConfigFlags && process.stdout.isTTY;

  // Precedence: preset < profile file < CLI flags.
  const profile = loadProfile(args);
  const seed = { ...profile, ...args.overrides };

  // Gather raw input for the embedded resolver — don't normalize here, so the
  // resolver captures the coercions it makes (they surface as warnings below).
  let rawInput;
  let presetName;
  if (interactive) {
    p.intro('📦 Packkit');
    rawInput = await runWizard(seed);
  } else if (args.preset) {
    presetName = args.preset;
    rawInput = seed;
  } else {
    rawInput = seed;
  }
  // gitInit/install are real options, so they flow through resolution.
  rawInput = { ...rawInput, gitInit: args.git, install: args.install };

  let config;
  let diagnostics;
  try {
    ({ config, diagnostics } = resolveProjectConfig({ preset: presetName, config: rawInput }));
  } catch (err) {
    if (err instanceof PackkitValidationError) {
      console.error(err.diagnostics.map((d) => `✖ ${d.message}`).join('\n'));
      process.exit(1);
    }
    throw err;
  }

  // Node preflight: the generated project's tools (eslint, vite, vitest) hard-
  // require this floor. npm only *warns* on engines, so catch it here — clearly,
  // once — instead of letting a doomed install spew EBADENGINE and leave a broken
  // project. This is the signal both humans and agents need up front.
  const floor = engineFloor(config.nodeVersion);
  const nodeOk = meetsNodeFloor(process.version, floor);
  if (!nodeOk) {
    const lines = [
      `Node ${process.version} is below this project's required Node >= ${floor}.`,
      `Tools like eslint, vite and vitest will not run on it.`,
      `Fix: nvm install ${config.nodeVersion}   (or install any Node >= ${floor})`,
    ];
    if (config.install) {
      lines.push(`Skipping the dependency install until Node is upgraded.`);
      config.install = false;
    }
    if (interactive) p.log.warn(lines.join('\n')); else console.error('\n⚠  ' + lines.join('\n   '));
  }

  // Resolve the target directory.
  const targetDir = args.here ? process.cwd() : resolve(process.cwd(), config.name);
  if (!args.here && !config.name) {
    console.error('A package name is required (pass one, or run interactively).');
    process.exit(1);
  }
  const occupied = existingEntries(targetDir);
  if (occupied.length && !args.merge) {
    const sample = occupied.slice(0, 4).join(', ') + (occupied.length > 4 ? ', …' : '');
    console.error(
      `Target directory "${basename(targetDir)}" is not empty (${sample}).\n` +
        `Re-run with --merge to scaffold around what's there — existing files are never overwritten.`,
    );
    process.exit(1);
  }

  // Resolve the remote *before* generating: the repository URL is baked into
  // package.json links and README badges at generate time, so creating the repo
  // afterwards would ship a first commit pointing at nothing.
  const remote = resolveRemote(args, config);
  if (remote?.error) {
    console.error(remote.error);
    process.exit(1);
  }
  if (remote?.url && /^https?:/.test(remote.url)) config.repo = remote.url;

  // Generate through the embedded pipeline (carrying the resolution diagnostics)
  // and write through the safe writer. --merge maps to the 'skip' policy: write
  // what's absent, keep what's there — never overwrite.
  const project = createProjectFromResolvedConfig(config, { diagnostics });
  const { summary } = project;

  // Surface anything Packkit changed or flagged during resolution — a coercion
  // (Storybook off for a service), an unknown option — before writing.
  const warnings = project.diagnostics.filter((d) => d.severity === 'warning');
  if (warnings.length) {
    const lines = warnings.map((d) => d.message).join('\n');
    if (interactive) p.log.warn(lines); else console.error('\n⚠  ' + warnings.map((d) => d.message).join('\n   '));
  }

  const { skippedFiles: skipped } = await writeGeneratedProject({
    project,
    destination: targetDir,
    collisionPolicy: args.merge ? 'skip' : 'error',
  });

  // Post steps.
  if (config.gitInit) gitInit(targetDir);
  if (config.install) {
    const s = p.spinner();
    s.start(`Installing dependencies with ${config.packageManager}`);
    const ok = installDeps(config.packageManager, targetDir);
    s.stop(ok ? 'Dependencies installed' : 'Install skipped (run it manually)');
  }

  // Create the remote last, so a failure here still leaves a complete local
  // project behind — nothing to clean up, just a command to re-run.
  let pushedTo = null;
  if (remote) {
    const s = p.spinner();
    // A repo pushed without a lockfile fails CI immediately — actions/setup-node
    // errors when its cache can't find one. Produce it without a full install.
    if (!config.install) {
      s.start('Writing a lockfile so CI passes on the first run');
      const ok = writeLockfile(config.packageManager, targetDir);
      s.stop(ok ? 'Lockfile written' : `No lockfile — run \`${config.packageManager} install\` and commit it, or CI will fail`);
    }
    commitAll(targetDir, 'Add lockfile');
    s.start(remote.kind === 'github' ? `Creating ${remote.slug} on GitHub` : 'Pushing to origin');
    const res =
      remote.kind === 'github'
        ? createGithubRepo({
            slug: remote.slug,
            description: config.description,
            private: args.private,
            cwd: targetDir,
          })
        : pushToRemote(remote.url, targetDir);
    s.stop(res.ok ? `Pushed to ${remote.url}` : 'Could not create the remote');
    if (res.ok) pushedTo = remote.url;
    else {
      const retry =
        remote.kind === 'github'
          ? `gh repo create ${remote.slug} --${args.private ? 'private' : 'public'} --source . --remote origin --push`
          : `git remote add origin ${remote.url} && git push -u origin HEAD`;
      console.error(`\n${res.error || 'The command failed.'}\n\nThe project is scaffolded. To retry:\n  cd ${basename(targetDir)} && ${retry}`);
    }
  }

  const rel = args.here ? '.' : config.name;
  const next = [
    args.here ? null : `cd ${rel}`,
    config.install ? null : `${config.packageManager} install`,
    config.hasApp || config.monorepoLayout === 'fullstack' ? `${runWord(config)} dev` : config.hasBuild ? `${runWord(config)} build` : null,
    config.test !== 'none' ? `${runWord(config)} test` : null,
  ].filter(Boolean);

  // Clarify things that surprise people: a framework *library* has no dev
  // server (its `dev` just rebuilds), and the Node floor this project needs.
  const componentLib = config.hasFramework && config.hasLibrary && !config.hasApp && !config.monorepo;
  const hints = [
    componentLib
      ? `This is a ${config.framework} component library — \`${runWord(config)} dev\` rebuilds on change (there's no dev server). For a runnable app, scaffold the "${config.framework}-app" preset instead.`
      : null,
    `Requires Node >= ${floor}${nodeOk ? '' : ` — you're on ${process.version}, upgrade first`}.`,
    skipped.length
      ? `Kept ${skipped.length} existing file${skipped.length > 1 ? 's' : ''} — Packkit's version was not written: ${skipped.join(', ')}`
      : null,
    // Said here too, not just in the README: this is the moment a red X appears
    // on a repo that is ten seconds old, and the cause is not obvious.
    pushedTo && config.workflows?.includes('npm-publish') && config.release === 'changesets'
      ? `The Release workflow will fail until npm credentials exist — set up npm Trusted Publishing, or add an NPM_TOKEN secret. See "Releasing" in the README.`
      : null,
  ].filter(Boolean);

  const done =
    `Created ${summary.name} — ${summary.fileCount - skipped.length} files · ${summary.stack.join(' · ')}` +
    (pushedTo ? `\n${pushedTo}` : '');
  if (interactive) {
    p.note(next.join('\n') || 'You are all set.', 'Next steps');
    if (hints.length) p.log.info(hints.join('\n'));
    p.outro(done);
  } else {
    console.log(done);
    if (next.length) console.log('\nNext steps:\n  ' + next.join('\n  '));
    if (hints.length) console.log('\n' + hints.map((h) => '• ' + h).join('\n'));
  }

  const latest = await checkForUpdate(pkgVersion());
  if (latest) console.log(`\n↑ A newer create-packkit is available: ${latest} (you have ${pkgVersion()}). Use @latest to update.`);
}

function runWord(config) {
  return config.packageManager === 'npm' ? 'npm run' : config.packageManager;
}

// owner/name for the repo to create: an explicit --repo URL wins, otherwise the
// authenticated gh account plus the project name.
function githubSlug(repoUrl, login, name) {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/*$/.exec(repoUrl || '');
  if (m) return `${m[1]}/${m[2]}`;
  return login ? `${login}/${name}` : null;
}

/**
 * Work out what remote to create, if any. Returns null (nothing to do),
 * { error } to abort before writing anything, or the resolved target.
 */
function resolveRemote(args, config) {
  if (!args.github && !args.gitRemote) return null;
  if (!config.gitInit) {
    return { error: 'Creating a repo needs a local git repo — drop --no-git.' };
  }
  if (args.gitRemote) return { kind: 'remote', url: args.gitRemote };

  // Delegate to `gh` rather than calling the API: it already holds the user's
  // credentials, so Packkit never reads, prompts for, or stores a token.
  if (!hasCommand('gh')) {
    return {
      error:
        '--github needs the GitHub CLI. Install it (https://cli.github.com), or use\n' +
        '--git-remote <url> to push to a repo you have already created.',
    };
  }
  const login = githubLogin();
  if (!login) {
    return { error: '--github needs an authenticated GitHub CLI. Run: gh auth login' };
  }
  const slug = githubSlug(config.repo, login, config.name);
  if (!slug) return { error: 'Could not work out the repository name. Pass --repo <url>.' };
  return { kind: 'github', slug, url: `https://github.com/${slug}` };
}

// Load a partial config from --from <file>, or a packkit.config.json in cwd.
function loadProfile(args) {
  const path = args.from || (existsSync('packkit.config.json') ? 'packkit.config.json' : null);
  if (!path) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`Could not read profile "${path}": ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

// Best-effort update check — TTY only, short timeout, never throws or blocks.
async function checkForUpdate(current) {
  try {
    if (process.env.CI || process.env.NO_UPDATE_NOTIFIER || !process.stdout.isTTY) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch('https://registry.npmjs.org/create-packkit/latest', { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const { version } = await res.json();
    return version && isNewer(version, current) ? version : null;
  } catch {
    return null;
  }
}

function isNewer(latest, current) {
  const a = latest.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return false;
}
